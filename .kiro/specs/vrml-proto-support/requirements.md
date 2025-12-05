# Requirements Document: VRML PROTO Support

## Introduction

VRML 2.0 PROTO (prototype) definitions allow users to create reusable, parameterized node templates. This feature is critical for parsing real-world VRML files that use custom node definitions. Without PROTO support, many legacy VRML files from the 1990s cannot be rendered.

## Glossary

- **PROTO**: A prototype definition that creates a new node type with customizable parameters
- **Field**: A parameter in a PROTO definition (e.g., SFFloat, SFVec3f, SFColor)
- **IS keyword**: Binds a PROTO field to a property in the PROTO body
- **PROTO instance**: Usage of a defined PROTO with specific field values
- **PROTO registry**: Internal storage of parsed PROTO definitions
- **Field types**: VRML data types (SFFloat, SFVec3f, SFRotation, SFColor, SFNode, MFNode)

## Requirements

### Requirement 1

**User Story:** As a user, I want to load VRML files with PROTO definitions, so that I can view legacy 3D models that use custom node types.

#### Acceptance Criteria

1. WHEN the parser encounters a PROTO definition block THEN the system SHALL extract the PROTO name, field declarations, and body template
2. WHEN a PROTO is defined THEN the system SHALL store it in a PROTO registry for later instantiation
3. WHEN the same PROTO name is defined multiple times THEN the system SHALL use the most recent definition
4. WHEN a PROTO definition contains syntax errors THEN the system SHALL log a warning and continue parsing other nodes
5. WHEN parsing completes THEN the system SHALL clear the PROTO registry to prevent memory leaks

### Requirement 2

**User Story:** As a user, I want PROTO field declarations to be parsed correctly, so that instances can be created with custom parameter values.

#### Acceptance Criteria

1. WHEN a PROTO field is declared with type SFFloat THEN the system SHALL store the field name and default numeric value
2. WHEN a PROTO field is declared with type SFVec3f THEN the system SHALL store the field name and default three-component vector
3. WHEN a PROTO field is declared with type SFRotation THEN the system SHALL store the field name and default four-component rotation
4. WHEN a PROTO field is declared with type SFColor THEN the system SHALL store the field name and default RGB color values
5. WHEN a PROTO field is declared with type SFNode or MFNode THEN the system SHALL store the field name and default node reference

### Requirement 3

**User Story:** As a user, I want IS keyword bindings to work correctly, so that PROTO parameters control the properties of nodes in the PROTO body.

#### Acceptance Criteria

1. WHEN a property uses IS keyword THEN the system SHALL replace the property value with the corresponding field value
2. WHEN multiple properties use IS with the same field THEN the system SHALL apply the field value to all bound properties
3. WHEN an IS binding references a non-existent field THEN the system SHALL log a warning and use a default value
4. WHEN a property has both a literal value and IS binding THEN the system SHALL use the IS binding value
5. WHEN IS bindings are nested in multiple levels THEN the system SHALL resolve all bindings recursively

### Requirement 4

**User Story:** As a user, I want to instantiate PROTO nodes with custom field values, so that I can create variations of the same template.

#### Acceptance Criteria

1. WHEN a PROTO instance is encountered THEN the system SHALL look up the PROTO definition in the registry
2. WHEN field values are provided in the instance THEN the system SHALL override the default field values
3. WHEN a field value is omitted in the instance THEN the system SHALL use the default value from the PROTO definition
4. WHEN a PROTO instance references an undefined PROTO THEN the system SHALL log an error and skip the node
5. WHEN a PROTO instance is created THEN the system SHALL expand the PROTO body with substituted field values

### Requirement 5

**User Story:** As a user, I want expanded PROTO bodies to be processed as regular VRML nodes, so that they render correctly in the scene.

#### Acceptance Criteria

1. WHEN a PROTO body is expanded THEN the system SHALL parse Transform nodes within the expanded content
2. WHEN a PROTO body is expanded THEN the system SHALL parse Shape nodes within the expanded content
3. WHEN a PROTO body is expanded THEN the system SHALL parse Material properties within the expanded content
4. WHEN a PROTO body is expanded THEN the system SHALL parse geometry nodes within the expanded content
5. WHEN a PROTO body contains nested PROTO instances THEN the system SHALL recursively expand all PROTO references

### Requirement 6

**User Story:** As a developer, I want clear separation between PROTO parsing and node parsing, so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN implementing PROTO support THEN the system SHALL create a separate PROTO parser module
2. WHEN a PROTO is parsed THEN the system SHALL not modify the main VRML parsing logic
3. WHEN PROTO expansion occurs THEN the system SHALL generate valid VRML text that can be parsed by existing parsers
4. WHEN debugging PROTO issues THEN the system SHALL log PROTO definitions and expansions with clear identifiers
5. WHEN PROTO parsing fails THEN the system SHALL provide error messages that reference the PROTO name and field

## Testing Strategy

### Unit Tests
- Test PROTO definition parsing with various field types
- Test IS keyword binding resolution
- Test PROTO instance creation with field overrides
- Test PROTO registry storage and lookup
- Test error handling for malformed PROTO definitions

### Integration Tests
- Test PROTO expansion with Transform nodes
- Test PROTO expansion with Shape and Material nodes
- Test nested PROTO instances
- Test PROTO definitions with multiple field types
- Test real-world VRML files with PROTO definitions

### Example VRML Files
- simple-proto.wrl: Basic PROTO with SFFloat field
- colored-proto.wrl: PROTO with SFColor field
- nested-proto.wrl: PROTO that uses another PROTO
- complex-proto.wrl: PROTO with multiple field types and IS bindings
