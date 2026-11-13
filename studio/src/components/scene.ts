import { CANVAS_H, CANVAS_W, WEBP_QUALITY } from '../shared/studioConfig'
import type { PhotoTransform, WatermarkLayer } from './types'

export interface SceneDoc {
  photo: PhotoTransform | null
  layers: WatermarkLayer[]
}

const cache = new Map<string, HTMLImageElement>()
const pending = new Map<string, Promise<HTMLImageElement | null>>()

export function getCachedImage(src: string): HTMLImageElement | null {
  return cache.get(src) ?? null
}

/** Load once per src and keep the element for every later synchronous draw. */
export function preloadImage(src: string): Promise<HTMLImageElement | null> {
  const cached = cache.get(src)
  if (cached) return Promise.resolve(cached)
  const inFlight = pending.get(src)
  if (inFlight) return inFlight
  const promise = new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      pending.delete(src)
      resolve(img)
    }
    img.onerror = () => {
      pending.delete(src)
      resolve(null)
    }
    img.src = src
  })
  pending.set(src, promise)
  return promise
}

function sceneSources(doc: SceneDoc): string[] {
  const sources = new Set<string>()
  if (doc.photo) sources.add(doc.photo.src)
  for (const layer of doc.layers) if (layer.visible) sources.add(layer.src)
  return [...sources]
}

export async function preloadScene(doc: SceneDoc): Promise<void> {
  await Promise.all(sceneSources(doc).map(preloadImage))
}

/**
 * Draw the whole document synchronously. Preview and export both call this,
 * so the exported WebP is exactly what the canvas shows.
 */
export function drawScene(ctx: CanvasRenderingContext2D, doc: SceneDoc): void {
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  if (doc.photo) {
    const img = getCachedImage(doc.photo.src)
    if (img) ctx.drawImage(img, doc.photo.x, doc.photo.y, doc.photo.width, doc.photo.height)
  }

  for (const layer of doc.layers) {
    if (!layer.visible) continue
    const img = getCachedImage(layer.src)
    if (!img) continue
    ctx.save()
    ctx.globalAlpha = Math.min(1, Math.max(0, layer.opacity))
    ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2)
    ctx.rotate(layer.rotation * Math.PI / 180)
    ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1)
    ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height)
    ctx.restore()
  }

  ctx.restore()
}

/** Encode the document on a fresh offscreen canvas; never touches the preview canvas. */
export async function encodeScene(doc: SceneDoc): Promise<Blob> {
  await preloadScene(doc)
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not create a 2D canvas.')
  drawScene(ctx, doc)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('This browser could not encode the canvas as WebP.'))
    }, 'image/webp', WEBP_QUALITY)
  })
}
