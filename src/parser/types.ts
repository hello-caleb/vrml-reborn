export interface Shape {
  position: [number, number, number]
  color?: string
  geometry?: string
}

export interface SceneData {
  shapes: Shape[]
}
