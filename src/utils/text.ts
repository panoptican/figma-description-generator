/**
 * Normalizes description text by trimming whitespace and ensuring consistent formatting.
 */
export function normalizeDescription(text: string): string {
  return text.trim()
}

/**
 * Checks if a description is considered "empty" or missing.
 */
export function isDescriptionEmpty(description: string | undefined | null): boolean {
  if (description === undefined || description === null) {
    return true
  }
  return description.trim().length === 0
}

/**
 * Validates that a description meets basic quality criteria.
 * Returns an error message if invalid, or null if valid.
 */
export function validateDescription(description: string): string | null {
  const trimmed = description.trim()

  if (trimmed.length === 0) {
    return 'Description cannot be empty'
  }

  if (trimmed.length > 500) {
    return 'Description is too long (max 500 characters)'
  }

  return null
}

/**
 * Formats component properties for display or prompt inclusion.
 */
export function formatProperties(properties: string[]): string {
  if (properties.length === 0) {
    return 'None'
  }
  return properties.join(', ')
}

/**
 * Parses property string from component name (e.g., "size=large, variant=primary").
 * Extracts key=value pairs from variant names.
 */
export function parseVariantName(variantName: string): Record<string, string> {
  const result: Record<string, string> = {}

  // Split by comma and process each part
  const parts = variantName.split(',').map((p) => p.trim())

  for (const part of parts) {
    const eqIndex = part.indexOf('=')
    if (eqIndex > 0) {
      const key = part.substring(0, eqIndex).trim()
      const value = part.substring(eqIndex + 1).trim()
      result[key] = value
    }
  }

  return result
}
