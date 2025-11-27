import { Entity, Scene } from 'aframe-react'
import type { SceneData } from '../parser/types'
import './VRMLScene.css'

interface VRMLSceneProps {
  data: SceneData
}

export default function VRMLScene({ data }: VRMLSceneProps) {
  return (
    <div className="scene-container">
      <Scene vr-mode-ui="enabled: true">
        <Entity primitive="a-sky" color="#87CEEB" />
        <Entity primitive="a-camera" position="0 1.6 3" />
        
        {data.shapes.map((shape, i) => (
          <Entity
            key={i}
            primitive="a-box"
            position={`${shape.position[0]} ${shape.position[1]} ${shape.position[2]}`}
            color={shape.color || '#4CC3D9'}
          />
        ))}
      </Scene>
    </div>
  )
}
