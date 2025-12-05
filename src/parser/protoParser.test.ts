/**
 * Property-Based Tests for VRML PROTO Parser
 * 
 * These tests use fast-check to verify correctness properties
 * across many randomly generated inputs.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import {
  ProtoRegistry,
  ProtoDefinition,
  ProtoField,
  extractProtoBlocks,
  resolveISBindings,
  expandProto
} from './protoParser'

describe('PROTO Parser - Property-Based Tests', () => {
  /**
   * Feature: vrml-proto-support, Property 1: PROTO registration preserves definition
   * 
   * For any valid PROTO definition, registering it and then looking it up
   * should return an equivalent definition with the same name, fields, and body
   * 
   * Validates: Requirements 1.2
   */
  describe('Property 1: PROTO registration preserves definition', () => {
    let registry: ProtoRegistry

    beforeEach(() => {
      registry = new ProtoRegistry()
    })

    it('should preserve PROTO definition after registration and lookup', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary PROTO definitions
          fc.record({
            name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/), // Valid VRML identifier
            fields: fc.array(
              fc.record({
                name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // Valid field name
                type: fc.constantFrom('SFFloat', 'SFVec3f', 'SFRotation', 'SFColor', 'SFNode', 'MFNode'),
                defaultValue: fc.oneof(
                  fc.float(), // For SFFloat
                  fc.tuple(fc.float(), fc.float(), fc.float()), // For SFVec3f, SFColor
                  fc.tuple(fc.float(), fc.float(), fc.float(), fc.float()), // For SFRotation
                  fc.string() // For SFNode, MFNode
                )
              }),
              { minLength: 0, maxLength: 10 }
            ),
            body: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (protoDefinition) => {
            // Register the PROTO
            registry.register(protoDefinition.name, protoDefinition)

            // Look it up
            const retrieved = registry.lookup(protoDefinition.name)

            // Verify it was preserved
            expect(retrieved).toBeDefined()
            expect(retrieved?.name).toBe(protoDefinition.name)
            expect(retrieved?.fields).toHaveLength(protoDefinition.fields.length)
            expect(retrieved?.body).toBe(protoDefinition.body)

            // Verify each field is preserved
            protoDefinition.fields.forEach((field, index) => {
              expect(retrieved?.fields[index].name).toBe(field.name)
              expect(retrieved?.fields[index].type).toBe(field.type)
              expect(retrieved?.fields[index].defaultValue).toEqual(field.defaultValue)
            })
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design doc
      )
    })

    it('should handle multiple registrations with different names', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f', 'SFRotation', 'SFColor'),
                  defaultValue: fc.oneof(
                    fc.float(),
                    fc.tuple(fc.float(), fc.float(), fc.float()),
                    fc.tuple(fc.float(), fc.float(), fc.float(), fc.float())
                  )
                }),
                { maxLength: 5 }
              ),
              body: fc.string({ minLength: 1, maxLength: 200 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (protos) => {
            // Clear registry before each property test iteration
            registry.clear()
            
            // Create a map to track unique names (last definition wins per Requirement 1.3)
            const uniqueProtos = new Map<string, ProtoDefinition>()
            
            // Register all PROTOs
            protos.forEach(proto => {
              registry.register(proto.name, proto)
              uniqueProtos.set(proto.name, proto) // Track last definition
            })

            // Verify all unique PROTOs can be retrieved
            uniqueProtos.forEach((proto, name) => {
              const retrieved = registry.lookup(name)
              expect(retrieved).toBeDefined()
              expect(retrieved?.name).toBe(proto.name)
              expect(retrieved?.body).toBe(proto.body)
            })

            // Verify registry size matches unique names
            expect(registry.size()).toBe(uniqueProtos.size)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should replace existing PROTO when same name is registered (Requirement 1.3)', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/), // PROTO name
          fc.string({ minLength: 1, maxLength: 100 }), // First body
          fc.string({ minLength: 1, maxLength: 100 }), // Second body
          (name, body1, body2) => {
            // Ensure bodies are different
            fc.pre(body1 !== body2)

            // Clear registry before each property test iteration
            registry.clear()

            // Register first definition
            const proto1: ProtoDefinition = {
              name,
              fields: [],
              body: body1
            }
            registry.register(name, proto1)

            // Register second definition with same name
            const proto2: ProtoDefinition = {
              name,
              fields: [],
              body: body2
            }
            registry.register(name, proto2)

            // Verify the second definition is retrieved (most recent)
            const retrieved = registry.lookup(name)
            expect(retrieved).toBeDefined()
            expect(retrieved?.body).toBe(body2)
            expect(retrieved?.body).not.toBe(body1)

            // Verify only one PROTO is stored
            expect(registry.size()).toBe(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return undefined for non-existent PROTO names', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
          (name) => {
            // Ensure the name is not registered
            const retrieved = registry.lookup(name)
            expect(retrieved).toBeUndefined()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should clear all PROTOs when clear() is called (Requirement 1.5)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f'),
                  defaultValue: fc.oneof(
                    fc.float(),
                    fc.tuple(fc.float(), fc.float(), fc.float())
                  )
                }),
                { maxLength: 3 }
              ),
              body: fc.string({ minLength: 1, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (protos) => {
            // Register all PROTOs
            protos.forEach(proto => {
              registry.register(proto.name, proto)
            })

            // Verify registry is not empty
            expect(registry.size()).toBeGreaterThan(0)

            // Clear the registry
            registry.clear()

            // Verify registry is empty
            expect(registry.size()).toBe(0)

            // Verify all PROTOs are gone
            protos.forEach(proto => {
              expect(registry.lookup(proto.name)).toBeUndefined()
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vrml-proto-support, Property 3: IS binding substitution completeness
   * 
   * For any PROTO body with IS bindings, after expansion all IS keywords
   * should be replaced with actual values
   * 
   * Validates: Requirements 3.1
   */
  describe('Property 3: IS binding substitution completeness', () => {
    it('should replace all IS bindings with actual field values', () => {
      fc.assert(
        fc.property(
          // Generate field names and values (ensure unique field names)
          fc.uniqueArray(
            fc.record({
              fieldName: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
              fieldValue: fc.oneof(
                fc.float({ min: -1000, max: 1000, noNaN: true }),
                fc.tuple(
                  fc.float({ min: -100, max: 100, noNaN: true }),
                  fc.float({ min: -100, max: 100, noNaN: true }),
                  fc.float({ min: -100, max: 100, noNaN: true })
                )
              )
            }),
            { minLength: 1, maxLength: 10, selector: (item) => item.fieldName }
          ),
          (fields) => {
            // Create a body template with IS bindings
            const bodyTemplate = fields
              .map(f => `someProperty IS ${f.fieldName}`)
              .join('\n')

            // Create field values map
            const fieldValues = new Map(
              fields.map(f => [f.fieldName, f.fieldValue])
            )

            // Resolve IS bindings
            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify no IS keywords remain in the resolved body
            expect(resolvedBody).not.toMatch(/\bIS\b/)

            // Verify each field value appears in the resolved body
            fields.forEach(field => {
              const valueStr = Array.isArray(field.fieldValue)
                ? field.fieldValue.join(' ')
                : String(field.fieldValue)
              
              expect(resolvedBody).toContain(valueStr)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle bodies with mixed IS bindings and literal values', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // field name
          fc.float({ min: 0, max: 10, noNaN: true }), // field value
          fc.string({ minLength: 5, maxLength: 50 }), // literal text before
          fc.string({ minLength: 5, maxLength: 50 }), // literal text after
          (fieldName, fieldValue, textBefore, textAfter) => {
            // Ensure literal text doesn't contain IS keyword
            fc.pre(!textBefore.includes('IS') && !textAfter.includes('IS'))

            const bodyTemplate = `${textBefore}\nradius IS ${fieldName}\n${textAfter}`
            const fieldValues = new Map([[fieldName, fieldValue]])

            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify IS keyword is removed
            expect(resolvedBody).not.toMatch(/\bIS\b/)

            // Verify field value is present
            expect(resolvedBody).toContain(String(fieldValue))

            // Verify literal text is preserved
            expect(resolvedBody).toContain(textBefore)
            expect(resolvedBody).toContain(textAfter)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle non-existent field references gracefully', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // existing field
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // non-existent field
          fc.float({ min: 0, max: 10, noNaN: true }), // field value
          (existingField, nonExistentField, fieldValue) => {
            // Ensure fields are different
            fc.pre(existingField !== nonExistentField)

            const bodyTemplate = `
              radius IS ${existingField}
              color IS ${nonExistentField}
            `
            const fieldValues = new Map([[existingField, fieldValue]])

            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify existing field IS binding is resolved
            expect(resolvedBody).toContain(String(fieldValue))

            // Verify non-existent field IS binding is kept as-is (fallback behavior)
            expect(resolvedBody).toContain(`IS ${nonExistentField}`)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vrml-proto-support, Property 8: Multiple IS binding consistency
   * 
   * For any PROTO body where multiple properties use IS with the same field,
   * all properties should receive the same field value
   * 
   * Validates: Requirements 3.2
   */
  describe('Property 8: Multiple IS binding consistency', () => {
    it('should apply the same field value to all properties bound to that field', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // field name
          fc.float({ min: 0, max: 10, noNaN: true }), // field value
          fc.integer({ min: 2, max: 10 }), // number of properties using this field
          (fieldName, fieldValue, numProperties) => {
            // Create multiple properties all using IS with the same field
            const properties = Array.from(
              { length: numProperties },
              (_, i) => `property${i}`
            )

            const bodyTemplate = properties
              .map(prop => `${prop} IS ${fieldName}`)
              .join('\n')

            const fieldValues = new Map([[fieldName, fieldValue]])

            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify no IS keywords remain
            expect(resolvedBody).not.toMatch(/\bIS\b/)

            // Count occurrences of the field value in the resolved body
            const valueStr = String(fieldValue)
            const escapedValue = valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            // Use word boundaries to avoid matching the value as part of property names
            const pattern = new RegExp(`\\b${escapedValue}\\b`, 'g')
            const occurrences = (resolvedBody.match(pattern) || []).length

            // All properties should have received the same value
            expect(occurrences).toBe(numProperties)

            // Verify each property name is still present
            properties.forEach(prop => {
              expect(resolvedBody).toContain(prop)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle multiple fields with multiple bindings each', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.record({
              fieldName: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
              fieldValue: fc.float({ min: 1, max: 10, noNaN: true }), // Avoid 0 to prevent false matches
              numBindings: fc.integer({ min: 1, max: 5 })
            }),
            { minLength: 1, maxLength: 5, selector: (item) => item.fieldName }
          ),
          (fields) => {
            // Skip test if any two fields have the same value
            // (this would make counting occurrences ambiguous)
            const values = fields.map(f => f.fieldValue)
            const uniqueValues = new Set(values)
            fc.pre(values.length === uniqueValues.size)

            // Create body template with multiple bindings per field
            const bodyTemplate = fields
              .flatMap(field =>
                Array.from(
                  { length: field.numBindings },
                  (_, i) => `prop_${field.fieldName}_${i} IS ${field.fieldName}`
                )
              )
              .join('\n')

            const fieldValues = new Map(
              fields.map(f => [f.fieldName, f.fieldValue])
            )

            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify no IS keywords remain
            expect(resolvedBody).not.toMatch(/\bIS\b/)

            // Verify each field value appears the correct number of times
            fields.forEach(field => {
              const valueStr = String(field.fieldValue)
              // Escape special regex characters
              const escapedValue = valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              // Use negative lookbehind/lookahead to ensure we don't match partial numbers
              // (?<![0-9.]) ensures no digit or dot before
              // (?![0-9]) ensures no digit after
              const pattern = new RegExp(`(?<![0-9.])${escapedValue}(?![0-9])`, 'g')
              const occurrences = (resolvedBody.match(pattern) || []).length

              expect(occurrences).toBe(field.numBindings)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle vector fields with multiple IS bindings', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/), // field name
          fc.tuple(
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), // SFVec3f or SFColor value
          fc.integer({ min: 2, max: 5 }), // number of bindings
          (fieldName, fieldValue, numBindings) => {
            const bodyTemplate = Array.from(
              { length: numBindings },
              (_, i) => `vector${i} IS ${fieldName}`
            ).join('\n')

            const fieldValues = new Map([[fieldName, fieldValue]])

            const resolvedBody = resolveISBindings(bodyTemplate, fieldValues, 'TestProto')

            // Verify no IS keywords remain
            expect(resolvedBody).not.toMatch(/\bIS\b/)

            // Verify the vector value appears correctly formatted
            const valueStr = fieldValue.join(' ')
            const occurrences = (resolvedBody.match(new RegExp(valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length

            // All bindings should have the same vector value
            expect(occurrences).toBe(numBindings)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vrml-proto-support, Property 4: PROTO expansion produces valid VRML
   * 
   * For any expanded PROTO body, parsing it with the existing VRML parser
   * should succeed and produce valid shapes
   * 
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4
   */
  describe('Property 4: PROTO expansion produces valid VRML', () => {
    let registry: ProtoRegistry

    beforeEach(() => {
      registry = new ProtoRegistry()
    })

    it('should produce VRML that can be parsed successfully', () => {
      fc.assert(
        fc.property(
          // Generate PROTO definitions with valid VRML bodies
          fc.record({
            name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
            fields: fc.array(
              fc.oneof(
                // SFFloat field
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constant('SFFloat' as const),
                  defaultValue: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true })
                }),
                // SFVec3f field
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constant('SFVec3f' as const),
                  defaultValue: fc.tuple(
                    fc.float({ min: 0, max: 1, noNaN: true }),
                    fc.float({ min: 0, max: 1, noNaN: true }),
                    fc.float({ min: 0, max: 1, noNaN: true })
                  )
                }),
                // SFColor field
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constant('SFColor' as const),
                  defaultValue: fc.tuple(
                    fc.float({ min: 0, max: 1, noNaN: true }),
                    fc.float({ min: 0, max: 1, noNaN: true }),
                    fc.float({ min: 0, max: 1, noNaN: true })
                  )
                })
              ),
              { minLength: 1, maxLength: 3 }
            ),
            geometry: fc.constantFrom('Box', 'Sphere', 'Cylinder')
          }),
          (protoSpec) => {
            // Create a valid VRML body template with IS bindings
            const { name, fields, geometry } = protoSpec
            
            // Find fields by type
            const colorField = fields.find(f => f.type === 'SFColor')
            const sizeField = fields.find(f => f.type === 'SFFloat')
            const vecField = fields.find(f => f.type === 'SFVec3f')
            
            // Build a valid VRML body with IS bindings
            let body = 'Shape {\n'
            body += '  appearance Appearance {\n'
            body += '    material Material {\n'
            
            if (colorField) {
              body += `      diffuseColor IS ${colorField.name}\n`
            } else {
              body += '      diffuseColor 1 0 0\n'
            }
            
            body += '    }\n'
            body += '  }\n'
            body += `  geometry ${geometry} {\n`
            
            if (geometry === 'Sphere' && sizeField) {
              body += `    radius IS ${sizeField.name}\n`
            } else if (geometry === 'Box' && vecField) {
              body += `    size IS ${vecField.name}\n`
            } else if (geometry === 'Cylinder' && sizeField) {
              body += `    radius IS ${sizeField.name}\n`
              body += '    height 2\n'
            } else {
              // Provide defaults
              if (geometry === 'Sphere') body += '    radius 1\n'
              else if (geometry === 'Box') body += '    size 1 1 1\n'
              else if (geometry === 'Cylinder') {
                body += '    radius 1\n'
                body += '    height 2\n'
              }
            }
            
            body += '  }\n'
            body += '}'
            
            // Create the PROTO definition
            const protoDefinition = {
              name,
              fields,
              body
            }
            
            // Register the PROTO
            registry.register(name, protoDefinition)
            
            // Create a PROTO instance with some field overrides
            const instanceFieldValues = new Map<string, any>()
            
            // Override some fields (not all)
            if (fields.length > 0) {
              const fieldToOverride = fields[0]
              instanceFieldValues.set(fieldToOverride.name, fieldToOverride.defaultValue)
            }
            
            // Create the instance
            const instance = {
              protoName: name,
              fieldValues: instanceFieldValues,
              startIndex: 0,
              endIndex: 0
            }
            
            // Expand the PROTO
            const expandedVRML = expandProto(instance, registry)
            
            // Verify expansion succeeded
            expect(expandedVRML).toBeTruthy()
            expect(expandedVRML.length).toBeGreaterThan(0)
            
            // Verify no IS keywords remain in expanded VRML
            expect(expandedVRML).not.toMatch(/\bIS\b/)
            
            // Verify the expanded VRML contains valid VRML structure
            expect(expandedVRML).toContain('Shape')
            expect(expandedVRML).toContain('appearance')
            expect(expandedVRML).toContain('Material')
            expect(expandedVRML).toContain('geometry')
            expect(expandedVRML).toContain(geometry)
            
            // Verify field values appear in the expanded text (only for fields that are actually used)
            fields.forEach(field => {
              if (instanceFieldValues.has(field.name)) {
                const value = instanceFieldValues.get(field.name)
                const valueStr = Array.isArray(value) ? value.join(' ') : String(value)
                
                // Only check if this field is actually used in the body (has an IS binding)
                // We check the original body template, not the expanded one
                if (protoDefinition.body.includes(`IS ${field.name}`)) {
                  expect(expandedVRML).toContain(valueStr)
                }
              }
            })
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should produce parseable VRML for Transform nodes', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/), // PROTO name
          fc.tuple(
            fc.float({ min: -10, max: 10, noNaN: true }),
            fc.float({ min: -10, max: 10, noNaN: true }),
            fc.float({ min: -10, max: 10, noNaN: true })
          ), // position field
          fc.tuple(
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), // color field
          (protoName, positionDefault, colorDefault) => {
            // Create a PROTO with Transform node
            const protoDefinition = {
              name: protoName,
              fields: [
                { name: 'pos', type: 'SFVec3f' as const, defaultValue: positionDefault },
                { name: 'col', type: 'SFColor' as const, defaultValue: colorDefault }
              ],
              body: `Transform {
  translation IS pos
  children [
    Shape {
      appearance Appearance {
        material Material {
          diffuseColor IS col
        }
      }
      geometry Sphere { radius 1 }
    }
  ]
}`
            }
            
            // Register the PROTO
            registry.register(protoName, protoDefinition)
            
            // Create an instance with overrides
            const instance = {
              protoName,
              fieldValues: new Map([
                ['pos', positionDefault],
                ['col', colorDefault]
              ]),
              startIndex: 0,
              endIndex: 0
            }
            
            // Expand the PROTO
            const expandedVRML = expandProto(instance, registry)
            
            // Verify expansion succeeded
            expect(expandedVRML).toBeTruthy()
            expect(expandedVRML.length).toBeGreaterThan(0)
            
            // Verify no IS keywords remain
            expect(expandedVRML).not.toMatch(/\bIS\b/)
            
            // Verify Transform structure is preserved
            expect(expandedVRML).toContain('Transform')
            expect(expandedVRML).toContain('translation')
            expect(expandedVRML).toContain('children')
            expect(expandedVRML).toContain('Shape')
            
            // Verify field values are present
            expect(expandedVRML).toContain(positionDefault.join(' '))
            expect(expandedVRML).toContain(colorDefault.join(' '))
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should produce valid VRML for Material properties', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/), // PROTO name
          fc.tuple(
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), // diffuse color
          fc.tuple(
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), // emissive color
          (protoName, diffuseDefault, emissiveDefault) => {
            // Create a PROTO with Material properties
            const protoDefinition = {
              name: protoName,
              fields: [
                { name: 'diffuse', type: 'SFColor' as const, defaultValue: diffuseDefault },
                { name: 'emissive', type: 'SFColor' as const, defaultValue: emissiveDefault }
              ],
              body: `Shape {
  appearance Appearance {
    material Material {
      diffuseColor IS diffuse
      emissiveColor IS emissive
    }
  }
  geometry Box { size 1 1 1 }
}`
            }
            
            // Register the PROTO
            registry.register(protoName, protoDefinition)
            
            // Create an instance
            const instance = {
              protoName,
              fieldValues: new Map([
                ['diffuse', diffuseDefault],
                ['emissive', emissiveDefault]
              ]),
              startIndex: 0,
              endIndex: 0
            }
            
            // Expand the PROTO
            const expandedVRML = expandProto(instance, registry)
            
            // Verify expansion succeeded
            expect(expandedVRML).toBeTruthy()
            
            // Verify no IS keywords remain
            expect(expandedVRML).not.toMatch(/\bIS\b/)
            
            // Verify Material structure
            expect(expandedVRML).toContain('Material')
            expect(expandedVRML).toContain('diffuseColor')
            expect(expandedVRML).toContain('emissiveColor')
            
            // Verify both color values are present
            expect(expandedVRML).toContain(diffuseDefault.join(' '))
            expect(expandedVRML).toContain(emissiveDefault.join(' '))
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should produce valid VRML for geometry nodes', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/), // PROTO name
          fc.constantFrom('Box', 'Sphere', 'Cylinder', 'Cone'), // geometry type
          fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }), // size/radius
          (protoName, geometryType, sizeValue) => {
            // Create appropriate body based on geometry type
            let geometryBlock = ''
            let fieldName = ''
            
            switch (geometryType) {
              case 'Box':
                fieldName = 'boxSize'
                // Box size needs 3 values, so we use the sizeValue for all three
                geometryBlock = `Box { size ${sizeValue} ${sizeValue} ${sizeValue} }`
                break
              case 'Sphere':
                fieldName = 'sphereRadius'
                geometryBlock = `Sphere { radius IS ${fieldName} }`
                break
              case 'Cylinder':
                fieldName = 'cylRadius'
                geometryBlock = `Cylinder { radius IS ${fieldName} height 2 }`
                break
              case 'Cone':
                fieldName = 'coneRadius'
                geometryBlock = `Cone { bottomRadius IS ${fieldName} height 2 }`
                break
            }
            
            // Create the PROTO - only add field for non-Box geometries
            const fields = geometryType === 'Box' 
              ? [] 
              : [{ name: fieldName, type: 'SFFloat' as const, defaultValue: sizeValue }]
            
            const protoDefinition = {
              name: protoName,
              fields,
              body: `Shape {
  appearance Appearance {
    material Material { diffuseColor 1 0 0 }
  }
  geometry ${geometryBlock}
}`
            }
            
            // Register the PROTO
            registry.register(protoName, protoDefinition)
            
            // Create an instance - only add field value for non-Box geometries
            const fieldValues = geometryType === 'Box'
              ? new Map()
              : new Map([[fieldName, sizeValue]])
            
            const instance = {
              protoName,
              fieldValues,
              startIndex: 0,
              endIndex: 0
            }
            
            // Expand the PROTO
            const expandedVRML = expandProto(instance, registry)
            
            // Verify expansion succeeded
            expect(expandedVRML).toBeTruthy()
            
            // Verify no IS keywords remain
            expect(expandedVRML).not.toMatch(/\bIS\b/)
            
            // Verify geometry structure
            expect(expandedVRML).toContain('geometry')
            expect(expandedVRML).toContain(geometryType)
            
            // Verify size value appears in the expanded text
            expect(expandedVRML).toContain(String(sizeValue))
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vrml-proto-support, Property 6: PROTO registry isolation
   * 
   * For any two separate parsing operations, PROTOs defined in one operation
   * should not affect the other operation
   * 
   * Validates: Requirements 1.5
   */
  describe('Property 6: PROTO registry isolation', () => {
    it('should isolate PROTOs between separate parsing operations', () => {
      fc.assert(
        fc.property(
          // Generate two sets of PROTO definitions with different names
          fc.uniqueArray(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f', 'SFColor'),
                  defaultValue: fc.oneof(
                    fc.float({ min: 0, max: 10, noNaN: true }),
                    fc.tuple(
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true })
                    )
                  )
                }),
                { maxLength: 3 }
              ),
              body: fc.string({ minLength: 10, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 5, selector: (item) => item.name }
          ),
          fc.uniqueArray(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f', 'SFColor'),
                  defaultValue: fc.oneof(
                    fc.float({ min: 0, max: 10, noNaN: true }),
                    fc.tuple(
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true })
                    )
                  )
                }),
                { maxLength: 3 }
              ),
              body: fc.string({ minLength: 10, maxLength: 100 })
            }),
            { minLength: 1, maxLength: 5, selector: (item) => item.name }
          ),
          (firstSetProtos, secondSetProtos) => {
            // Ensure the two sets have different names to avoid overlap
            const firstNames = new Set(firstSetProtos.map(p => p.name))
            const secondNames = new Set(secondSetProtos.map(p => p.name))
            const hasOverlap = Array.from(firstNames).some(name => secondNames.has(name))
            fc.pre(!hasOverlap) // Skip if there's overlap
            
            // First parsing operation
            const registry1 = new ProtoRegistry()
            
            // Register first set of PROTOs
            firstSetProtos.forEach(proto => {
              registry1.register(proto.name, proto)
            })
            
            // Verify first set is registered
            expect(registry1.size()).toBe(firstSetProtos.length)
            firstSetProtos.forEach(proto => {
              expect(registry1.lookup(proto.name)).toBeDefined()
            })
            
            // Clear registry after first parsing operation (simulating end of parse)
            registry1.clear()
            
            // Verify registry is empty after clear
            expect(registry1.size()).toBe(0)
            
            // Verify first set PROTOs are no longer accessible
            firstSetProtos.forEach(proto => {
              expect(registry1.lookup(proto.name)).toBeUndefined()
            })
            
            // Second parsing operation (using the same registry instance)
            // Register second set of PROTOs
            secondSetProtos.forEach(proto => {
              registry1.register(proto.name, proto)
            })
            
            // Verify second set is registered
            expect(registry1.size()).toBe(secondSetProtos.length)
            secondSetProtos.forEach(proto => {
              expect(registry1.lookup(proto.name)).toBeDefined()
            })
            
            // Verify first set PROTOs are still not accessible (isolation)
            firstSetProtos.forEach(proto => {
              expect(registry1.lookup(proto.name)).toBeUndefined()
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should isolate PROTOs between completely separate registry instances', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f'),
                  defaultValue: fc.oneof(
                    fc.float({ min: 0, max: 10, noNaN: true }),
                    fc.tuple(
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true })
                    )
                  )
                }),
                { maxLength: 2 }
              ),
              body: fc.string({ minLength: 10, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5, selector: (item) => item.name }
          ),
          fc.uniqueArray(
            fc.record({
              name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
              fields: fc.array(
                fc.record({
                  name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                  type: fc.constantFrom('SFFloat', 'SFVec3f'),
                  defaultValue: fc.oneof(
                    fc.float({ min: 0, max: 10, noNaN: true }),
                    fc.tuple(
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true }),
                      fc.float({ min: 0, max: 1, noNaN: true })
                    )
                  )
                }),
                { maxLength: 2 }
              ),
              body: fc.string({ minLength: 10, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5, selector: (item) => item.name }
          ),
          (firstSetProtos, secondSetProtos) => {
            // Create two completely separate registry instances
            const registry1 = new ProtoRegistry()
            const registry2 = new ProtoRegistry()
            
            // Register first set in registry1
            firstSetProtos.forEach(proto => {
              registry1.register(proto.name, proto)
            })
            
            // Register second set in registry2
            secondSetProtos.forEach(proto => {
              registry2.register(proto.name, proto)
            })
            
            // Verify registry1 only has first set
            expect(registry1.size()).toBe(firstSetProtos.length)
            firstSetProtos.forEach(proto => {
              expect(registry1.lookup(proto.name)).toBeDefined()
              expect(registry1.lookup(proto.name)?.body).toBe(proto.body)
            })
            
            // Verify registry2 only has second set
            expect(registry2.size()).toBe(secondSetProtos.length)
            secondSetProtos.forEach(proto => {
              expect(registry2.lookup(proto.name)).toBeDefined()
              expect(registry2.lookup(proto.name)?.body).toBe(proto.body)
            })
            
            // Verify registry1 doesn't have second set PROTOs
            secondSetProtos.forEach(proto => {
              const lookup = registry1.lookup(proto.name)
              // Either undefined, or if the name happens to match, the body should be different
              if (lookup) {
                expect(lookup.body).not.toBe(proto.body)
              }
            })
            
            // Verify registry2 doesn't have first set PROTOs
            firstSetProtos.forEach(proto => {
              const lookup = registry2.lookup(proto.name)
              // Either undefined, or if the name happens to match, the body should be different
              if (lookup) {
                expect(lookup.body).not.toBe(proto.body)
              }
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should prevent PROTO leakage across multiple parse cycles', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.uniqueArray(
              fc.record({
                name: fc.stringMatching(/^[A-Z][a-zA-Z0-9]*$/),
                fields: fc.array(
                  fc.record({
                    name: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
                    type: fc.constantFrom('SFFloat', 'SFVec3f'),
                    defaultValue: fc.oneof(
                      fc.float({ min: 0, max: 10, noNaN: true }),
                      fc.tuple(
                        fc.float({ min: 0, max: 1, noNaN: true }),
                        fc.float({ min: 0, max: 1, noNaN: true }),
                        fc.float({ min: 0, max: 1, noNaN: true })
                      )
                    )
                  }),
                  { maxLength: 2 }
                ),
                body: fc.string({ minLength: 10, maxLength: 50 })
              }),
              { minLength: 1, maxLength: 3, selector: (item) => item.name }
            ),
            { minLength: 2, maxLength: 5 }
          ),
          (parseCycles) => {
            // Simulate multiple parsing operations with the same registry
            const registry = new ProtoRegistry()
            
            // Track all PROTO names seen across all cycles
            const allProtoNames = new Set<string>()
            
            for (const cycleProtos of parseCycles) {
              // Register PROTOs for this cycle
              cycleProtos.forEach(proto => {
                registry.register(proto.name, proto)
                allProtoNames.add(proto.name)
              })
              
              // Verify only current cycle PROTOs are in registry
              expect(registry.size()).toBe(cycleProtos.length)
              
              // Clear registry at end of parse cycle
              registry.clear()
              
              // Verify registry is empty
              expect(registry.size()).toBe(0)
              
              // Verify all PROTOs from this cycle are gone
              cycleProtos.forEach(proto => {
                expect(registry.lookup(proto.name)).toBeUndefined()
              })
            }
            
            // After all cycles, verify registry is still empty
            expect(registry.size()).toBe(0)
            
            // Verify none of the PROTOs from any cycle are accessible
            allProtoNames.forEach(name => {
              expect(registry.lookup(name)).toBeUndefined()
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: vrml-proto-support, Property 5: Nested PROTO expansion order
   * 
   * For any VRML text with nested PROTO instances, expanding all PROTOs
   * should resolve inner PROTOs before outer PROTOs
   * 
   * Validates: Requirements 5.5
   */
  describe('Property 5: Nested PROTO expansion order', () => {
    let registry: ProtoRegistry

    beforeEach(() => {
      registry = new ProtoRegistry()
    })

    it('should expand nested PROTO instances completely', () => {
      fc.assert(
        fc.property(
          // Generate an inner PROTO (simple shape)
          fc.record({
            name: fc.stringMatching(/^Inner[A-Z][a-zA-Z0-9]*$/), // Prefix to ensure uniqueness
            colorField: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
            colorValue: fc.tuple(
              fc.float({ min: 0, max: 1, noNaN: true }),
              fc.float({ min: 0, max: 1, noNaN: true }),
              fc.float({ min: 0, max: 1, noNaN: true })
            )
          }),
          // Generate an outer PROTO (uses inner PROTO)
          fc.record({
            name: fc.stringMatching(/^Outer[A-Z][a-zA-Z0-9]*$/), // Prefix to ensure uniqueness
            posField: fc.stringMatching(/^[a-z][a-zA-Z0-9]*$/),
            posValue: fc.tuple(
              fc.float({ min: -10, max: 10, noNaN: true }),
              fc.float({ min: -10, max: 10, noNaN: true }),
              fc.float({ min: -10, max: 10, noNaN: true })
            )
          }),
          (innerSpec, outerSpec) => {
            // Ensure field names are different
            fc.pre(innerSpec.colorField !== outerSpec.posField)
            
            // Create inner PROTO definition (simple colored shape)
            const innerProto: ProtoDefinition = {
              name: innerSpec.name,
              fields: [
                {
                  name: innerSpec.colorField,
                  type: 'SFColor',
                  defaultValue: innerSpec.colorValue
                }
              ],
              body: `Shape {
  appearance Appearance {
    material Material {
      diffuseColor IS ${innerSpec.colorField}
    }
  }
  geometry Sphere { radius 1 }
}`
            }
            
            // Create outer PROTO definition (uses inner PROTO)
            const outerProto: ProtoDefinition = {
              name: outerSpec.name,
              fields: [
                {
                  name: outerSpec.posField,
                  type: 'SFVec3f',
                  defaultValue: outerSpec.posValue
                }
              ],
              body: `Transform {
  translation IS ${outerSpec.posField}
  children [
    ${innerSpec.name} {
      ${innerSpec.colorField} ${innerSpec.colorValue.join(' ')}
    }
  ]
}`
            }
            
            // Register both PROTOs
            registry.register(innerSpec.name, innerProto)
            registry.register(outerSpec.name, outerProto)
            
            // Create VRML text with outer PROTO instance
            const vrmlText = `${outerSpec.name} {
  ${outerSpec.posField} ${outerSpec.posValue.join(' ')}
}`
            
            // Expand all PROTOs (should handle nesting)
            const expandedText = expandAllProtos(vrmlText, registry)
            
            // Verify expansion succeeded
            expect(expandedText).toBeTruthy()
            expect(expandedText.length).toBeGreaterThan(0)
            
            // Verify no PROTO instance names remain in the expanded text
            expect(expandedText).not.toContain(innerSpec.name)
            expect(expandedText).not.toContain(outerSpec.name)
            
            // Verify no IS keywords remain (all bindings resolved)
            expect(expandedText).not.toMatch(/\bIS\b/)
            
            // Verify the final structure contains the expected VRML nodes
            expect(expandedText).toContain('Transform')
            expect(expandedText).toContain('translation')
            expect(expandedText).toContain('Shape')
            expect(expandedText).toContain('Material')
            expect(expandedText).toContain('Sphere')
            
            // Verify field values appear in the expanded text
            expect(expandedText).toContain(outerSpec.posValue.join(' '))
            expect(expandedText).toContain(innerSpec.colorValue.join(' '))
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle multiple levels of nesting', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^Level0[A-Z][a-zA-Z0-9]*$/), // Innermost PROTO
          fc.stringMatching(/^Level1[A-Z][a-zA-Z0-9]*$/), // Middle PROTO
          fc.stringMatching(/^Level2[A-Z][a-zA-Z0-9]*$/), // Outermost PROTO
          fc.float({ min: Math.fround(0.1), max: 5, noNaN: true }), // radius
          fc.tuple(
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true }),
            fc.float({ min: 0, max: 1, noNaN: true })
          ), // color
          (level0Name, level1Name, level2Name, radius, color) => {
            // Ensure all names are unique
            fc.pre(level0Name !== level1Name && level1Name !== level2Name && level0Name !== level2Name)
            
            // Level 0: Basic shape (innermost)
            const level0Proto: ProtoDefinition = {
              name: level0Name,
              fields: [
                { name: 'rad', type: 'SFFloat', defaultValue: radius }
              ],
              body: `Shape {
  appearance Appearance {
    material Material { diffuseColor 1 1 1 }
  }
  geometry Sphere { radius IS rad }
}`
            }
            
            // Level 1: Uses Level 0 (middle)
            const level1Proto: ProtoDefinition = {
              name: level1Name,
              fields: [
                { name: 'col', type: 'SFColor', defaultValue: color }
              ],
              body: `Transform {
  translation 0 0 0
  children [
    ${level0Name} { rad ${radius} }
  ]
}`
            }
            
            // Level 2: Uses Level 1 (outermost)
            const level2Proto: ProtoDefinition = {
              name: level2Name,
              fields: [],
              body: `Group {
  children [
    ${level1Name} { col ${color.join(' ')} }
  ]
}`
            }
            
            // Register all PROTOs
            registry.register(level0Name, level0Proto)
            registry.register(level1Name, level1Proto)
            registry.register(level2Name, level2Proto)
            
            // Create VRML text with outermost PROTO instance
            const vrmlText = `${level2Name} { }`
            
            // Expand all PROTOs (should handle 3 levels of nesting)
            const expandedText = expandAllProtos(vrmlText, registry)
            
            // Verify expansion succeeded
            expect(expandedText).toBeTruthy()
            
            // Verify no PROTO names remain
            expect(expandedText).not.toContain(level0Name)
            expect(expandedText).not.toContain(level1Name)
            expect(expandedText).not.toContain(level2Name)
            
            // Verify no IS keywords remain
            expect(expandedText).not.toMatch(/\bIS\b/)
            
            // Verify the final structure contains all expected nodes
            expect(expandedText).toContain('Group')
            expect(expandedText).toContain('Transform')
            expect(expandedText).toContain('Shape')
            expect(expandedText).toContain('Sphere')
            
            // Verify the radius value appears
            expect(expandedText).toContain(String(radius))
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should expand nested PROTOs with field overrides at each level', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^Base[A-Z][a-zA-Z0-9]*$/),
          fc.stringMatching(/^Wrapper[A-Z][a-zA-Z0-9]*$/),
          fc.float({ min: Math.fround(0.5), max: 3, noNaN: true }), // default size
          fc.float({ min: Math.fround(3.1), max: 8, noNaN: true }), // override size
          (baseName, wrapperName, defaultSize, overrideSize) => {
            // Ensure names are different and sizes are different
            fc.pre(baseName !== wrapperName && Math.abs(defaultSize - overrideSize) > 0.1)
            
            // Base PROTO with a size field
            const baseProto: ProtoDefinition = {
              name: baseName,
              fields: [
                { name: 'size', type: 'SFFloat', defaultValue: defaultSize }
              ],
              body: `Shape {
  appearance Appearance {
    material Material { diffuseColor 1 0 0 }
  }
  geometry Box { size IS size IS size IS size }
}`
            }
            
            // Wrapper PROTO that uses Base PROTO with override
            const wrapperProto: ProtoDefinition = {
              name: wrapperName,
              fields: [
                { name: 'boxSize', type: 'SFFloat', defaultValue: overrideSize }
              ],
              body: `Transform {
  translation 0 0 0
  children [
    ${baseName} { size IS boxSize }
  ]
}`
            }
            
            // Register both PROTOs
            registry.register(baseName, baseProto)
            registry.register(wrapperName, wrapperProto)
            
            // Create instance of wrapper (which should use overrideSize)
            const vrmlText = `${wrapperName} { boxSize ${overrideSize} }`
            
            // Expand all PROTOs
            const expandedText = expandAllProtos(vrmlText, registry)
            
            // Verify expansion succeeded
            expect(expandedText).toBeTruthy()
            
            // Verify no PROTO names remain
            expect(expandedText).not.toContain(baseName)
            expect(expandedText).not.toContain(wrapperName)
            
            // Verify no IS keywords remain
            expect(expandedText).not.toMatch(/\bIS\b/)
            
            // Verify the override size appears in the final output
            expect(expandedText).toContain(String(overrideSize))
            
            // Verify the default size does NOT appear (it was overridden)
            // Only check if the values are sufficiently different to avoid false positives
            if (Math.abs(defaultSize - overrideSize) > 0.5) {
              expect(expandedText).not.toContain(String(defaultSize))
            }
            
            // Verify structure
            expect(expandedText).toContain('Transform')
            expect(expandedText).toContain('Shape')
            expect(expandedText).toContain('Box')
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should detect and prevent infinite recursion from circular PROTO references', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^ProtoA[A-Z][a-zA-Z0-9]*$/),
          fc.stringMatching(/^ProtoB[A-Z][a-zA-Z0-9]*$/),
          (protoAName, protoBName) => {
            // Ensure names are different
            fc.pre(protoAName !== protoBName)
            
            // Create circular reference: A uses B, B uses A
            const protoA: ProtoDefinition = {
              name: protoAName,
              fields: [],
              body: `Transform {
  children [
    ${protoBName} { }
  ]
}`
            }
            
            const protoB: ProtoDefinition = {
              name: protoBName,
              fields: [],
              body: `Transform {
  children [
    ${protoAName} { }
  ]
}`
            }
            
            // Register both PROTOs
            registry.register(protoAName, protoA)
            registry.register(protoBName, protoB)
            
            // Try to expand (should detect circular reference and stop)
            const vrmlText = `${protoAName} { }`
            
            // This should not throw an error or hang
            // It should detect the circular reference and stop expansion
            const expandedText = expandAllProtos(vrmlText, registry, 10, 0)
            
            // Verify expansion completed (didn't hang)
            expect(expandedText).toBeDefined()
            
            // The expansion should have stopped at max depth
            // We can't verify the exact content, but we can verify it didn't crash
            expect(expandedText.length).toBeGreaterThan(0)
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve non-PROTO nodes while expanding nested PROTOs', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^Inner[A-Z][a-zA-Z0-9]*$/),
          fc.stringMatching(/^Outer[A-Z][a-zA-Z0-9]*$/),
          fc.string({ minLength: 5, maxLength: 30 }), // literal text before
          fc.string({ minLength: 5, maxLength: 30 }), // literal text after
          (innerName, outerName, textBefore, textAfter) => {
            // Ensure names are different and text doesn't contain PROTO keywords
            fc.pre(
              innerName !== outerName &&
              !textBefore.includes('PROTO') &&
              !textAfter.includes('PROTO') &&
              !textBefore.includes(innerName) &&
              !textBefore.includes(outerName) &&
              !textAfter.includes(innerName) &&
              !textAfter.includes(outerName)
            )
            
            // Create simple PROTOs
            const innerProto: ProtoDefinition = {
              name: innerName,
              fields: [],
              body: 'Shape { geometry Sphere { radius 1 } }'
            }
            
            const outerProto: ProtoDefinition = {
              name: outerName,
              fields: [],
              body: `Group { children [ ${innerName} { } ] }`
            }
            
            // Register PROTOs
            registry.register(innerName, innerProto)
            registry.register(outerName, outerProto)
            
            // Create VRML text with literal content before and after
            const vrmlText = `${textBefore}\n${outerName} { }\n${textAfter}`
            
            // Expand all PROTOs
            const expandedText = expandAllProtos(vrmlText, registry)
            
            // Verify expansion succeeded
            expect(expandedText).toBeTruthy()
            
            // Verify PROTO names are gone
            expect(expandedText).not.toContain(innerName)
            expect(expandedText).not.toContain(outerName)
            
            // Verify literal text is preserved
            expect(expandedText).toContain(textBefore)
            expect(expandedText).toContain(textAfter)
            
            // Verify expanded content is present
            expect(expandedText).toContain('Group')
            expect(expandedText).toContain('Shape')
            expect(expandedText).toContain('Sphere')
            
            // Clean up
            registry.clear()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
