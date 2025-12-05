# Design Document: VRML PROTO Support

## Overview

This design implements VRML 2.0 PROTO (prototype) support, enabling the parser to handle reusable, parameterized node definitions. The implementation uses a registry-based approach where PROTO definitions are parsed and stored, then expanded when instantiated.

## Architecture

```
VRML Text Input
    ↓
PROTO Preprocessor
    ├─→ Extract PROTO definitions
    ├─→ Store in PROTO registry
    └─→ Remove PROTO blocks from text
    ↓
PROTO Expander
    ├─→ Find PROTO instances
    ├─→ Look up definitions
    ├─→ Substitute field values
    └─→ Expand to standard VRML
    ↓
Existing VRML Parser
    └─→ Parse expanded nodes
```

## Components and Interfaces

### 1. PROTO Registry

```typescript
interface ProtoField {
  name: string
  type: 'SFFloat' | 'SFVec3f' | 'SFRotation' | 'SFColor' | 'SFNode' | 'MFNode'
  defaultValue: any
}

interface ProtoDefinition {
  name: string
  fields: ProtoField[]
  body: string  // Template with IS bindings
}

class ProtoRegistry {
  private protos: Map<string, ProtoDefinition>
  
  register(name: string, definition: ProtoDefinition): void
  lookup(name: string): ProtoDefinition | undefined
  clear(): void
}
```

### 2. PROTO Parser

```typescript
function parseProtoDefinition(protoText: string): ProtoDefinition | null {
  // Extract PROTO name
  // Parse field declarations
  // Extract body template
  // Return ProtoDefinition
}

function extractProtoBlocks(vrmlText: string): {
  protos: ProtoDefinition[]
  cleanedText: string
} {
  // Find all PROTO blocks
  // Parse each PROTO
  // Remove PROTO blocks from text
  // Return definitions and cleaned text
}
```

### 3. PROTO Expander

```typescript
interface ProtoInstance {
  protoName: string
  fieldValues: Map<string, any>
}

function parseProtoInstance(instanceText: string): ProtoInstance | null {
  // Extract PROTO name
  // Parse field value overrides
  // Return ProtoInstance
}

function expandProto(
  instance: ProtoInstance,
  definition: ProtoDefinition
): string {
  // Merge instance values with defaults
  // Replace IS bindings in body
  // Return expanded VRML text
}

function expandAllProtos(
  vrmlText: string,
  registry: ProtoRegistry
): string {
  // Find all PROTO instances
  // Expand each instance
  // Replace instance with expanded text
  // Return fully expanded VRML
}
```

## Data Models

### Field Type Parsing

```typescript
function parseFieldValue(type: string, valueStr: string): any {
  switch (type) {
    case 'SFFloat':
      return parseFloat(valueStr)
    case 'SFVec3f':
      return valueStr.split(/\s+/).map(Number).slice(0, 3)
    case 'SFRotation':
      return valueStr.split(/\s+/).map(Number).slice(0, 4)
    case 'SFColor':
      return valueStr.split(/\s+/).map(Number).slice(0, 3)
    case 'SFNode':
    case 'MFNode':
      return valueStr  // Keep as string for later parsing
  }
}
```

### IS Binding Resolution

