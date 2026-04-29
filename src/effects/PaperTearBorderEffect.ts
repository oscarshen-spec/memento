import type { Point } from '../types'

// Normalized coordinate path (0–1 space).
export type NormalizedPath = Point[]

interface FramePathsInfo {
  totalFrames: number
  paths: NormalizedPath[][]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0x100000000
  }
}

function hashPath(path: NormalizedPath): number {
  let h = 2166136261
  for (const p of path) {
    h = Math.imul(h ^ ((p.x * 1000) | 0), 16777619)
    h = Math.imul(h ^ ((p.y * 1000) | 0), 16777619)
  }
  return h >>> 0
}

function scalePath(path: NormalizedPath, w: number, h: number): Point[] {
  return path.map(p => ({ x: p.x * w, y: p.y * h }))
}

// Multi-frequency jagged polygon: smooth low-frequency backbone + high-frequency roughness.
// Low-freq gives large organic curves; high-freq adds fiber-scale texture.
function buildJaggedPolygon(
  path: Point[],
  amplitude: number,
  rng: () => number,
): Point[] {
  const result: Point[] = []
  const n = path.length

  for (let i = 0; i < n; i++) {
    const from = path[i]
    const to = path[(i + 1) % n]
    const dx = to.x - from.x
    const dy = to.y - from.y
    const segLen = Math.hypot(dx, dy)
    if (segLen < 0.1) continue

    const nx = -dy / segLen
    const ny = dx / segLen
    const steps = Math.max(3, Math.floor(segLen / 5))

    // Pre-generate low-frequency control values for this segment
    const numLfPts = Math.max(2, Math.floor(segLen / 35) + 2)
    const lfValues: number[] = Array.from({ length: numLfPts }, () => (rng() - 0.5) * amplitude * 1.1)

    result.push(from)
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      // Interpolate low-frequency component
      const lfT = t * (numLfPts - 1)
      const lfIdx = Math.floor(lfT)
      const lfFrac = lfT - lfIdx
      const lf =
        lfValues[Math.min(lfIdx, numLfPts - 1)] * (1 - lfFrac) +
        lfValues[Math.min(lfIdx + 1, numLfPts - 1)] * lfFrac
      // High-frequency fiber roughness
      const hf = (rng() - 0.5) * amplitude * 0.28
      result.push({
        x: from.x + dx * t + nx * (lf + hf),
        y: from.y + dy * t + ny * (lf + hf),
      })
    }
  }

  return result
}

// Build an outer fringe path that extends beyond the inner jagged polygon.
// The push distance varies in a low-frequency wave so the paper width looks organic.
function buildOuterFringePath(
  jaggedPoly: Point[],
  amplitude: number,
  rng: () => number,
): Point[] {
  const n = jaggedPoly.length
  if (n === 0) return []

  const cx = jaggedPoly.reduce((s, p) => s + p.x, 0) / n
  const cy = jaggedPoly.reduce((s, p) => s + p.y, 0) / n

  const numLfSamples = Math.max(4, Math.floor(n / 10))
  const lfPush: number[] = Array.from({ length: numLfSamples }, () => rng())

  return jaggedPoly.map((p, i) => {
    // Outward unit vector from centroid
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy)
    const ox = len > 0 ? dx / len : 1
    const oy = len > 0 ? dy / len : 0

    // Low-frequency variable push (0.8× to 1.8× amplitude)
    const lfT = (i / n) * numLfSamples
    const lfIdx = Math.floor(lfT) % numLfSamples
    const lfFrac = lfT - Math.floor(lfT)
    const lf = lfPush[lfIdx] * (1 - lfFrac) + lfPush[(lfIdx + 1) % numLfSamples] * lfFrac
    const push = amplitude * (0.8 + lf * 1.0)

    // High-frequency perpendicular jitter for fiber texture
    const next = jaggedPoly[(i + 1) % n]
    const prev = jaggedPoly[(i - 1 + n) % n]
    const tdx = next.x - prev.x
    const tdy = next.y - prev.y
    const tlen = Math.hypot(tdx, tdy)
    const tnx = tlen > 0 ? -tdy / tlen : 0
    const tny = tlen > 0 ? tdx / tlen : 0
    const jitter = (rng() - 0.5) * amplitude * 0.75

    return {
      x: p.x + ox * push + tnx * jitter,
      y: p.y + oy * push + tny * jitter,
    }
  })
}

// Append a smooth quadratic bezier path to an existing context path (no beginPath).
function appendSmoothPath(ctx: CanvasRenderingContext2D, points: Point[], close: boolean): void {
  if (points.length < 2) return
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
  }
  if (close) ctx.closePath()
}

