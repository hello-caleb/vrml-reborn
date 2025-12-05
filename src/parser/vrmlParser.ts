import type { SceneData, Shape } from './types'
import { ProtoRegistry, extractProtoBlocks, expandAllProtos } from './protoParser'

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
  
  // Extract emissive color (for glowing materials)
  const emissiveMatch = /emissiveColor\s+([\d\.\s]+)/.exec(content)
  const emissiveColor = emissiveMatch
    ? (() => {
        const rgb = emissiveMatch[1].trim().split(/\s+/).map(Number)
        const hex = rgbToHex(rgb[0] || 0, rgb[1] || 0, rgb[2] || 0)
        console.log('  ✨ Found emissiveColor:', rgb, '→', hex)
        return hex
      })()
    : undefined
  
  // Extract transparency (0 = opaque, 1 = invisible)
  const transparencyMatch = /transparency\s+([\d\.]+)/.exec(content)
  const transparency = transparencyMatch ? parseFloat(transparencyMatch[1]) : undefined
  if (transparency !== undefined) {
    console.log('  👻 Found transparency:', transparency)
  }
  
  // Determine geometry type - use simpler regex that works across newlines
  let geometry: Shape['geometry'] | null = null
  let size: [number, number, number] | undefined
  let radius: number | undefined
  let height: number | undefined
  
  // Check for IndexedLineSet (wireframe/lines)
  if (/IndexedLineSet/i.test(content)) {
    geometry = 'lines'
    
    // Parse vertices from coord Coordinate { point [...] }
    const pointMatch = /point\s*\[([\s\S]*?)\]/i.exec(content)
    let vertices: number[] = []
    if (pointMatch) {
      const pointStr = pointMatch[1].replace(/,/g, ' ')
      vertices = pointStr.trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
      console.log('  📐 Found', vertices.length / 3, 'vertices for lines')
    }
    
    // Parse line indices from coordIndex [...]
    const indexMatch = /coordIndex\s*\[([\s\S]*?)\]/i.exec(content)
    let indices: number[] = []
    if (indexMatch) {
      const indexStr = indexMatch[1].replace(/,/g, ' ')
      const rawIndices = indexStr.trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
      
      // Convert VRML line format to line segments
      // VRML uses -1 to separate line strips
      let currentStrip: number[] = []
      for (const idx of rawIndices) {
        if (idx === -1) {
          // Connect vertices in the strip
          for (let i = 0; i < currentStrip.length - 1; i++) {
            indices.push(currentStrip[i], currentStrip[i + 1])
          }
          currentStrip = []
        } else {
          currentStrip.push(idx)
        }
      }
      console.log('  📏 Generated', indices.length / 2, 'line segments')
    }
    
    return {
      position: defaultPosition,
      color,
      emissiveColor,
      transparency,
      geometry: 'lines',
      vertices,
      indices
    }
  }
  // Check for IndexedFaceSet (custom mesh)
  else if (/IndexedFaceSet/i.test(content)) {
    geometry = 'mesh'
    
    // Parse vertices from coord Coordinate { point [...] }
    const pointMatch = /point\s*\[([\s\S]*?)\]/i.exec(content)
    let vertices: number[] = []
    if (pointMatch) {
      const pointStr = pointMatch[1].replace(/,/g, ' ')
      vertices = pointStr.trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
      console.log('  📐 Found', vertices.length / 3, 'vertices')
    }
    
    // Parse face indices from coordIndex [...]
    const indexMatch = /coordIndex\s*\[([\s\S]*?)\]/i.exec(content)
    let indices: number[] = []
    if (indexMatch) {
      const indexStr = indexMatch[1].replace(/,/g, ' ')
      const rawIndices = indexStr.trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
      
      // Convert VRML face format to triangles
      // VRML uses -1 to separate faces, faces can be quads or polygons
      let currentFace: number[] = []
      for (const idx of rawIndices) {
        if (idx === -1) {
          // Triangulate the face
          if (currentFace.length >= 3) {
            // Simple fan triangulation
            for (let i = 1; i < currentFace.length - 1; i++) {
              indices.push(currentFace[0], currentFace[i], currentFace[i + 1])
            }
          }
          currentFace = []
        } else {
          currentFace.push(idx)
        }
      }
      console.log('  🔺 Generated', indices.length / 3, 'triangles')
    }
    
    return {
      position: defaultPosition,
      color,
      emissiveColor,
      transparency,
      geometry: 'mesh',
      vertices,
      indices
    }
  }
  // Check for Sphere (case-insensitive, handles newlines)
  else if (/Sphere/i.test(content)) {
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
    emissiveColor,
    transparency,
    geometry,
    size,
    radius,
    height
  }
}

