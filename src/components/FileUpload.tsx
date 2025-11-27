import { useRef } from 'react'
import './FileUpload.css'

interface FileUploadProps {
  onUpload: (file: File) => void
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file)
  }

  return (
    <div className="upload-container">
      <div className="upload-card">
        <div className="upload-icon">📁</div>
        <h2>Upload VRML File</h2>
        <p>Drop a .wrl file or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept=".wrl,.vrml"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <button onClick={() => inputRef.current?.click()}>
          Choose File
        </button>
      </div>
    </div>
  )
}
