// Local publish server for the CoC Studio.
// Validates a destination against the allowlist, writes one WebP into the repo,
// scans it, commits it through a temporary git index, refreshes that one path in
// the real index and pushes origin/main.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { randomInt, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ALLOWED_CATEGORIES,
  BRANCH,
  FILENAME_PATTERN,
  PUBLISH_BODY_LIMIT_BYTES,
  PUBLISH_REQUEST_HEADER,
  TH_LEVELS,
  rawUrlForPath,
  sanitizeStem,
} from '../src/shared/studioConfig.ts'

const GIT_TIMEOUT_MS = 15_000
const SCAN_TIMEOUT_MS = 20_000
const PUSH_TIMEOUT_MS = 60_000

export type PublishStage = 'write' | 'scan' | 'commit' | 'push'

export interface Destination {
  category: string
  th: string
  sub: string
}

export interface PrepareSuccess {
  ok: true
  category: string
  th: string
  sub: string
  filename: string
  relPath: string
  rawUrl: string
  dirExists: boolean
  ahead: number
  branch: string
  canPush: boolean
}

export interface PublishSuccess {
  ok: true
  pushed: true
  filename: string
  relPath: string
  rawUrl: string
  commit: string
  bytes: number
  /** Present only when the commit was made but the real git index could not be refreshed. */
  warning?: string
}

export interface ApiFailure {
  ok: false
  error: string
  stage?: PublishStage
  committed?: boolean
  commit?: string
  filename?: string
  relPath?: string
  rawUrl?: string
  /** Present only when the commit was made but the real git index could not be refreshed. */
  warning?: string
}

export interface ApiResult<T> {
  status: number
  body: T | ApiFailure
}

interface RunResult {
  ok: boolean
  stdout: string
  stderr: string
  timedOut: boolean
}

const UNSUPPORTED_DESTINATION = 'Unsupported destination. Convert & Push writes only to Bases_img/home_village_bases (War, Farming, Progress, Art, Rank) or army_img (War, Farming, Rank, Simple), under TH_1 to TH_18.'

function failure(status: number, error: string, extra?: Omit<ApiFailure, 'ok' | 'error'>): ApiResult<never> {
  return { status, body: { ok: false, error, ...extra } }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Canonicalize category / TH / sub against the allowlist; never trust a client path. */
export function canonicalDestination(input: unknown): Destination | null {
  const record = asRecord(input)
  if (!record) return null
  const rawCategory = asString(record.category)
  const rawTh = asString(record.th)
  const rawSub = asString(record.sub)
  if (rawCategory === null || rawTh === null || rawSub === null) return null
  const category = Object.keys(ALLOWED_CATEGORIES).find(key => key.toLowerCase() === rawCategory.trim().toLowerCase())
  if (!category) return null
  const th = TH_LEVELS.find(level => level.toLowerCase() === rawTh.trim().toLowerCase())
  if (!th) return null
  const sub = ALLOWED_CATEGORIES[category].subs.find(name => name.toLowerCase() === rawSub.trim().toLowerCase())
  if (!sub) return null
  return { category, th, sub }
}

export function buildRelPath(destination: Destination, filename: string): string {
  return `${destination.category}/${destination.th}/${destination.sub}/${filename}`
}

/** Resolve a repo-relative POSIX path, refusing anything that escapes the repo root. */
function targetPath(repoRoot: string, relPath: string): string | null {
  const root = path.resolve(repoRoot)
  const absolute = path.resolve(root, ...relPath.split('/'))
  if (absolute === root) return null
  if (!absolute.startsWith(root + path.sep)) return null
  return absolute
}

function runProcess(file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }): Promise<RunResult> {
  return new Promise(resolve => {
    execFile(file, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      encoding: 'utf8',
    }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ ok: true, stdout: String(stdout ?? ''), stderr: String(stderr ?? ''), timedOut: false })
        return
      }
      const detail = error as { killed?: boolean; code?: string; message?: string }
      resolve({
        ok: false,
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? '').trim() || detail.message || 'Command failed.',
        timedOut: Boolean(detail.killed) || detail.code === 'ETIMEDOUT',
      })
    })
  })
}

