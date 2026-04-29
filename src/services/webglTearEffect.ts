import type { Point } from '../types'

// Lazy-loaded engine singleton — created on first use to avoid WebGL context overhead at startup
let enginePromise: Promise<import('../effects/webgl/FilterEngine.js').default> | null = null

async function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const [
        { default: FilterEngine },
        { default: maskSmoother },
        { default: dilation },
        { default: paperTearMaskGenerator },
        { default: irregularEdge },
        { default: paperTearCombine },
        { default: paperTearWithMask },
      ] = await Promise.all([
        import('../effects/webgl/FilterEngine.js'),
        import('../effects/webgl/filters/maskSmoother.js'),
        import('../effects/webgl/filters/dilation.js'),
        import('../effects/webgl/filters/paperTearMaskGenerator.js'),
        import('../effects/webgl/filters/irregularEdge.js'),
        import('../effects/webgl/filters/paperTearCombine.js'),
        import('../effects/webgl/presets/paperTearWithMask.js'),
      ])

      const engine = new FilterEngine()
      engine.registerFilters({
        'Mask Smoother': maskSmoother,
        'Dilation': dilation,
        'Paper Tear Mask Generator': paperTearMaskGenerator,
        'Irregular Edge': irregularEdge,
        'Paper Tear Combine': paperTearCombine,
      })
      engine.registerPreset('Paper Tear With Mask', paperTearWithMask)
      return engine
    })()
  }
  return enginePromise
}

/** Rasterize a polygon into a mask canvas (white-filled on transparent). */
function polygonToMask(polygon: Point[], width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.fillStyle = 'white'
  ctx.fill()
  return canvas
}

/**
 * Apply the WebGL paper-tear border effect to an already-cropped piece canvas.
 *
 * @param srcCanvas  Canvas containing the clipped polygon piece (bboxW × bboxH)
 * @param polygon    The polygon points in the canvas's local coordinate space
 * @param paperColor RGBA hex color for the paper fringe, default warm white
 */
export async function applyWebGLPaperTear(
  srcCanvas: HTMLCanvasElement,
  polygon: Point[],
  paperColor = '#F2F2F2FF',
): Promise<string> {
  const engine = await getEngine()
  const maskCanvas = polygonToMask(polygon, srcCanvas.width, srcCanvas.height)

  return engine.applyPreset(srcCanvas, 'Paper Tear With Mask', {
    additionalTextures: [maskCanvas],
    backgroundColor: '#00000000',
    paperColor,
    maxDimension: Math.max(srcCanvas.width, srcCanvas.height),
  })
}

/**
 * Crop the source image to the polygon's bounding box, then apply the WebGL
 * paper-tear effect. Returns a base64 data-URL of the result.
 *
 * Coordinates in `polygon` must be in the source image's pixel space.
 */
export async function bakePaperTearPiece(
  srcImage: HTMLImageElement,
  polygon: Point[],
): Promise<string> {
  const xs = polygon.map(p => p.x)
  const ys = polygon.map(p => p.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const bboxW = (Math.max(...xs) - minX) || 1
  const bboxH = (Math.max(...ys) - minY) || 1

  // Crop image to bounding box, clipped to polygon
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = bboxW
  srcCanvas.height = bboxH
  const ctx = srcCanvas.getContext('2d')!
  ctx.save()
  ctx.beginPath()
  polygon.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x - minX, p.y - minY) : ctx.lineTo(p.x - minX, p.y - minY)))
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(srcImage, -minX, -minY)
  ctx.restore()

  const localPolygon = polygon.map(p => ({ x: p.x - minX, y: p.y - minY }))
  return applyWebGLPaperTear(srcCanvas, localPolygon)
}