// Continue a smooth path from the current position (lineTo first point, then quadratic).
function continueSmoothPath(ctx: CanvasRenderingContext2D, points: Point[], close: boolean): void {
  if (points.length < 1) return
  ctx.lineTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
  }
  if (close) ctx.closePath()
}

// Build a repeating paper-grain tile: fine noise pixels + short horizontal fiber scratches.
function buildPaperGrainPattern(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
): CanvasPattern | null {
  const size = 96
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const tctx = tile.getContext('2d')!

  // Fine grain noise via ImageData
  const id = tctx.createImageData(size, size)
  const d = id.data
  for (let i = 0; i < size * size; i++) {
    const r = rng()
    if (r < 0.07) {
      const idx = i * 4
      const darkness = (r * 320) | 0          // 0–22 range
      const alpha = (rng() * 90 + 20) | 0     // 20–110
      d[idx]     = 210 - darkness
      d[idx + 1] = 204 - darkness
      d[idx + 2] = 190 - darkness
      d[idx + 3] = alpha
    } else if (r < 0.074) {
      const idx = i * 4                        // rare darker fiber dot
      d[idx]     = 168
      d[idx + 1] = 158
      d[idx + 2] = 140
      d[idx + 3] = (rng() * 45 + 10) | 0
    }
  }
  tctx.putImageData(id, 0, 0)

  // Short horizontal fiber scratches layered on top
  tctx.save()
  tctx.lineCap = 'round'
  const numFibers = 10
  for (let f = 0; f < numFibers; f++) {
    const y = rng() * size
    const x0 = rng() * size
    const len = 8 + rng() * 22
    const alpha = (0.06 + rng() * 0.11).toFixed(2)
    tctx.strokeStyle = `rgba(170,158,138,${alpha})`
    tctx.lineWidth = 0.35 + rng() * 0.45
    tctx.beginPath()
    tctx.moveTo(x0, y)
    tctx.lineTo(x0 + len, y + (rng() - 0.5) * 1.8)
    tctx.stroke()
  }
  tctx.restore()

  return ctx.createPattern(tile, 'repeat')
}

// Retain the single-path beginPath version for clip operations.
function traceJaggedPolygon(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length < 2) return
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i]
    ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
  }
  ctx.closePath()
}

// Draw short fiber strands radiating outward from the torn paper edge.
// cx/cy is the image centroid — fibers extend away from it.
function drawPaperFibers(
  ctx: CanvasRenderingContext2D,
  outerEdge: Point[],
  cx: number,
  cy: number,
  amplitude: number,
  rng: () => number,
): void {
  const n = outerEdge.length
  ctx.save()
  ctx.lineCap = 'round'

  for (let i = 0; i < n; i++) {
    if (rng() > 0.32) continue // ~32% density

    const p = outerEdge[i]
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy)
    if (len < 0.1) continue
    const ox = dx / len
    const oy = dy / len

    // Random angular variation ±25°
    const angle = (rng() - 0.5) * 0.88
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const fx = ox * cos - oy * sin
    const fy = ox * sin + oy * cos

    const fiberLen = amplitude * (0.3 + rng() * 0.65)
    const alpha = 0.4 + rng() * 0.5
    ctx.strokeStyle = `rgba(255, 252, 248, ${alpha.toFixed(2)})`
    ctx.lineWidth = 0.4 + rng() * 0.9

    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + fx * fiberLen, p.y + fy * fiberLen)
    ctx.stroke()
  }
  ctx.restore()
}

// Draw fibers along an open tear-edge side, extending in the given normal direction.
function drawTearEdgeFibers(
  ctx: CanvasRenderingContext2D,
  sideEdge: Point[],
  normals: { nx: number; ny: number }[],
  outwardSign: 1 | -1,
  amplitude: number,
  rng: () => number,
): void {
  const n = sideEdge.length
  ctx.save()
  ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    if (rng() > 0.3) continue
    const p = sideEdge[i]
    const norm = normals[Math.min(i, normals.length - 1)]
    const ox = norm.nx * outwardSign
    const oy = norm.ny * outwardSign
    const angle = (rng() - 0.5) * 0.88
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const fx = ox * cos - oy * sin
    const fy = ox * sin + oy * cos
    const fiberLen = amplitude * (0.3 + rng() * 0.65)
    const alpha = 0.4 + rng() * 0.5
    ctx.strokeStyle = `rgba(255, 252, 248, ${alpha.toFixed(2)})`
    ctx.lineWidth = 0.4 + rng() * 0.9
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + fx * fiberLen, p.y + fy * fiberLen)
    ctx.stroke()
  }
  ctx.restore()
}

