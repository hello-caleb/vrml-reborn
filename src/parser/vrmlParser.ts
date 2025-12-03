import type { SceneData, Shape } from './types'

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function parseVRML(vrmlText: string): SceneData {
  const shapes: Shape[] = []
  
  // Match Transform nodes with their complete content
  const transformRegex = /Transform\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
  
  let transformMatch
  while ((transformMatch = transformRegex.exec(vrmlText)) !== null) {
    const transformContent = transformMatch[1]
    
    // Extract translation
    const translationMatch = /translation\s+([\d\.\-\s]+)/.exec(transformContent)
    const position: [number, number, number] = translationMatch 
      ? translationMatch[1].trim().split(/\s+/).map(Number).slice(0, 3) as [number, number, number]
      : [0, 0, 0]
    
    // Extract rotation
    const rotationMatch = /rotation\s+([\d\.\-\s]+)/.exec(transformContent)
    const rotation: [number, number, number] | undefined = rotationMatch
      ? rotationMatch[1].trim().split(/\s+/).map(Number).slice(0, 3) as [number, number, number]
      : undefined
    
    // Extract scale
    const scaleMatch = /scale\s+([\d\.\-\s]+)/.exec(transformContent)
    const scale: [number, number, number] | undefined = scaleMatch
      ? scaleMatch[1].trim().split(/\s+/).map(Number).slice(0, 3) as [number, number, number]
      : undefined
    
    // Extract color from Material
    const colorMatch = /diffuseColor\s+([\d\.\s]+)/.exec(transformContent)
    const color = colorMatch
      ? (() => {
          const rgb = colorMatch[1].trim().split(/\s+/).map(Number)
          return rgbToHex(rgb[0] || 0, rgb[1] || 0, rgb[2] || 0)
        })()
      : '#4CC3D9'
    
    // Determine geometry type
    let geometry: Shape['geometry'] = 'box'
    let size: [number, number, number] | undefined
    let radius: number | undefined
    let height: number | undefined
    
    if (/Box\s*\{/.test(transformContent)) {
      geometry = 'box'
      const sizeMatch = /size\s+([\d\.\s]+)/.exec(transformContent)
      if (sizeMatch) {
        const dims = sizeMatch[1].trim().split(/\s+/).map(Number)
        size = [dims[0] || 1, dims[1] || 1, dims[2] || 1]
      }
    } else if (/Sphere\s*\{/.test(transformContent)) {
      geometry = 'sphere'
      const radiusMatch = /radius\s+([\d\.]+)/.exec(transformContent)
      radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
    } else if (/Cylinder\s*\{/.test(transformContent)) {
      geometry = 'cylinder'
      const radiusMatch = /radius\s+([\d\.]+)/.exec(transformContent)
      const heightMatch = /height\s+([\d\.]+)/.exec(transformContent)
      radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
      height = heightMatch ? parseFloat(heightMatch[1]) : 2
    } else if (/Cone\s*\{/.test(transformContent)) {
      geometry = 'cone'
      const radiusMatch = /bottomRadius\s+([\d\.]+)/.exec(transformContent)
      const heightMatch = /height\s+([\d\.]+)/.exec(transformContent)
      radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
      height = heightMatch ? parseFloat(heightMatch[1]) : 2
    }
    
    shapes.push({
      position,
      rotation,
      scale,
      color,
      geometry,
      size,
      radius,
      height
    })
  }
  
  // Fallback: if no shapes found, add a demo cube
  if (shapes.length === 0) {
    shapes.push({ position: [0, 0, 0], color: '#4CC3D9', geometry: 'box' })
  }
  
  return { shapes }
}
