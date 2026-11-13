import { CANVAS_H, CANVAS_W } from '../shared/studioConfig'
import type { PhotoTransform, WatermarkLayer } from './types'

export type HandleId = 'tl' | 'tm' | 'tr' | 'ml' | 'mr' | 'bl' | 'bm' | 'br' | 'rot'
export type DragHandle = HandleId | 'move' | 'photo'

export const MIN_LAYER_SIZE = 20
export const PHOTO_EDGE_VISIBLE = 40
export const ROTATION_HANDLE_OFFSET_PX = 28
export const HANDLE_HIT_RADIUS_PX = 12
export const HANDLE_SIZE_PX = 8
/** Below this on-screen size the handles would cover the body, so Select mode must move instead. */
export const MIN_HANDLE_LAYER_SCREEN_PX = 36
export const PHOTO_SCALE_MIN = 5
export const PHOTO_SCALE_MAX = 500

export interface Vec {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** rotate a local offset by `deg` degrees clockwise (canvas y points down). */
export function rotateVec(x: number, y: number, deg: number): Vec {
  const rad = deg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

/** Normalize an angle in degrees to (-180, 180]. */
export function normalizeAngle(deg: number): number {
  const wrapped = ((deg % 360) + 540) % 360 - 180
  return wrapped === -180 ? 180 : wrapped
}

export function layerCentre(layer: WatermarkLayer): Vec {
  return { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 }
}

/** Convert a canvas-space point into the layer's unrotated local frame. */
export function pointToLayerLocal(point: Vec, layer: WatermarkLayer): Vec {
  const centre = layerCentre(layer)
  return rotateVec(point.x - centre.x, point.y - centre.y, -layer.rotation)
}

export function pointInLayer(point: Vec, layer: WatermarkLayer): boolean {
  const local = pointToLayerLocal(point, layer)
  return Math.abs(local.x) <= layer.width / 2 && Math.abs(local.y) <= layer.height / 2
}

export function pointInRect(point: Vec, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
}

export function handleSigns(handle: HandleId): { sx: number; sy: number } {
  switch (handle) {
    case 'tl': return { sx: -1, sy: -1 }
    case 'tm': return { sx: 0, sy: -1 }
    case 'tr': return { sx: 1, sy: -1 }
    case 'ml': return { sx: -1, sy: 0 }
    case 'mr': return { sx: 1, sy: 0 }
    case 'bl': return { sx: -1, sy: 1 }
    case 'bm': return { sx: 0, sy: 1 }
    case 'br': return { sx: 1, sy: 1 }
    default:   return { sx: 0, sy: 0 }
  }
}

/** Handle position in the layer's local frame; `rotOffset` is in canvas units. */
export function handleLocalPoint(handle: HandleId, layer: WatermarkLayer, rotOffset: number): Vec {
  const { sx, sy } = handleSigns(handle)
  if (handle === 'rot') return { x: 0, y: -layer.height / 2 - rotOffset }
  return { x: sx * layer.width / 2, y: sy * layer.height / 2 }
}

/** Handle position in canvas space, rotated with the layer. */
export function handleWorldPoint(handle: HandleId, layer: WatermarkLayer, rotOffset: number): Vec {
  const local = handleLocalPoint(handle, layer, rotOffset)
  const centre = layerCentre(layer)
  const rotated = rotateVec(local.x, local.y, layer.rotation)
  return { x: centre.x + rotated.x, y: centre.y + rotated.y }
}

/** `screenScale` is display px per canvas unit (k). Hit radius is 12 screen px. */
export function hitTestHandle(point: Vec, layer: WatermarkLayer, screenScale: number): HandleId | null {
  if (!(screenScale > 0)) return null
  const unitPx = 1 / screenScale
  const hitRadius = HANDLE_HIT_RADIUS_PX * unitPx
  const rotOffset = ROTATION_HANDLE_OFFSET_PX * unitPx
  const handles: HandleId[] = ['rot', 'tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br']
  for (const handle of handles) {
    const world = handleWorldPoint(handle, layer, rotOffset)
    if (Math.hypot(point.x - world.x, point.y - world.y) <= hitRadius) return handle
  }
  return null
}

/** Rotated resize from the pointerdown snapshot. */
export function resizeLayerFromSnapshot(start: WatermarkLayer, handle: HandleId, point: Vec, shift: boolean): Rect {
  const { sx, sy } = handleSigns(handle)
  const theta = start.rotation
  const w0 = start.width
  const h0 = start.height
  const centre0 = layerCentre(start)
  const local = rotateVec(point.x - centre0.x, point.y - centre0.y, -theta)
  const anchor = { x: -sx * w0 / 2, y: -sy * h0 / 2 }
  let newW = sx === 0 ? w0 : Math.max(MIN_LAYER_SIZE, sx * (local.x - anchor.x))
  let newH = sy === 0 ? h0 : Math.max(MIN_LAYER_SIZE, sy * (local.y - anchor.y))
  // Lock aspect: on when layer.lockAspect is true; shift inverts that for the gesture.
  const locked = (start.lockAspect ? !shift : shift) && w0 > 0 && h0 > 0
  if (locked) {
    if (sx === 0) {
      // Top/bottom edge: the dragged height sets the width, centred on the same vertical axis.
      newW = Math.max(MIN_LAYER_SIZE, newH * w0 / h0)
    } else if (sy === 0) {
      // Left/right edge: the dragged width sets the height, centred on the same horizontal axis.
      newH = Math.max(MIN_LAYER_SIZE, newW * h0 / w0)
    } else {
      // Corner: the axis the pointer travelled further along wins.
      const dominateW = Math.abs(sx * (local.x - anchor.x)) >= Math.abs(sy * (local.y - anchor.y))
      if (dominateW) newH = Math.max(MIN_LAYER_SIZE, newW * h0 / w0)
      else newW = Math.max(MIN_LAYER_SIZE, newH * w0 / h0)
    }
  }
  const centreLocal = { x: anchor.x + sx * newW / 2, y: anchor.y + sy * newH / 2 }
  const rotated = rotateVec(centreLocal.x, centreLocal.y, theta)
  const centre1 = { x: centre0.x + rotated.x, y: centre0.y + rotated.y }
  return { x: centre1.x - newW / 2, y: centre1.y - newH / 2, width: newW, height: newH }
}

/** Delta-based rotation from the pointerdown snapshot (no jump on grab). */
export function rotationFromSnapshot(start: WatermarkLayer, from: Vec, to: Vec, shift: boolean): number {
  const centre0 = layerCentre(start)
  const a0 = Math.atan2(from.y - centre0.y, from.x - centre0.x)
  const a = Math.atan2(to.y - centre0.y, to.x - centre0.x)
  const delta = ((a - a0) * 180 / Math.PI + 540) % 360 - 180
  let theta = start.rotation + delta
  if (shift) theta = Math.round(theta / 15) * 15
  return normalizeAngle(theta)
}

export function coverPlacement(naturalWidth: number, naturalHeight: number): Rect {
  const natW = naturalWidth > 0 ? naturalWidth : CANVAS_W
  const natH = naturalHeight > 0 ? naturalHeight : CANVAS_H
  const k = Math.max(CANVAS_W / natW, CANVAS_H / natH)
  const width = natW * k
  const height = natH * k
  return { x: (CANVAS_W - width) / 2, y: (CANVAS_H - height) / 2, width, height }
}

export function containPlacement(naturalWidth: number, naturalHeight: number): Rect {
  const natW = naturalWidth > 0 ? naturalWidth : CANVAS_W
  const natH = naturalHeight > 0 ? naturalHeight : CANVAS_H
  const k = Math.min(CANVAS_W / natW, CANVAS_H / natH)
  const width = natW * k
  const height = natH * k
  return { x: (CANVAS_W - width) / 2, y: (CANVAS_H - height) / 2, width, height }
}

/** Keep at least 40 px of the photo inside the document on each axis. */
export function clampPhotoPosition(rect: Rect): Vec {
  return {
    x: Math.min(Math.max(rect.x, PHOTO_EDGE_VISIBLE - rect.width), CANVAS_W - PHOTO_EDGE_VISIBLE),
    y: Math.min(Math.max(rect.y, PHOTO_EDGE_VISIBLE - rect.height), CANVAS_H - PHOTO_EDGE_VISIBLE),
  }
}

function coverScale(photo: PhotoTransform): number {
  const natW = photo.naturalWidth > 0 ? photo.naturalWidth : CANVAS_W
  const natH = photo.naturalHeight > 0 ? photo.naturalHeight : CANVAS_H
  return Math.max(CANVAS_W / natW, CANVAS_H / natH)
}

/** Scale in percent, where 100% is the cover fit (the "Fill" placement). */
export function photoScalePercent(photo: PhotoTransform): number {
  const naturalWidth = photo.naturalWidth > 0 ? photo.naturalWidth : CANVAS_W
  const fillWidth = naturalWidth * coverScale(photo)
  if (!(fillWidth > 0)) return 100
  return photo.width / fillWidth * 100
}

export function scalePhotoTo(photo: PhotoTransform, percent: number): PhotoTransform {
  if (!Number.isFinite(percent)) return photo
  const clampedPercent = Math.min(PHOTO_SCALE_MAX, Math.max(PHOTO_SCALE_MIN, percent))
  const k = coverScale(photo) * clampedPercent / 100
  const width = (photo.naturalWidth > 0 ? photo.naturalWidth : CANVAS_W) * k
  const height = (photo.naturalHeight > 0 ? photo.naturalHeight : CANVAS_H) * k
  const centre = { x: photo.x + photo.width / 2, y: photo.y + photo.height / 2 }
  const next = { ...photo, width, height, x: centre.x - width / 2, y: centre.y - height / 2 }
  const clamped = clampPhotoPosition(next)
  return { ...next, x: clamped.x, y: clamped.y }
}

export function clampRotation(deg: number): number {
  return normalizeAngle(deg)
}