// ─── RippedPaperEffect ────────────────────────────────────────────────────────
//
// Renders a realistic torn-paper border by:
//  1. Filling the ring between an inner jagged clip edge and a variable-width outer fringe path
//  2. Clipping and drawing the source image inside the inner edge
//  3. Adding fiber strands on the outer fringe boundary

interface RippedPaperParams {
  paths: NormalizedPath[]
  seed?: number
}

class RippedPaperEffect {
  private readonly paths: NormalizedPath[]
  private readonly seed: number

  constructor({ paths, seed = 42 }: RippedPaperParams) {
    this.paths = paths
    this.seed = seed
  }

  apply(src: HTMLCanvasElement): HTMLCanvasElement {
    const { width: w, height: h } = src
    const amplitude = Math.max(Math.min(w, h) * 0.030, 10)
    const pad = Math.ceil(amplitude * 4)

    const rng = seededRand(this.seed)
    const jaggedPolygons = this.paths.map(path =>
      buildJaggedPolygon(scalePath(path, w, h), amplitude, rng),
    )
    const outerPaths = jaggedPolygons.map(poly =>
      buildOuterFringePath(poly, amplitude, rng),
    )

    const out = document.createElement('canvas')
    out.width = w + pad * 2
    out.height = h + pad * 2
    const ctx = out.getContext('2d')!

    ctx.save()
    ctx.translate(pad, pad)

    // Pass 1: Fill the paper fringe ring (outer path - inner path) with drop shadow.
    // evenodd fill rule creates the ring: filled between outer and inner, transparent inside inner.
    for (let i = 0; i < jaggedPolygons.length; i++) {
      const inner = jaggedPolygons[i]
      const outer = outerPaths[i]
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.52)'
      ctx.shadowBlur = amplitude * 1.5
      ctx.beginPath()
      appendSmoothPath(ctx, outer, true)
      appendSmoothPath(ctx, [...inner].reverse(), true)
      ctx.fillStyle = 'rgba(252, 248, 242, 0.97)'
      ctx.fill('evenodd')
      ctx.restore()

      // Pass 1.5: Paper grain texture overlay on the fringe ring
      const grainPattern = buildPaperGrainPattern(ctx, seededRand(this.seed ^ (0xf00dcafe + i)))
      if (grainPattern) {
        ctx.save()
        ctx.beginPath()
        appendSmoothPath(ctx, outer, true)
        appendSmoothPath(ctx, [...inner].reverse(), true)
        ctx.clip('evenodd')
        ctx.fillStyle = grainPattern
        ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2)
        ctx.restore()
      }
    }

    // Pass 2: Clip and draw source image inside the inner jagged polygon.
    // This covers any shadow bleed into the image area.
    ctx.save()
    for (const pts of jaggedPolygons) traceJaggedPolygon(ctx, pts)
    ctx.clip()
    ctx.drawImage(src, 0, 0)
    ctx.restore()

    // Pass 3: Fiber strands on outer fringe boundary.
    const rng2 = seededRand(this.seed ^ 0xdeadbeef)
    for (let i = 0; i < outerPaths.length; i++) {
      const cx = jaggedPolygons[i].reduce((s, p) => s + p.x, 0) / jaggedPolygons[i].length
      const cy = jaggedPolygons[i].reduce((s, p) => s + p.y, 0) / jaggedPolygons[i].length
      drawPaperFibers(ctx, outerPaths[i], cx, cy, amplitude, rng2)
    }

    ctx.restore()
    return out
  }
}

// ─── PaperTearBorderEffect ────────────────────────────────────────────────────

export class PaperTearBorderEffect {
  readonly identifier = 'PaperTearBorderEffect'
  readonly maskPoints: NormalizedPath[] | null

  get cacheIdentifier(): string {
    if (this.maskPoints?.length) {
      const key = this.maskPoints
        .flat()
        .map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
        .join('|')
      return `${this.identifier}_${key}`
    }
    return this.identifier
  }

  constructor(maskPoints: NormalizedPath[] | null = null) {
    this.maskPoints = maskPoints
  }

  makeEffects(): RippedPaperEffect[] {
    const paths = this.maskPoints ?? [PaperTearBorderEffect.makeDefaultMask()]
    const pathInfo: FramePathsInfo = { totalFrames: 1, paths: [paths] }
    const seed = paths.reduce((acc, path) => acc ^ hashPath(path), 0)
    return [new RippedPaperEffect({ paths: pathInfo.paths[0], seed })]
  }

