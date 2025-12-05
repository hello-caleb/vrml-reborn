# Implementation Plan: VRML PROTO Support

- [x] 1. Set up PROTO infrastructure
  - Create src/parser/protoParser.ts module
  - Define ProtoField, ProtoDefinition, and ProtoRegistry interfaces
  - Implement ProtoRegistry class with register, lookup, and clear methods
  - _Requirements: 1.2, 1.3, 1.5, 6.1, 6.2_

- [x] 2. Implement PROTO definition parsing
  - [x] 2.1 Extract PROTO blocks from VRML text using brace counting
    - Find all "PROTO Name [" patterns
    - Count braces to extract complete PROTO block
    - Remove PROTO blocks from main text
    - _Requirements: 1.1_

  - [x] 2.2 Parse PROTO name and field declarations
    - Extract PROTO name from definition
    - Parse field declarations (type, name, default value)
    - Support SFFloat, SFVec3f, SFRotation, SFColor field types
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 Extract PROTO body template
    - Extract body content between braces
    - Preserve IS bindings in template
    - Store complete body as string
    - _Requirements: 1.1_

  - [ ] 2.4 Write property test for PROTO definition parsing
    - **Property 1: PROTO registration preserves definition**
    - **Validates: Requirements 1.2**

- [x] 3. Implement IS binding resolution
  - [x] 3.1 Create IS binding resolver function
    - Find all "IS fieldName" patterns in body
    - Replace with actual field values
    - Handle multiple IS bindings for same field
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Handle IS binding edge cases
    - Detect non-existent field references
    - Log warnings for invalid bindings
    - Use default values for failed bindings
    - _Requirements: 3.3, 3.4_

  - [x] 3.3 Write property test for IS binding resolution
    - **Property 3: IS binding substitution completeness**
    - **Validates: Requirements 3.1**

  - [x] 3.4 Write property test for multiple IS bindings
    - **Property 8: Multiple IS binding consistency**
    - **Validates: Requirements 3.2**

- [x] 4. Implement PROTO instance parsing and expansion
  - [x] 4.1 Parse PROTO instances from VRML text
    - Find PROTO instance patterns (ProtoName { ... })
    - Extract field value overrides
    - Parse field values by type
    - _Requirements: 4.1, 4.2_

  - [x] 4.2 Implement PROTO expansion logic
    - Look up PROTO definition in registry
    - Merge instance values with defaults
    - Resolve IS bindings with merged values
    - Return expanded VRML text
    - _Requirements: 4.5_

  - [x] 4.3 Handle PROTO instance errors
    - Detect undefined PROTO references
    - Log errors for missing PROTOs
    - Skip invalid instances gracefully
    - _Requirements: 4.4_

  - [ ] 4.4 Write property test for field value overrides
    - **Property 2: Field value override consistency**
    - **Validates: Requirements 4.2**

  - [ ]* 4.5 Write property test for default value preservation
    - **Property 7: Default field value preservation**
    - **Validates: Requirements 4.3**

- [x] 5. Integrate PROTO preprocessing into main parser
  - [x] 5.1 Add PROTO preprocessing step to parseVRML function
    - Extract and register all PROTOs before parsing
    - Expand all PROTO instances
    - Pass expanded text to existing parser
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.3_

  - [x] 5.2 Clear PROTO registry after parsing
    - Call registry.clear() at end of parseVRML
    - Ensure no PROTO leakage between parses
    - _Requirements: 1.5_

  - [x] 5.3 Write property test for PROTO expansion validity
    - **Property 4: PROTO expansion produces valid VRML**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 5.4 Write property test for registry isolation
    - **Property 6: PROTO registry isolation**
    - **Validates: Requirements 1.5**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement nested PROTO support
  - [x] 7.1 Detect nested PROTO instances in expanded bodies
    - Scan expanded text for PROTO instance patterns
    - Track expansion depth to prevent infinite loops
    - _Requirements: 5.5_

  - [x] 7.2 Implement recursive PROTO expansion
    - Expand inner PROTOs first
    - Continue until no PROTO instances remain
    - Detect and break circular references
    - _Requirements: 5.5_

  - [-] 7.3 Write property test for nested PROTO expansion
    - **Property 5: Nested PROTO expansion order**
    - **Validates: Requirements 5.5**

- [ ] 8. Create test VRML files with PROTOs
  - [ ] 8.1 Create public/samples/simple-proto.wrl
    - Basic PROTO with SFColor and SFFloat fields
    - Two instances with different field values
    - _Requirements: All_

  - [ ] 8.2 Create public/samples/nested-proto.wrl
    - PROTO that uses another PROTO
    - Test recursive expansion
    - _Requirements: 5.5_

  - [ ] 8.3 Create public/samples/complex-proto.wrl
    - PROTO with multiple field types
    - Multiple IS bindings
    - Transform and Material properties
    - _Requirements: All_

- [ ] 9. Add error handling and logging
  - [ ] 9.1 Add console logging for PROTO operations
    - Log PROTO definitions found
    - Log PROTO instances expanded
    - Log errors and warnings
    - _Requirements: 1.4, 6.4, 6.5_

  - [ ] 9.2 Implement error recovery strategies
    - Skip malformed PROTOs
    - Continue parsing on PROTO errors
    - Provide helpful error messages
    - _Requirements: 1.4, 6.5_

- [ ] 10. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
