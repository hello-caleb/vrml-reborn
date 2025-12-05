/**
 * VRML PROTO (Prototype) Support
 * 
 * This module provides infrastructure for parsing and managing VRML PROTO definitions.
 * PROTOs allow users to create reusable, parameterized node templates.
 */

/**
 * Represents a field in a PROTO definition
 */
export interface ProtoField {
  name: string
  type: 'SFFloat' | 'SFVec3f' | 'SFRotation' | 'SFColor' | 'SFNode' | 'MFNode'
  defaultValue: any
}

/**
 * Represents a complete PROTO definition
 */
export interface ProtoDefinition {
  name: string
  fields: ProtoField[]
  body: string  // Template with IS bindings
}

/**
 * Registry for storing and managing PROTO definitions
 * 
 * Requirements:
 * - 1.2: Store PROTOs in registry for later instantiation
 * - 1.3: Use most recent definition when same name is defined multiple times
 * - 1.5: Clear registry to prevent memory leaks
 * - 6.1: Separate PROTO parser module
 * - 6.2: Don't modify main VRML parsing logic
 */
export class ProtoRegistry {
  private protos: Map<string, ProtoDefinition>

  constructor() {
    this.protos = new Map()
  }

  /**
   * Register a PROTO definition in the registry
   * If a PROTO with the same name already exists, it will be replaced (Requirement 1.3)
   * 
   * @param name - The name of the PROTO
   * @param definition - The complete PROTO definition
   */
  register(name: string, definition: ProtoDefinition): void {
    this.protos.set(name, definition)
    console.log(`📝 Registered PROTO: ${name} with ${definition.fields.length} fields`)
  }

  /**
   * Look up a PROTO definition by name
   * 
   * @param name - The name of the PROTO to look up
   * @returns The PROTO definition if found, undefined otherwise
   */
  lookup(name: string): ProtoDefinition | undefined {
    return this.protos.get(name)
  }

  /**
   * Clear all PROTO definitions from the registry
   * This should be called after parsing completes to prevent memory leaks (Requirement 1.5)
   */
  clear(): void {
    const count = this.protos.size
    this.protos.clear()
    console.log(`🧹 Cleared ${count} PROTO definitions from registry`)
  }

  /**
   * Get the number of registered PROTOs (useful for debugging)
   */
  size(): number {
    return this.protos.size
  }

  /**
   * Check if a PROTO with the given name exists
   */
  has(name: string): boolean {
    return this.protos.has(name)
  }

  /**
   * Get all registered PROTO names (useful for debugging)
   */
  getNames(): string[] {
    return Array.from(this.protos.keys())
  }
}

/**
 * Extract all PROTO blocks from VRML text
 * 
 * Requirements:
 * - 1.1: Extract PROTO name, field declarations, and body template
 * 
 * @param vrmlText - The complete VRML file text
 * @returns Object containing extracted PROTO definitions and cleaned text
 */
