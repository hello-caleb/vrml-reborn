import { useState } from 'react'
import FileUpload from './components/FileUpload'
import VRMLScene from './components/VRMLScene'
import { parseVRML } from './parser/vrmlParser'
import type { SceneData } from './parser/types'
import './App.css'

function App() {
  const [sceneData, setSceneData] = useState<SceneData | null>(null)

  const handleFileUpload = async (file: File) => {
    const text = await file.text()
    const parsed = parseVRML(text)
    setSceneData(parsed)
  }

  return (
    <div className="app">
      <header>
        <h1>🌐 VRML Reborn</h1>
        <p>Bringing 90s VRML to modern WebXR</p>
      </header>
      
      {!sceneData ? (
        <FileUpload onUpload={handleFileUpload} />
      ) : (
        <VRMLScene data={sceneData} />
      )}
    </div>
  )
}

export default App