```typescript
function resolveISBindings(
  bodyTemplate: string,
  fieldValues: Map<string, any>
): string {
  // Find all "IS fieldName" patterns
  // Replace with actual field values
  // Handle nested IS bindings
  // Return resolved body
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: PROTO registration preserves definition
*For any* valid PROTO definition, registering it and then looking it up should return an equivalent definition with the same name, fields, and body
**Validates: Requirements 1.2**

### Property 2: Field value override consistency
*For any* PROTO instance with field overrides, the expanded body should contain the override values, not the default values
**Validates: Requirements 4.2**

### Property 3: IS binding substitution completeness
*For any* PROTO body with IS bindings, after expansion all IS keywords should be replaced with actual values
**Validates: Requirements 3.1**

### Property 4: PROTO expansion produces valid VRML
*For any* expanded PROTO body, parsing it with the existing VRML parser should succeed and produce valid shapes
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 5: Nested PROTO expansion order
*For any* VRML text with nested PROTO instances, expanding all PROTOs should resolve inner PROTOs before outer PROTOs
**Validates: Requirements 5.5**

### Property 6: PROTO registry isolation
*For any* two separate parsing operations, PROTOs defined in one operation should not affect the other operation
**Validates: Requirements 1.5**

### Property 7: Default field value preservation
*For any* PROTO instance that omits a field value, the expanded body should use the default value from the PROTO definition
**Validates: Requirements 4.3**

### Property 8: Multiple IS binding consistency
*For any* PROTO body where multiple properties use IS with the same field, all properties should receive the same field value
**Validates: Requirements 3.2**

## Error Handling

### PROTO Definition Errors
- Malformed PROTO syntax → Log warning, skip PROTO
- Duplicate field names → Use first declaration
- Invalid field type → Default to SFFloat
- Missing PROTO body → Skip PROTO

### PROTO Instance Errors
- Undefined PROTO reference → Log error, skip instance
- Invalid field value type → Use default value
- Missing required field → Use default value
- Circular PROTO references → Detect and break cycle

### IS Binding Errors
- IS references non-existent field → Log warning, use literal value
- IS binding type mismatch → Attempt type coercion
- Nested IS binding loop → Detect and break loop

## Testing Strategy

### Unit Testing
- Test PROTO definition parsing with fast-check
- Test field value parsing for all types
- Test IS binding resolution
- Test PROTO registry operations
- Test error handling for malformed input

### Property-Based Testing
- Use fast-check library for JavaScript/TypeScript
- Generate random PROTO definitions
- Generate random PROTO instances
- Verify correctness properties hold
- Run 100+ iterations per property

### Integration Testing
- Test with real VRML files containing PROTOs
- Test nested PROTO expansion
- Test PROTO with Transform and Shape nodes
- Test PROTO with Material properties
- Test PROTO with custom geometry

### Example Test Files

**simple-proto.wrl:**
```vrml
#VRML V2.0 utf8

PROTO ColoredBox [
  field SFColor boxColor 1 0 0
  field SFFloat boxSize 1
] {
  Shape {
    appearance Appearance {
      material Material {
        diffuseColor IS boxColor
      }
    }
    geometry Box {
      size IS boxSize IS boxSize IS boxSize
    }
  }
}

ColoredBox { boxColor 0 1 0 boxSize 2 }
ColoredBox { boxColor 0 0 1 }
```

**nested-proto.wrl:**
```vrml
#VRML V2.0 utf8

PROTO Sphere [
  field SFFloat radius 1
] {
  Shape {
    geometry Sphere { radius IS radius }
  }
}

PROTO ColoredSphere [
  field SFColor color 1 1 1
  field SFFloat size 1
] {
  Shape {
    appearance Appearance {
      material Material { diffuseColor IS color }
    }
    geometry Sphere { radius IS size }
  }
}

ColoredSphere { color 1 0 0 size 2 }
```

## Implementation Notes

### Phase 1: Basic PROTO Support
- Parse PROTO definitions
- Store in registry
- Expand simple instances
- Handle SFFloat and SFVec3f fields

### Phase 2: Advanced Field Types
- Support SFRotation
- Support SFColor
- Support SFNode and MFNode
- Handle complex IS bindings

### Phase 3: Nested PROTOs
- Detect nested PROTO instances
- Implement recursive expansion
- Handle circular references
- Optimize expansion performance

### Phase 4: Error Handling
- Add comprehensive error messages
- Implement fallback strategies
- Add debug logging
- Create error recovery mechanisms

## Performance Considerations

- PROTO registry uses Map for O(1) lookup
- IS binding resolution uses regex with caching
- Expansion happens once before main parsing
- Large PROTO bodies may impact memory usage
- Consider lazy expansion for unused PROTOs