  async processImage(source: HTMLCanvasElement | string): Promise<string> {
    const canvas =
      typeof source === 'string' ? await loadImageAsCanvas(source) : source
    let result: HTMLCanvasElement = canvas
    for (const effect of this.makeEffects()) {
      result = effect.apply(result)
    }
    return result.toDataURL('image/png')
  }

  static makeDefaultMask(): NormalizedPath {
    return [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]
  }
}

// ─── applyTornEdgeFringe ──────────────────────────────────────────────────────
//
// Renders a paper fringe band along an open tear-edge path (for two-piece tears).
// Builds two offset paths on either side of the tear line, fills the band between them,
// draws the source image on top, then adds fiber strands on both outer boundaries.

export function applyTornEdgeFringe(
  src: HTMLCanvasElement,
  tearEdge: Point[],
): HTMLCanvasElement {
  const { width: w, height: h } = src
  const amplitude = Math.max(Math.min(w, h) * 0.030, 10)

  // Per-point normals along the tear path (perpendicular direction)
  const normals = tearEdge.map((_, i) => {
    const prev = tearEdge[Math.max(0, i - 1)]
    const next = tearEdge[Math.min(tearEdge.length - 1, i + 1)]
    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.hypot(dx, dy)
    if (len < 0.001) return { nx: 0, ny: 1 }
    return { nx: -dy / len, ny: dx / len }
  })

  // Deterministic seed from tear edge geometry
  const seed = tearEdge.reduce((h, p) => {
    h = Math.imul(h ^ ((p.x * 100) | 0), 16777619)
    h = Math.imul(h ^ ((p.y * 100) | 0), 16777619)
    return h >>> 0
  }, 2166136261)
  const rng = seededRand(seed)

  // Low-frequency push variation for each side
  const numLfSamples = Math.max(4, Math.floor(tearEdge.length / 8))
  const lfA: number[] = Array.from({ length: numLfSamples }, () => rng())
  const lfB: number[] = Array.from({ length: numLfSamples }, () => rng())

  const buildSide = (lfTable: number[], sign: 1 | -1): Point[] =>
    tearEdge.map((p, i) => {
      const { nx, ny } = normals[i]
      const lfT = (i / Math.max(1, tearEdge.length - 1)) * (numLfSamples - 1)
      const lfIdx = Math.min(Math.floor(lfT), numLfSamples - 2)
      const lfFrac = lfT - lfIdx
      const lf = lfTable[lfIdx] * (1 - lfFrac) + lfTable[lfIdx + 1] * lfFrac
      const push = amplitude * (0.6 + lf * 0.8)
      const hf = (rng() - 0.5) * amplitude * 0.40
      return {
        x: p.x + nx * push * sign + -ny * hf,
        y: p.y + ny * push * sign + nx * hf,
      }
    })

  const sideA = buildSide(lfA, 1)
  const sideB = buildSide(lfB, -1)

  // Canvas is expanded by pad on all sides so the fringe band can extend outward
  // from the torn edge. The reduced amplitude keeps this expansion modest.
  const pad = Math.ceil(amplitude * 4)
  const out = document.createElement('canvas')
  out.width = w + pad * 2
  out.height = h + pad * 2
  const ctx = out.getContext('2d')!

  ctx.save()
  ctx.translate(pad, pad)

  // Pass 1: Fill paper band with drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.48)'
  ctx.shadowBlur = amplitude * 1.4
  ctx.beginPath()
  appendSmoothPath(ctx, sideA, false)
  continueSmoothPath(ctx, [...sideB].reverse(), true)
  ctx.fillStyle = 'rgba(252, 248, 242, 0.97)'
  ctx.fill()
  ctx.restore()

  // Pass 1.5: Paper grain texture overlay on the fringe band
  const grainPattern = buildPaperGrainPattern(ctx, seededRand(seed ^ 0xf00dcafe))
  if (grainPattern) {
    ctx.save()
    ctx.beginPath()
    appendSmoothPath(ctx, sideA, false)
    continueSmoothPath(ctx, [...sideB].reverse(), true)
    ctx.clip()
    ctx.fillStyle = grainPattern
    ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2)
    ctx.restore()
  }

  // Pass 2: Draw source image on top (covers band where image content exists)
  ctx.drawImage(src, 0, 0)

  // Pass 3: Fiber strands on both outer edges
  const rng2 = seededRand(seed ^ 0xabcdef01)
  drawTearEdgeFibers(ctx, sideA, normals, 1, amplitude, rng2)
  const rng3 = seededRand(seed ^ 0x12345678)
  drawTearEdgeFibers(ctx, sideB, normals, -1, amplitude, rng3)

  ctx.restore()
  return out
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function loadImageAsCanvas(src: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}