function git(repoRoot: string, args: string[], timeoutMs = GIT_TIMEOUT_MS, env?: NodeJS.ProcessEnv): Promise<RunResult> {
  return runProcess('git', args, { cwd: repoRoot, env: env ?? process.env, timeoutMs })
}

function summarizeGitError(text: string, fallback: string): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const important = lines.find(line => /^(fatal|error|remote:|! \[rejected\])/i.test(line))
  return (important ?? lines[0] ?? fallback).slice(0, 400)
}

function decodeWebp(data: string): Buffer | null {
  if (!data) return null
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length <= 12) return null
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') return null
  if (bytes.toString('ascii', 8, 12) !== 'WEBP') return null
  return bytes
}

export function resolveRepoRoot(defaultRepoRoot: string): string {
  const override = process.env.COC_STUDIO_REPO_ROOT
  const root = override && override.trim() ? override.trim() : defaultRepoRoot
  return path.resolve(root)
}

async function readGitCount(repoRoot: string, args: string[]): Promise<number> {
  const result = await git(repoRoot, args)
  if (!result.ok) return -1
  const count = Number.parseInt(result.stdout.trim(), 10)
  return Number.isFinite(count) ? count : -1
}

async function blobHashOf(repoRoot: string, bytes: Buffer): Promise<string | null> {
  const tempFile = path.join(os.tmpdir(), `coc-studio-blob-${randomUUID()}.webp`)
  try {
    fs.writeFileSync(tempFile, bytes)
    const result = await git(repoRoot, ['hash-object', tempFile])
    return result.ok ? result.stdout.trim() : null
  } catch {
    return null
  } finally {
    try { fs.rmSync(tempFile, { force: true }) } catch { /* temp file already gone */ }
  }
}

async function headBlobHash(repoRoot: string, relPath: string): Promise<string | null> {
  const result = await git(repoRoot, ['rev-parse', `HEAD:${relPath}`])
  return result.ok ? result.stdout.trim() : null
}

async function commitFileList(repoRoot: string): Promise<string[] | null> {
  const result = await git(repoRoot, ['show', '--pretty=format:', '--name-only', 'HEAD'])
  if (!result.ok) return null
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

async function shortHead(repoRoot: string): Promise<string> {
  const result = await git(repoRoot, ['rev-parse', '--short', 'HEAD'])
  return result.ok ? result.stdout.trim() : ''
}

/** Pick a six-digit suffix that no worktree file or tracked blob already uses. */
async function uniqueFilename(repoRoot: string, destination: Destination, stem: string): Promise<string | null> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const candidate = `${stem}_${suffix}.webp`
    if (!FILENAME_PATTERN.test(candidate)) continue
    const relPath = buildRelPath(destination, candidate)
    const absolute = targetPath(repoRoot, relPath)
    if (!absolute) return null
    if (fs.existsSync(absolute)) continue
    const tracked = await git(repoRoot, ['ls-files', '--', relPath])
    if (!tracked.ok) return null
    if (tracked.stdout.trim()) continue
    return candidate
  }
  return null
}

