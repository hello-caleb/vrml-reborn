import type { SceneData, Shape } from './types'

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function parseShapeNode(content: string, defaultPosition: [number, number, number] = [0, 0, 0]): Shape | null {
  console.log('  🔎 Parsing shape content (length:', content.length, '):', content.substring(0, 200))
  
  // Extract color from Material (skip DEF names)
  const colorMatch = /diffuseColor\s+([\d\.\s]+)/.exec(content)
  const color = colorMatch
    ? (() => {
        const rgb = colorMatch[1].trim().split(/\s+/).map(Number)
        const hex = rgbToHex(rgb[0] || 0, rgb[1] || 0, rgb[2] || 0)
        console.log('  🎨 Found color:', rgb, '→', hex)
        return hex
      })()
    : '#4CC3D9'
  
  // Determine geometry type - use simpler regex that works across newlines
  let geometry: Shape['geometry'] | null = null
  let size: [number, number, number] | undefined
  let radius: number | undefined
  let height: number | undefined
  
  // Check for Sphere (case-insensitive, handles newlines)
  if (/Sphere/i.test(content)) {
    geometry = 'sphere'
    const radiusMatch = /radius\s+([\d\.]+)/i.exec(content)
    radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
    console.log('  🔵 Sphere detected, radius:', radius)
  } 
  // Check for Box
  else if (/Box/i.test(content)) {
    geometry = 'box'
    const sizeMatch = /size\s+([\d\.\s]+)/i.exec(content)
    if (sizeMatch) {
      const dims = sizeMatch[1].trim().split(/\s+/).map(Number)
      size = [dims[0] || 1, dims[1] || 1, dims[2] || 1]
    }
    console.log('  📦 Box detected, size:', size)
  } 
  // Check for Cylinder
  else if (/Cylinder/i.test(content)) {
    geometry = 'cylinder'
    const radiusMatch = /radius\s+([\d\.]+)/i.exec(content)
    const heightMatch = /height\s+([\d\.]+)/i.exec(content)
    radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
    height = heightMatch ? parseFloat(heightMatch[1]) : 2
    console.log('  🥫 Cylinder detected, radius:', radius, 'height:', height)
  } 
  // Check for Cone
  else if (/Cone/i.test(content)) {
    geometry = 'cone'
    const radiusMatch = /bottomRadius\s+([\d\.]+)/i.exec(content)
    const heightMatch = /height\s+([\d\.]+)/i.exec(content)
    radius = radiusMatch ? parseFloat(radiusMatch[1]) : 1
    height = heightMatch ? parseFloat(heightMatch[1]) : 2
    console.log('  🔺 Cone detected, radius:', radius, 'height:', height)
  }
  
  if (!geometry) {
    console.log('  ❌ No geometry found in content')
    return null
  }
  
  return {
    position: defaultPosition,
    color,
    geometry,
    size,
    radius,
    height
  }
}

export function parseVRML(vrmlText: string): SceneData {
  console.log('🔍 VRML Parser - Input:', vrmlText.substring(0, 200))
  const shapes: Shape[] = []
  
  // Remove DEF keywords to simplify parsing
  const cleanedText = vrmlText.replace(/DEF\s+\w+\s+/g, '')
  console.log('🧹 After removing DEF:', cleanedText.substring(0, 200))
  
  // Match Transform nodes
  const transformRegex = /Transform\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
  let transformMatch
  while ((transformMatch = transformRegex.exec(cleanedText)) !== null) {
    console.log('📦 Found Transform node')
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
    
    const shape = parseShapeNode(transformContent, position)
    if (shape) {
      shape.rotation = rotation
      shape.scale = scale
      shapes.push(shape)
      console.log('✅ Added Transform shape:', shape)
    }
  }
  
  // Match Group nodes (process children like Transform)
  const groupRegex = /Group\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g
  let groupMatch
  while ((groupMatch = groupRegex.exec(cleanedText)) !== null) {
    console.log('👥 Found Group node')
    const groupContent = groupMatch[1]
    const shape = parseShapeNode(groupContent)
    if (shape) {
      shapes.push(shape)
      console.log('✅ Added Group shape:', shape)
    }
  }
  
  // Match standalone Shape nodes - use a better approach for nested braces
  const shapeStarts: number[] = []
  const shapeRegexSimple = /Shape\s*\{/g
  let match
  while ((match = shapeRegexSimple.exec(cleanedText)) !== null) {
    shapeStarts.push(match.index + match[0].length)
  }
  
  for (const startIdx of shapeStarts) {
    // Find matching closing brace by counting braces
    let braceCount = 1
    let endIdx = startIdx
    while (braceCount > 0 && endIdx < cleanedText.length) {
      if (cleanedText[endIdx] === '{') braceCount++
      if (cleanedText[endIdx] === '}') braceCount--
      endIdx++
    }
    
    if (braceCount === 0) {
      console.log('🎨 Found standalone Shape node')
      const shapeContent = cleanedText.substring(startIdx, endIdx - 1)
      const shape = parseShapeNode(shapeContent)
      if (shape) {
        shapes.push(shape)
        console.log('✅ Added standalone shape:', shape)
      }
    }
  }
  
  // Fallback: if no shapes found, add a demo cube
  if (shapes.length === 0) {
    console.log('⚠️ No shapes found, adding fallback cube')
    shapes.push({ position: [0, 0, 0], color: '#4CC3D9', geometry: 'box' })
  }
  
  console.log('🎯 Final parsed shapes:', shapes)
  return { shapes }
}
