import type { SceneData, Shape } from './types'

export function parseVRML(vrmlText: string): SceneData {
  const shapes: Shape[] = []
  
  // Basic VRML parsing - extract Transform nodes with Box geometry
  const transformRegex = /Transform\s*{[^}]*translation\s+([\d\.\-\s]+)[^}]*children\s*\[[^}]*Box/g
  const colorRegex = /Material\s*{[^}]*diffuseColor\s+([\d\.\s]+)/g
  
  let match
  while ((match = transformRegex.exec(vrmlText)) !== null) {
    const coords = match[1].trim().split(/\s+/).map(Number)
    shapes.push({
      position: [coords[0] || 0, coords[1] || 0, coords[2] || 0],
      color: '#4CC3D9'
    })
  }
  
  // Fallback: if no shapes found, add a demo cube
  if (shapes.length === 0) {
    shapes.push({ position: [0, 0, 0], color: '#4CC3D9' })
  }
  
  return { shapes }
}