export async function preparePublish(repoRoot: string, rawBody: unknown): Promise<ApiResult<PrepareSuccess>> {
  const record = asRecord(rawBody)
  if (!record) return failure(400, 'Request body must be a JSON object.')
  const destination = canonicalDestination(record)
  if (!destination) return failure(400, UNSUPPORTED_DESTINATION)
  const stem = sanitizeStem(asString(record.stem) ?? '')

  const filename = await uniqueFilename(repoRoot, destination, stem)
  if (!filename) {
    return failure(500, 'Could not find a free six-digit filename, or git could not inspect the repository. Nothing was written.')
  }

  const branchResult = await git(repoRoot, ['branch', '--show-current'])
  const branch = branchResult.ok ? branchResult.stdout.trim() : ''
  const ahead = await readGitCount(repoRoot, ['rev-list', '--count', `origin/${BRANCH}..HEAD`])
  const relPath = buildRelPath(destination, filename)
  const folder = path.join(repoRoot, ...destination.category.split('/'), destination.th, destination.sub)
  let dirExists = false
  try {
    dirExists = fs.statSync(folder).isDirectory()
  } catch {
    dirExists = false
  }

  return {
    status: 200,
    body: {
      ok: true,
      category: destination.category,
      th: destination.th,
      sub: destination.sub,
      filename,
      relPath,
      rawUrl: rawUrlForPath(relPath),
      dirExists,
      ahead,
      branch,
      canPush: ahead === 0 && branch === BRANCH,
    },
  }
}

interface CommitOutcome {
  ok: boolean
  stage: PublishStage
  error: string
  commit?: string
  warning?: string
}

/**
 * Point the owner's real index at HEAD's blob for the published path only.
 * The temp-index commit never updates the real index, so without this git reports
 * the new image as a staged deletion and the owner's next commit deletes it.
 * Only this single path is touched; unrelated staged work is left alone.
 * Returns a warning if the refresh cannot be proven; the publish still succeeds.
 */
async function refreshRealIndex(repoRoot: string, relPath: string): Promise<string | null> {
  const warning = `The image was committed, but the local git index could not be refreshed for ${relPath}. Run "git update-index --add -- ${relPath}" before your next commit so git does not delete the new image.`
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.GIT_INDEX_FILE
  const expected = await headBlobHash(repoRoot, relPath)
  if (!expected) return warning
  const update = await git(repoRoot, ['update-index', '--add', '--', relPath], GIT_TIMEOUT_MS, env)
  if (!update.ok) return warning
  const staged = await git(repoRoot, ['ls-files', '--stage', '--', relPath], GIT_TIMEOUT_MS, env)
  if (!staged.ok) return warning
  const entry = staged.stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean)
  const indexHash = entry ? entry.split(/\s+/)[1] : ''
  if (indexHash !== expected) return warning
  return null
}

/**
 * Commit exactly one file using a temp index outside the repo, then refresh that
 * same path in the owner's real index. Unrelated work cannot ride into the
 * commit, and unrelated staged work is preserved by the single-path refresh.
 */
async function createSingleFileCommit(repoRoot: string, relPath: string): Promise<CommitOutcome> {
  const indexFile = path.join(os.tmpdir(), `coc-studio-index-${randomUUID()}`)
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_INDEX_FILE: indexFile }
  try {
    const readTree = await git(repoRoot, ['read-tree', 'HEAD'], GIT_TIMEOUT_MS, env)
    if (!readTree.ok) {
      return { ok: false, stage: 'commit', error: `Could not prepare the commit index. ${summarizeGitError(readTree.stderr, 'git read-tree failed.')}` }
    }
    const add = await git(repoRoot, ['add', '--', relPath], GIT_TIMEOUT_MS, env)
    if (!add.ok) {
      return { ok: false, stage: 'commit', error: `Could not stage ${relPath}. ${summarizeGitError(add.stderr, 'git add failed.')}` }
    }

    const scanScript = path.join(repoRoot, 'scripts', 'verify-secrets.mjs')
    if (!fs.existsSync(scanScript)) {
      return { ok: false, stage: 'scan', error: 'The secret scanner scripts/verify-secrets.mjs is missing. Refusing to commit an unscanned file.' }
    }
    const scan = await runProcess(process.execPath, [scanScript, '--staged'], { cwd: repoRoot, env, timeoutMs: SCAN_TIMEOUT_MS })
    if (!scan.ok) {
      const reason = scan.timedOut
        ? 'The secret scan timed out after 20s.'
        : summarizeGitError(scan.stderr || scan.stdout, 'The secret scan rejected the staged file.')
      return { ok: false, stage: 'scan', error: `Secret scan failed: ${reason} Nothing was committed.` }
    }

    const commit = await git(repoRoot, ['commit', '-m', `Add ${relPath}`], GIT_TIMEOUT_MS, env)
    if (!commit.ok) {
      return { ok: false, stage: 'commit', error: `Git commit failed: ${summarizeGitError(commit.stderr, 'git commit exited with an error.')} Nothing was pushed.` }
    }

    const files = await commitFileList(repoRoot)
    if (!files || files.length !== 1 || files[0] !== relPath) {
      return { ok: false, stage: 'commit', error: 'Commit safety check failed: the new commit does not contain exactly the new image. Nothing was pushed.' }
    }
    const warning = await refreshRealIndex(repoRoot, relPath)
    return { ok: true, stage: 'commit', error: '', commit: await shortHead(repoRoot), ...(warning ? { warning } : {}) }
  } finally {
    try { fs.rmSync(indexFile, { force: true }) } catch { /* temp index already gone */ }
  }
}

