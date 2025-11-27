# VRML Parser Specification

## Purpose
Build a robust VRML parser that can handle common VRML 1.0 and 2.0 node types and convert them to A-Frame-compatible scene data.

## Requirements

### Must Support
1. **Transform nodes** - Position, rotation, scale
2. **Shape nodes** - Box, Sphere, Cone, Cylinder
3. **Material nodes** - diffuseColor, emissiveColor, transparency
4. **Geometry nodes** - IndexedFaceSet for custom meshes
5. **Grouping** - Group and Transform hierarchies

### Parser Architecture
```
VRML Text → Tokenizer → AST Builder → Scene Graph → A-Frame Entities
```

### Input Format
- VRML 1.0: `#VRML V1.0 ascii`
- VRML 2.0: `#VRML V2.0 utf8`

### Output Format
```typescript
interface SceneData {
  shapes: Shape[]
  lights?: Light[]
  camera?: Camera
}
```

## Implementation Phases

### Phase 1: Basic Shapes (Current)
- Parse Transform + Box nodes
- Extract position coordinates
- Apply basic colors

### Phase 2: Extended Geometry
- Add Sphere, Cone, Cylinder support
- Parse Material properties
- Handle rotation and scale

### Phase 3: Advanced Features
- IndexedFaceSet for custom meshes
- Texture mapping
- Lighting nodes
- Animation support

## Testing Strategy
- Use sample .wrl files from 90s websites
- Test with VRML examples from web3d.org
- Validate against original VRML spec

## Success Criteria
- Parse 80%+ of common VRML files without errors
- Render recognizable 3D scenes
- Handle malformed input gracefully