export function extractProtoBlocks(vrmlText: string): {
  protos: ProtoDefinition[]
  cleanedText: string
} {
  const protos: ProtoDefinition[] = []
  let cleanedText = vrmlText
  
  // Find all PROTO definitions using pattern: PROTO Name [
  const protoPattern = /PROTO\s+(\w+)\s*\[/g
  let match: RegExpExecArray | null
  
  // Store all PROTO blocks to remove them later
  const protoBlocks: { start: number; end: number; definition: ProtoDefinition }[] = []
  
  while ((match = protoPattern.exec(vrmlText)) !== null) {
    const protoStart = match.index
    const protoName = match[1]
    const fieldsStart = match.index + match[0].length
    
    try {
      // Find the end of the field declarations (closing ])
      let braceCount = 1 // We've seen the opening [
      let fieldsEnd = fieldsStart
      
      while (fieldsEnd < vrmlText.length && braceCount > 0) {
        if (vrmlText[fieldsEnd] === '[') braceCount++
        else if (vrmlText[fieldsEnd] === ']') braceCount--
        fieldsEnd++
      }
      
      if (braceCount !== 0) {
        console.warn(`⚠️ Malformed PROTO ${protoName}: unmatched field brackets`)
        continue
      }
      
      // Extract field declarations
      const fieldText = vrmlText.substring(fieldsStart, fieldsEnd - 1)
      
      // Find the body opening brace
      let bodyStart = fieldsEnd
      while (bodyStart < vrmlText.length && vrmlText[bodyStart] !== '{') {
        bodyStart++
      }
      
      if (bodyStart >= vrmlText.length) {
        console.warn(`⚠️ Malformed PROTO ${protoName}: missing body`)
        continue
      }
      
      // Count braces to find the end of the PROTO body
      braceCount = 1 // We've seen the opening {
      let bodyEnd = bodyStart + 1
      
      while (bodyEnd < vrmlText.length && braceCount > 0) {
        if (vrmlText[bodyEnd] === '{') braceCount++
        else if (vrmlText[bodyEnd] === '}') braceCount--
        bodyEnd++
      }
      
      if (braceCount !== 0) {
        console.warn(`⚠️ Malformed PROTO ${protoName}: unmatched body braces`)
        continue
      }
      
      // Extract body content (without the outer braces)
      const bodyText = vrmlText.substring(bodyStart + 1, bodyEnd - 1)
      
      // Parse the PROTO definition
      const definition = parseProtoDefinition(protoName, fieldText, bodyText)
      
      if (definition) {
        protoBlocks.push({
          start: protoStart,
          end: bodyEnd,
          definition
        })
        protos.push(definition)
      }
    } catch (error) {
      console.warn(`⚠️ Error parsing PROTO ${protoName}:`, error)
      // Continue parsing other PROTOs (Requirement 1.4)
    }
  }
  
  // Remove PROTO blocks from the text (in reverse order to maintain indices)
  protoBlocks.sort((a, b) => b.start - a.start)
  for (const block of protoBlocks) {
    cleanedText = cleanedText.substring(0, block.start) + cleanedText.substring(block.end)
  }
  
  return { protos, cleanedText }
}

/**
 * Parse field value based on field type
 * 
 * Requirements:
 * - 2.1: Parse SFFloat fields
 * - 2.2: Parse SFVec3f fields
 * - 2.3: Parse SFRotation fields
 * - 2.4: Parse SFColor fields
 * 
 * @param type - The field type
 * @param valueStr - The string representation of the value
 * @returns The parsed value
 */
function parseFieldValue(type: string, valueStr: string): any {
  const trimmed = valueStr.trim()
  
  switch (type) {
    case 'SFFloat':
      return parseFloat(trimmed)
    
    case 'SFVec3f':
      return trimmed.split(/\s+/).map(Number).slice(0, 3)
    
    case 'SFRotation':
      return trimmed.split(/\s+/).map(Number).slice(0, 4)
    
    case 'SFColor':
      return trimmed.split(/\s+/).map(Number).slice(0, 3)
    
    case 'SFNode':
    case 'MFNode':
      // Keep as string for later parsing
      return trimmed
    
    default:
      console.warn(`⚠️ Unknown field type: ${type}`)
      return trimmed
  }
}

/**
 * Parse PROTO field declarations
 * 
 * Requirements:
 * - 2.1: Parse SFFloat fields with default values
 * - 2.2: Parse SFVec3f fields with default values
 * - 2.3: Parse SFRotation fields with default values
 * - 2.4: Parse SFColor fields with default values
 * 
 * @param fieldText - The text containing field declarations
 * @returns Array of parsed ProtoField objects
 */
function parseProtoFields(fieldText: string): ProtoField[] {
  const fields: ProtoField[] = []
  
  // Pattern: field Type name defaultValue
  // Example: field SFFloat radius 1.0
  // Example: field SFVec3f position 0 0 0
  const fieldPattern = /field\s+(SFFloat|SFVec3f|SFRotation|SFColor|SFNode|MFNode)\s+(\w+)\s+([^\n]+?)(?=\s*(?:field|$))/gs
  
  let match: RegExpExecArray | null
  while ((match = fieldPattern.exec(fieldText)) !== null) {
    const type = match[1] as ProtoField['type']
    const name = match[2]
    const defaultValueStr = match[3].trim()
    
    try {
      const defaultValue = parseFieldValue(type, defaultValueStr)
      
      fields.push({
        name,
        type,
        defaultValue
      })
    } catch (error) {
      console.warn(`⚠️ Error parsing field ${name}:`, error)
      // Use a sensible default based on type
      let defaultValue: any
      switch (type) {
        case 'SFFloat':
          defaultValue = 0
          break
        case 'SFVec3f':
        case 'SFColor':
          defaultValue = [0, 0, 0]
          break
        case 'SFRotation':
          defaultValue = [0, 0, 1, 0]
          break
        default:
          defaultValue = null
      }
      
      fields.push({ name, type, defaultValue })
    }
  }
  
  return fields
}

/**
 * Parse a complete PROTO definition
 * 
 * Requirements:
 * - 1.1: Extract PROTO name, field declarations, and body template
 * 
 * @param name - The PROTO name
 * @param fieldText - The field declarations text
 * @param bodyText - The body template text
 * @returns The parsed ProtoDefinition or null if parsing fails
 */
function parseProtoDefinition(
  name: string,
  fieldText: string,
  bodyText: string
): ProtoDefinition | null {
  try {
    // Parse field declarations
    const fields = parseProtoFields(fieldText)
    
    // Store body template with IS bindings preserved
    // The body will be used as a template for expansion
    const body = bodyText.trim()
    
    console.log(`✅ Parsed PROTO ${name} with ${fields.length} fields`)
    
    return {
      name,
      fields,
      body
    }
  } catch (error) {
    console.error(`❌ Failed to parse PROTO ${name}:`, error)
    return null
  }
}

/**
 * Format a field value as a string for VRML output
 * 
 * @param value - The field value to format
 * @returns String representation suitable for VRML
 */
function formatFieldValue(value: any): string {
  if (Array.isArray(value)) {
    return value.join(' ')
  }
  return String(value)
}

/**
 * Resolve IS bindings in a PROTO body template
 * 
 * Requirements:
 * - 3.1: Replace IS keyword with corresponding field values
 * - 3.2: Handle multiple IS bindings for same field
 * - 3.3: Detect non-existent field references
 * - 3.4: Use default values for failed bindings
 * 
 * @param bodyTemplate - The PROTO body template with IS bindings
 * @param fieldValues - Map of field names to their values
 * @param protoName - Name of the PROTO (for logging)
 * @returns The body with all IS bindings resolved
 */
export function resolveISBindings(
  bodyTemplate: string,
  fieldValues: Map<string, any>,
  protoName: string = 'Unknown'
): string {
  let resolvedBody = bodyTemplate
  
  // Pattern to find "IS fieldName" occurrences
  // This matches: property IS fieldName
  // Example: "diffuseColor IS boxColor" or "radius IS size"
  const isPattern = /(\w+)\s+IS\s+(\w+)/g
  
  let match: RegExpExecArray | null
  const replacements: { original: string; replacement: string; fieldName: string }[] = []
  
  // Collect all IS bindings first
  while ((match = isPattern.exec(bodyTemplate)) !== null) {
    const propertyName = match[1]
    const fieldName = match[2]
    const fullMatch = match[0]
    
    // Check if the field exists in the field values map
    if (fieldValues.has(fieldName)) {
      const fieldValue = fieldValues.get(fieldName)
      const formattedValue = formatFieldValue(fieldValue)
      
      // Replace "property IS fieldName" with "property value"
      const replacement = `${propertyName} ${formattedValue}`
      
      replacements.push({
        original: fullMatch,
        replacement,
        fieldName
      })
      
      console.log(`🔗 Resolved IS binding: ${fullMatch} → ${replacement}`)
    } else {
      // Field doesn't exist - log warning (Requirement 3.3)
      console.warn(`⚠️ PROTO ${protoName}: IS binding references non-existent field "${fieldName}"`)
      
      // Keep the original text as fallback (Requirement 3.4)
      // This allows the parser to potentially use a default value
      replacements.push({
        original: fullMatch,
        replacement: fullMatch, // Keep as-is
        fieldName
      })
    }
  }
  
  // Apply all replacements
  // We need to be careful about multiple IS bindings for the same field (Requirement 3.2)
  // By processing all matches, we handle multiple bindings naturally
  for (const { original, replacement } of replacements) {
    // Replace all occurrences of this specific IS binding
    // Use word boundaries to avoid matching "IS a" when we have "IS a0"
    const escapedOriginal = escapeRegExp(original)
    // Add word boundary at the end to ensure we don't match partial field names
    const pattern = new RegExp(escapedOriginal + '\\b', 'g')
    resolvedBody = resolvedBody.replace(pattern, replacement)
  }
  
  return resolvedBody
}

/**
 * Escape special regex characters in a string
 * 
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Represents a PROTO instance with field value overrides
 */
export interface ProtoInstance {
  protoName: string
  fieldValues: Map<string, any>
  startIndex: number
  endIndex: number
}

/**
 * Parse PROTO instances from VRML text
 * 
 * Requirements:
 * - 4.1: Find PROTO instance patterns (ProtoName { ... })
 * - 4.2: Extract field value overrides
 * 
 * @param vrmlText - The VRML text to search for PROTO instances
 * @param registry - The PROTO registry to validate instance names
 * @returns Array of parsed PROTO instances
 */
export function parseProtoInstances(
  vrmlText: string,
  registry: ProtoRegistry
): ProtoInstance[] {
  const instances: ProtoInstance[] = []
  
  // Pattern to find PROTO instances: ProtoName { ... }
  // We need to match any word followed by an opening brace
  // But we need to check if it's a registered PROTO name
  const instancePattern = /(\w+)\s*\{/g
  
  let match: RegExpExecArray | null
  
  while ((match = instancePattern.exec(vrmlText)) !== null) {
    const protoName = match[1]
    const startIndex = match.index
    const bodyStart = match.index + match[0].length - 1 // Position of '{'
    
    // Check if this is a registered PROTO
    if (!registry.has(protoName)) {
      // Not a PROTO instance, skip it
      continue
    }
    
    // Find the matching closing brace
    let braceCount = 1
    let bodyEnd = bodyStart + 1
    
    while (bodyEnd < vrmlText.length && braceCount > 0) {
      if (vrmlText[bodyEnd] === '{') braceCount++
      else if (vrmlText[bodyEnd] === '}') braceCount--
      bodyEnd++
    }
    
    if (braceCount !== 0) {
      console.warn(`⚠️ Malformed PROTO instance ${protoName}: unmatched braces`)
      continue
    }
    
    // Extract the body content (without the outer braces)
    const bodyText = vrmlText.substring(bodyStart + 1, bodyEnd - 1)
    
    // Parse field value overrides from the body
    const fieldValues = parseProtoInstanceFields(protoName, bodyText, registry)
    
    instances.push({
      protoName,
      fieldValues,
      startIndex,
      endIndex: bodyEnd
    })
    
    console.log(`🔍 Found PROTO instance: ${protoName} with ${fieldValues.size} field overrides`)
  }
  
  return instances
}

/**
 * Parse field value overrides from a PROTO instance body
 * 
 * Requirements:
 * - 4.2: Extract field value overrides
 * - Parse field values by type
 * 
 * @param protoName - Name of the PROTO being instantiated
 * @param bodyText - The body text of the PROTO instance
 * @param registry - The PROTO registry to look up field types
 * @returns Map of field names to their override values
 */
function parseProtoInstanceFields(
  protoName: string,
  bodyText: string,
  registry: ProtoRegistry
): Map<string, any> {
  const fieldValues = new Map<string, any>()
  
  // Look up the PROTO definition to get field types
  const definition = registry.lookup(protoName)
  if (!definition) {
    console.warn(`⚠️ Cannot parse fields for undefined PROTO: ${protoName}`)
    return fieldValues
  }
  
  // Create a map of field names to types for quick lookup
  const fieldTypes = new Map<string, string>()
  for (const field of definition.fields) {
    fieldTypes.set(field.name, field.type)
  }
  
  // Pattern to match field assignments: fieldName value
  // Example: "boxColor 0 1 0" or "boxSize 2"
  // We need to be careful to match the right amount of values based on type
  
  for (const field of definition.fields) {
    const fieldName = field.name
    const fieldType = field.type
    
    // Create a pattern to match this specific field
    // Pattern: fieldName followed by values (number of values depends on type)
    let valuePattern: RegExp
    
    switch (fieldType) {
      case 'SFFloat':
        // Match: fieldName number
        valuePattern = new RegExp(`${fieldName}\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`, 'i')
        break
      
      case 'SFVec3f':
      case 'SFColor':
        // Match: fieldName number number number
        valuePattern = new RegExp(
          `${fieldName}\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`,
          'i'
        )
        break
      
      case 'SFRotation':
        // Match: fieldName number number number number
        valuePattern = new RegExp(
          `${fieldName}\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)\\s+([-+]?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?)`,
          'i'
        )
        break
      
      case 'SFNode':
      case 'MFNode':
        // For node types, we'd need more complex parsing
        // For now, skip these
        continue
      
      default:
        continue
    }
    
    const match = bodyText.match(valuePattern)
    if (match) {
      // Extract the value based on type
      let value: any
      
      switch (fieldType) {
        case 'SFFloat':
          value = parseFloat(match[1])
          break
        
        case 'SFVec3f':
        case 'SFColor':
          value = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]
          break
        
        case 'SFRotation':
          value = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])]
          break
      }
      
      fieldValues.set(fieldName, value)
      console.log(`  📋 Field override: ${fieldName} = ${formatFieldValue(value)}`)
    }
  }
  
  return fieldValues
}