function pushFailureReason(stderr: string, timedOut: boolean): string {
  if (timedOut) return `Pushing timed out after ${PUSH_TIMEOUT_MS / 1000}s.`
  if (/terminal prompts disabled|could not read Username|could not read Password|Authentication failed|Permission denied|access denied|repository not found/i.test(stderr)) {
    return 'GitHub credentials are not available (git could not prompt for them). Run "gh auth login" or sign in with GitHub Desktop.'
  }
  if (/non-fast-forward|fetch first|rejected/i.test(stderr)) {
    return 'The push was rejected because origin/main moved. Fetch and rebase, then push the saved commit manually.'
  }
  return `Push failed: ${summarizeGitError(stderr, 'git push exited with an error.')}`
}

async function publishInner(repoRoot: string, rawBody: unknown): Promise<ApiResult<PublishSuccess>> {
  const record = asRecord(rawBody)
  if (!record) return failure(400, 'Request body must be a JSON object.')
  const destination = canonicalDestination(record)
  if (!destination) return failure(400, UNSUPPORTED_DESTINATION)

  const filename = (asString(record.filename) ?? '').trim()
  if (!FILENAME_PATTERN.test(filename)) {
    return failure(400, 'Filename must match <name>_<six digits>.webp using lowercase letters, digits and underscores.')
  }
  const data = asString(record.data)
  if (!data) return failure(400, 'Missing image data.')
  const bytes = decodeWebp(data)
  if (!bytes) return failure(400, 'The upload is not a valid WebP image.')

  const relPath = buildRelPath(destination, filename)
  const rawUrl = rawUrlForPath(relPath)
  const absolute = targetPath(repoRoot, relPath)
  if (!absolute) return failure(400, 'The destination path escapes the repository.')

  const branchResult = await git(repoRoot, ['branch', '--show-current'])
  if (!branchResult.ok) return failure(500, `Could not read the current git branch. ${summarizeGitError(branchResult.stderr, '')}`.trim())
  const branch = branchResult.stdout.trim()
  if (branch !== BRANCH) {
    return failure(409, `The current branch is "${branch || '(detached)'}", not ${BRANCH}. Switch to ${BRANCH} before publishing. Nothing was written.`)
  }

  const ahead = await readGitCount(repoRoot, ['rev-list', '--count', `origin/${BRANCH}..HEAD`])
  if (ahead < 0) {
    return failure(409, `Could not compare HEAD with origin/${BRANCH}. Run "git fetch" and try again. Nothing was written.`)
  }

  const ourHash = await blobHashOf(repoRoot, bytes)
  if (!ourHash) return failure(500, 'Could not hash the image for git. Nothing was written.')
  const headHash = await headBlobHash(repoRoot, relPath)
  const sameAtHead = headHash !== null && headHash === ourHash

  if (headHash !== null && !sameAtHead) {
    return failure(409, `${relPath} already exists with different content. Pick a new filename; existing images are never overwritten.`)
  }

  if (ahead === 0) {
    if (sameAtHead) {
      // Committed and already on origin/main: a repeat confirm is a no-op.
      return { status: 200, body: { ok: true, pushed: true, filename, relPath, rawUrl, commit: await shortHead(repoRoot), bytes: bytes.length } }
    }
  } else if (ahead === 1 && sameAtHead) {
    const files = await commitFileList(repoRoot)
    if (!files || files.length !== 1 || files[0] !== relPath) {
      return failure(409, `Local ${BRANCH} has 1 unpushed commit that is not only ${relPath}. Push or reset it before publishing. Nothing was written.`)
    }
  } else {
    return failure(409, `Local ${BRANCH} is ${ahead} commit(s) ahead of origin/${BRANCH}. Convert & Push never deploys unrelated commits: push them first (push.bat), then try again. Nothing was written.`)
  }

  let onDisk: 'absent' | 'identical' | 'different' = 'absent'
  if (fs.existsSync(absolute)) {
    try {
      onDisk = fs.readFileSync(absolute).equals(bytes) ? 'identical' : 'different'
    } catch {
      onDisk = 'different'
    }
  }
  if (onDisk === 'different') {
    return failure(409, `${relPath} already exists on disk with different content. Pick a new filename; existing images are never overwritten.`)
  }

  if (onDisk === 'absent') {
    try {
      fs.mkdirSync(path.dirname(absolute), { recursive: true })
      fs.writeFileSync(absolute, bytes)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return failure(500, `Could not write ${relPath}: ${message}`)
    }
  }

  let commit = await shortHead(repoRoot)
  let indexWarning: string | undefined
  if (!sameAtHead) {
    const outcome = await createSingleFileCommit(repoRoot, relPath)
    if (!outcome.ok) {
      return failure(500, outcome.error, { stage: outcome.stage, committed: false, filename, relPath, rawUrl })
    }
    commit = outcome.commit ?? commit
    indexWarning = outcome.warning
  }

  const aheadAfter = await readGitCount(repoRoot, ['rev-list', '--count', `origin/${BRANCH}..HEAD`])
  if (aheadAfter !== 1) {
    return failure(500, `The image was committed, but local ${BRANCH} is ${aheadAfter === -1 ? 'in an unknown state' : `${aheadAfter} commits`} ahead of origin/${BRANCH} instead of exactly 1. Push manually, then retry.`, {
      stage: 'commit', committed: true, commit, filename, relPath, rawUrl,
      ...(indexWarning ? { warning: indexWarning } : {}),
    })
  }
  const filesAfter = await commitFileList(repoRoot)
  if (!filesAfter || filesAfter.length !== 1 || filesAfter[0] !== relPath) {
    return failure(500, 'The new commit does not contain exactly the new image. Review it and push manually.', {
      stage: 'commit', committed: true, commit, filename, relPath, rawUrl,
      ...(indexWarning ? { warning: indexWarning } : {}),
    })
  }

  const pushEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_PAGER: 'cat',
  }
  const push = await runProcess('git', ['push', 'origin', BRANCH], { cwd: repoRoot, env: pushEnv, timeoutMs: PUSH_TIMEOUT_MS })
  if (!push.ok) {
    return failure(500, `${pushFailureReason(push.stderr, push.timedOut)} The image is committed locally; use Retry push to send it.`, {
      stage: 'push', committed: true, commit, filename, relPath, rawUrl,
      ...(indexWarning ? { warning: indexWarning } : {}),
    })
  }

  const body: PublishSuccess = { ok: true, pushed: true, filename, relPath, rawUrl, commit, bytes: bytes.length }
  if (indexWarning) body.warning = indexWarning
  return { status: 200, body }
}

