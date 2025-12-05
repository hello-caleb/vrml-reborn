import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import 'aframe'
import { registerVRMLMeshGeometry } from './components/vrml-mesh-geometry'

// Register custom A-Frame geometries once on app startup
registerVRMLMeshGeometry()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
