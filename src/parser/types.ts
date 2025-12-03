export interface Shape {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  geometry: 'box' | 'sphere' | 'cylinder' | 'cone'
  size?: [number, number, number]
  radius?: number
  height?: number
}

export interface SceneData {
  shapes: Shape[]
}