let publishQueue: Promise<unknown> = Promise.resolve()

/** Serialize publishes so a double confirm can never race two commits. */
export function publishImage(repoRoot: string, rawBody: unknown): Promise<ApiResult<PublishSuccess>> {
  const result = publishQueue.then(() => publishInner(repoRoot, rawBody))
  publishQueue = result.catch(() => undefined)
  return result
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number; error: string }

function readJsonBody(req: IncomingMessage, limit: number): Promise<BodyResult> {
  return new Promise(resolve => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const finish = (result: BodyResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > limit) {
      finish({ ok: false, status: 413, error: `Request body is larger than ${Math.round(limit / (1024 * 1024))} MB.` })
      req.resume()
      return
    }

    req.on('data', (chunk: Buffer) => {
      if (settled) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > limit) {
        finish({ ok: false, status: 413, error: `Request body is larger than ${Math.round(limit / (1024 * 1024))} MB.` })
        req.resume()
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      if (settled) return
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text.trim()) {
        finish({ ok: false, status: 400, error: 'Request body is empty.' })
        return
      }
      try {
        finish({ ok: true, value: JSON.parse(text) })
      } catch {
        finish({ ok: false, status: 400, error: 'Request body is not valid JSON.' })
      }
    })
    req.on('aborted', () => finish({ ok: false, status: 400, error: 'Request aborted.' }))
    req.on('error', () => finish({ ok: false, status: 400, error: 'Could not read the request body.' }))
  })
}

