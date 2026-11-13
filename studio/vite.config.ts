import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { publishPlugin } from './vite-plugin-publish.ts'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const metadataPath = path.join(repoRoot, 'assets-metadata.json')
const publicMetadataPath = path.join(__dirname, 'public', 'assets-metadata.json')

function metadataPlugin(): Plugin {
  return {
    name: 'metadata-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/metadata') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json')
            if (fs.existsSync(metadataPath)) {
              res.end(fs.readFileSync(metadataPath, 'utf-8'))
            } else if (fs.existsSync(publicMetadataPath)) {
              res.end(fs.readFileSync(publicMetadataPath, 'utf-8'))
            } else {
              res.end(JSON.stringify({ version: 1, items: {}, categories: [], updatedAt: new Date().toISOString() }))
            }
            return
          }
          if (req.method === 'POST') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body)
                parsed.updatedAt = new Date().toISOString()
                const formatted = JSON.stringify(parsed, null, 2)
                fs.writeFileSync(metadataPath, formatted, 'utf-8')
                try {
                  fs.writeFileSync(publicMetadataPath, formatted, 'utf-8')
                } catch {
                  // ignore public copy error if any
                }
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true, updatedAt: parsed.updatedAt }))
              } catch (err: unknown) {
                res.statusCode = 500
                const message = err instanceof Error ? err.message : String(err)
                res.end(JSON.stringify({ error: message }))
              }
            })
            return
          }
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), metadataPlugin(), publishPlugin({ repoRoot })],
  server: { port: 5173, strictPort: true },
})