/**
 * Expand a PROTO instance into standard VRML text
 * 
 * Requirements:
 * - 4.5: Look up PROTO definition, merge values, resolve IS bindings
 * 
 * @param instance - The PROTO instance to expand
 * @param registry - The PROTO registry containing definitions
 * @returns Expanded VRML text, or empty string if expansion fails
 */
export function expandProto(
  instance: ProtoInstance,
  registry: ProtoRegistry
): string {
  const { protoName, fieldValues } = instance
  
  // Look up the PROTO definition
  const definition = registry.lookup(protoName)
  
  // Detect undefined PROTO references (Requirement 4.4)
  if (!definition) {
    console.error(`❌ Cannot expand undefined PROTO: ${protoName}`)
    const availableProtos = registry.getNames()
    console.error(`   Available PROTOs: ${availableProtos.join(', ') || 'none'}`)
    return ''
  }
  
  console.log(`🔧 Expanding PROTO instance: ${protoName}`)
  
  // Merge instance values with defaults
  // Start with default values from the definition
  const mergedValues = new Map<string, any>()
  
  for (const field of definition.fields) {
    // Use instance value if provided, otherwise use default (Requirement 4.3)
    if (fieldValues.has(field.name)) {
      mergedValues.set(field.name, fieldValues.get(field.name))
      console.log(`  ✓ Using override: ${field.name} = ${formatFieldValue(fieldValues.get(field.name))}`)
    } else {
      mergedValues.set(field.name, field.defaultValue)
      console.log(`  ⚙️ Using default: ${field.name} = ${formatFieldValue(field.defaultValue)}`)
    }
  }
  
  // Resolve IS bindings with merged values
  const expandedBody = resolveISBindings(definition.body, mergedValues, protoName)
  
  console.log(`✅ Successfully expanded PROTO: ${protoName}`)
  
  return expandedBody
}

