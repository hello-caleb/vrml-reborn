export interface Shape {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  emissiveColor?: string
  transparency?: number
  geometry: 'box' | 'sphere' | 'cylinder' | 'cone' | 'mesh' | 'lines'
  size?: [number, number, number]
  radius?: number
  height?: number
  vertices?: number[]
  indices?: number[]
}

export interface SceneData {
  shapes: Shape[]
}