export function parseVRML(vrmlText: string): SceneData {
  console.log('🔍 VRML Parser - Input:', vrmlText.substring(0, 200))
  const shapes: Shape[] = []
  
  // PROTO Preprocessing Step (Requirements 5.1, 5.2, 5.3, 5.4, 6.3)
  // Create a PROTO registry for this parse operation
  const protoRegistry = new ProtoRegistry()
  
  try {
    // Step 1: Extract and register all PROTO definitions
    console.log('🔧 Step 1: Extracting PROTO definitions...')
    const { protos, cleanedText: textWithoutProtos } = extractProtoBlocks(vrmlText)
    
    // Register all extracted PROTOs
    for (const proto of protos) {
      protoRegistry.register(proto.name, proto)
    }
    
    console.log(`✅ Registered ${protos.length} PROTO definition(s)`)
    
    // Step 2: Expand all PROTO instances
    console.log('🔧 Step 2: Expanding PROTO instances...')
    const expandedText = expandAllProtos(textWithoutProtos, protoRegistry)
    
    // Use the expanded text for parsing
    vrmlText = expandedText
    console.log('✅ PROTO preprocessing complete')
  } catch (error) {
    console.error('❌ Error during PROTO preprocessing:', error)
    console.log('ℹ️ Continuing with original text')
    // Continue with original text if PROTO preprocessing fails
  }
  
  // Remove DEF keywords to simplify parsing
  const cleanedText = vrmlText.replace(/DEF\s+\w+\s+/g, '')
  console.log('🧹 After removing DEF:', cleanedText.substring(0, 200))
  
  // Match Transform nodes - use brace counting for proper nesting
  const transformStarts: number[] = []
  const transformRegexSimple = /Transform\s*\{/g
  let transformMatch
  while ((transformMatch = transformRegexSimple.exec(cleanedText)) !== null) {
    transformStarts.push(transformMatch.index + transformMatch[0].length)
  }
  
  for (const startIdx of transformStarts) {
    // Find matching closing brace by counting braces
    let braceCount = 1
    let endIdx = startIdx
    while (braceCount > 0 && endIdx < cleanedText.length) {
      if (cleanedText[endIdx] === '{') braceCount++
      if (cleanedText[endIdx] === '}') braceCount--
      endIdx++
    }
    
    if (braceCount === 0) {
      console.log('📦 Found Transform node')
      const transformContent = cleanedText.substring(startIdx, endIdx - 1)
      
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
      
      // Extract the Shape node from children
      const shapeMatch = /Shape\s*\{/i.exec(transformContent)
      if (shapeMatch) {
        const shapeStartIdx = shapeMatch.index + shapeMatch[0].length
        let shapeBraceCount = 1
        let shapeEndIdx = shapeStartIdx
        while (shapeBraceCount > 0 && shapeEndIdx < transformContent.length) {
          if (transformContent[shapeEndIdx] === '{') shapeBraceCount++
          if (transformContent[shapeEndIdx] === '}') shapeBraceCount--
          shapeEndIdx++
        }
        
        if (shapeBraceCount === 0) {
          const shapeContent = transformContent.substring(shapeStartIdx, shapeEndIdx - 1)
          console.log('  📝 Extracted Shape content from Transform:', shapeContent.substring(0, 150))
          const shape = parseShapeNode(shapeContent, position)
          if (shape) {
            shape.rotation = rotation
            shape.scale = scale
            shapes.push(shape)
            console.log('✅ Added Transform shape:', shape)
          }
        }
      }
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
  let shapeMatch
  while ((shapeMatch = shapeRegexSimple.exec(cleanedText)) !== null) {
    shapeStarts.push(shapeMatch.index + shapeMatch[0].length)
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
  
  // Clear PROTO registry after parsing (Requirement 1.5)
  // This prevents memory leaks and ensures no PROTO leakage between parses
  protoRegistry.clear()
  
  return { shapes }
}
