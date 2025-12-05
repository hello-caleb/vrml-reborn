import { Entity, Scene } from 'aframe-react'
import type { SceneData } from '../parser/types'
import './VRMLScene.css'

interface VRMLSceneProps {
  data: SceneData
}

export default function VRMLScene({ data }: VRMLSceneProps) {

  const getGeometryProps = (shape: SceneData['shapes'][0]) => {
    const props: any = {
      position: `${shape.position[0]} ${shape.position[1]} ${shape.position[2]}`
    }
    
    if (shape.rotation) {
      props.rotation = `${shape.rotation[0]} ${shape.rotation[1]} ${shape.rotation[2]}`
    }
    
    if (shape.scale) {
      props.scale = `${shape.scale[0]} ${shape.scale[1]} ${shape.scale[2]}`
    }
    
    // Build material properties - always include color
    const materialProps: string[] = []
    materialProps.push(`color: ${shape.color || '#4CC3D9'}`)
    
    if (shape.emissiveColor) {
      materialProps.push(`emissive: ${shape.emissiveColor}`)
      materialProps.push('emissiveIntensity: 1')
    }
    
    if (shape.transparency !== undefined && shape.transparency > 0) {
      const opacity = 1 - shape.transparency
      materialProps.push(`opacity: ${opacity}`)
      materialProps.push('transparent: true')
    }
    
    props.material = materialProps.join('; ')
    
    switch (shape.geometry) {
      case 'lines':
        props.geometry = {
          primitive: 'vrml-lines',
          vertices: shape.vertices || [],
          indices: shape.indices || []
        }
        // Override material for lines
        props.material = 'shader: flat'
        break
      case 'mesh':
        props.geometry = {
          primitive: 'vrml-mesh',
          vertices: shape.vertices || [],
          indices: shape.indices || []
        }
        break
      case 'box':
        props.primitive = 'a-box'
        if (shape.size) {
          props.width = shape.size[0]
          props.height = shape.size[1]
          props.depth = shape.size[2]
        }
        break
      case 'sphere':
        props.primitive = 'a-sphere'
        if (shape.radius) props.radius = shape.radius
        break
      case 'cylinder':
        props.primitive = 'a-cylinder'
        if (shape.radius) props.radius = shape.radius
        if (shape.height) props.height = shape.height
        break
      case 'cone':
        props.primitive = 'a-cone'
        if (shape.radius) props.radiusBottom = shape.radius
        if (shape.height) props.height = shape.height
        break
    }
    
    return props
  }

  return (
    <div className="scene-container">
      <Scene vr-mode-ui="enabled: true">
        <Entity primitive="a-sky" color="#1a1a2e" />
        <Entity primitive="a-camera" position="0 2 10" />
        
        {data.shapes.map((shape, i) => (
          <Entity key={i} {...getGeometryProps(shape)} />
        ))}
      </Scene>
    </div>
  )
}
