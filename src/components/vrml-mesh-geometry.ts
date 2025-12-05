import * as THREE from 'three'

declare const AFRAME: any

let isRegistered = false

// Register custom A-Frame geometries for VRML meshes and lines
export function registerVRMLMeshGeometry() {
  if (typeof AFRAME === 'undefined') return
  if (isRegistered) return
  
  // Check if already registered
  if (AFRAME.geometries && AFRAME.geometries['vrml-mesh']) {
    isRegistered = true
    return
  }
  
  // Register mesh geometry for IndexedFaceSet
  AFRAME.registerGeometry('vrml-mesh', {
    schema: {
      vertices: { type: 'array', default: [] },
      indices: { type: 'array', default: [] }
    },
    
    init: function (data: { vertices: number[], indices: number[] }) {
      const geometry = new THREE.BufferGeometry()
      
      if (data.vertices.length > 0 && data.indices.length > 0) {
        // Set vertex positions
        const positions = new Float32Array(data.vertices)
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        
        // Set indices
        const indices = new Uint16Array(data.indices)
        geometry.setIndex(new THREE.BufferAttribute(indices, 1))
        
        // Compute normals for proper lighting
        geometry.computeVertexNormals()
      }
      
      this.geometry = geometry
    }
  })
  
  // Register line geometry for IndexedLineSet
  AFRAME.registerGeometry('vrml-lines', {
    schema: {
      vertices: { type: 'array', default: [] },
      indices: { type: 'array', default: [] }
    },
    
    init: function (data: { vertices: number[], indices: number[] }) {
      const geometry = new THREE.BufferGeometry()
      
      if (data.vertices.length > 0 && data.indices.length > 0) {
        // Set vertex positions
        const positions = new Float32Array(data.vertices)
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        
        // Set indices for line segments
        const indices = new Uint16Array(data.indices)
        geometry.setIndex(new THREE.BufferAttribute(indices, 1))
      }
      
      this.geometry = geometry
    }
  })
  
  isRegistered = true
}