interface SecurityProblem {
  status: number
  error: string
}

function checkRequestSecurity(req: IncomingMessage): SecurityProblem | null {
  const marker = req.headers['x-studio-request']
  if (marker !== PUBLISH_REQUEST_HEADER) {
    return { status: 403, error: 'Missing or invalid X-Studio-Request header. This endpoint only accepts requests from the local studio.' }
  }
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (contentType !== 'application/json') {
    return { status: 415, error: 'Content-Type must be application/json.' }
  }
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin) {
    if (!host || origin !== `http://${host}`) {
      return { status: 403, error: 'Cross-origin publish requests are not allowed.' }
    }
  } else {
    const fetchSite = req.headers['sec-fetch-site']
    if (fetchSite && fetchSite !== 'same-origin') {
      return { status: 403, error: 'Cross-site publish requests are not allowed.' }
    }
  }
  return null
}

/**
 * Connect-style middleware for the two publish routes. Mounted by
 * vite-plugin-publish.ts; the repo root can be overridden with
 * COC_STUDIO_REPO_ROOT so sandbox tests never touch the real repository.
 */
export function createPublishMiddleware(defaultRepoRoot: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): Promise<void> => {
    const rawUrl = req.url ?? '/'
    const queryIndex = rawUrl.indexOf('?')
    const pathname = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex)
    if (!pathname.startsWith('/api/publish')) {
      next()
      return
    }
    if (pathname !== '/api/publish' && pathname !== '/api/publish/prepare') {
      sendJson(res, 404, { ok: false, error: 'Unknown publish endpoint.' })
      return
    }

    const problem = checkRequestSecurity(req)
    if (problem) {
      sendJson(res, problem.status, { ok: false, error: problem.error })
      return
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      sendJson(res, 405, { ok: false, error: 'Use POST.' })
      return
    }

    const body = await readJsonBody(req, PUBLISH_BODY_LIMIT_BYTES)
    if (!body.ok) {
      sendJson(res, body.status, { ok: false, error: body.error })
      return
    }

    try {
      const repoRoot = resolveRepoRoot(defaultRepoRoot)
      const result = pathname === '/api/publish/prepare'
        ? await preparePublish(repoRoot, body.value)
        : await publishImage(repoRoot, body.value)
      sendJson(res, result.status, result.body)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 500, { ok: false, error: `Publish server error: ${message}` })
    }
  }
}