/**
 * Check if text contains any PROTO instances
 * 
 * Requirements:
 * - 5.5: Detect nested PROTO instances in expanded bodies
 * 
 * @param vrmlText - The VRML text to check
 * @param registry - The PROTO registry to validate instance names
 * @returns True if PROTO instances are found, false otherwise
 */
function hasProtoInstances(vrmlText: string, registry: ProtoRegistry): boolean {
  // Pattern to find potential PROTO instances: ProtoName { ... }
  const instancePattern = /(\w+)\s*\{/g
  let match: RegExpExecArray | null
  
  while ((match = instancePattern.exec(vrmlText)) !== null) {
    const protoName = match[1]
    
    // Check if this is a registered PROTO
    if (registry.has(protoName)) {
      return true
    }
  }
  
  return false
}

/**
 * Expand all PROTO instances in VRML text with support for nested PROTOs
 * 
 * Requirements:
 * - 4.1: Find all PROTO instances
 * - 4.2: Extract field value overrides
 * - 4.5: Expand each instance
 * - 5.5: Recursively expand nested PROTO instances
 * 
 * @param vrmlText - The VRML text containing PROTO instances
 * @param registry - The PROTO registry containing definitions
 * @param maxDepth - Maximum recursion depth to prevent infinite loops (default: 10)
 * @param currentDepth - Current recursion depth (internal use)
 * @returns VRML text with all PROTO instances expanded
 */
export function expandAllProtos(
  vrmlText: string,
  registry: ProtoRegistry,
  maxDepth: number = 10,
  currentDepth: number = 0
): string {
  // Track expansion depth to prevent infinite loops (Requirement 5.5)
  if (currentDepth >= maxDepth) {
    console.error(`❌ Maximum PROTO expansion depth (${maxDepth}) reached - possible circular reference`)
    console.error(`   Stopping expansion to prevent infinite loop`)
    return vrmlText
  }
  
  let expandedText = vrmlText
  
  // Parse all PROTO instances
  const instances = parseProtoInstances(vrmlText, registry)
  
  if (instances.length === 0) {
    if (currentDepth === 0) {
      console.log('ℹ️ No PROTO instances found to expand')
    }
    return expandedText
  }
  
  if (currentDepth === 0) {
    console.log(`🔄 Expanding ${instances.length} PROTO instance(s) at depth ${currentDepth}`)
  } else {
    console.log(`  🔄 Expanding ${instances.length} nested PROTO instance(s) at depth ${currentDepth}`)
  }
  
  // Sort instances by position (reverse order) so we can replace from end to start
  // This preserves the indices of earlier instances
  instances.sort((a, b) => b.startIndex - a.startIndex)
  
  // Expand each instance and replace it in the text
  for (const instance of instances) {
    try {
      const expanded = expandProto(instance, registry)
      
      if (expanded) {
        // Replace the PROTO instance with the expanded text
        expandedText = 
          expandedText.substring(0, instance.startIndex) +
          expanded +
          expandedText.substring(instance.endIndex)
        
        console.log(`  ✓ Replaced ${instance.protoName} instance at position ${instance.startIndex}`)
      } else {
        // Skip invalid instance gracefully (Requirement 4.4)
        console.warn(`  ⚠️ Failed to expand ${instance.protoName} instance at position ${instance.startIndex}, skipping`)
      }
    } catch (error) {
      // Handle any unexpected errors during expansion (Requirement 4.4)
      console.error(`  ❌ Error expanding ${instance.protoName} instance:`, error)
      console.log(`  ℹ️ Skipping invalid instance and continuing`)
    }
  }
  
  // Check if the expanded text contains more PROTO instances (nested PROTOs)
  // Requirement 5.5: Recursively expand nested PROTO instances
  if (hasProtoInstances(expandedText, registry)) {
    console.log(`  🔁 Detected nested PROTO instances, recursing to depth ${currentDepth + 1}`)
    // Recursively expand nested PROTOs
    expandedText = expandAllProtos(expandedText, registry, maxDepth, currentDepth + 1)
  }
  
  if (currentDepth === 0) {
    console.log('✅ All PROTO instances expanded (including nested)')
  }
  
  return expandedText
}
