export type DescriptionStatus = 'missing' | 'existing' | 'generated'

export function getDescriptionStatus(
  description: string | undefined,
  wasGeneratedThisSession: boolean
): DescriptionStatus {
  if (!description || description.trim().length === 0) {
    return 'missing'
  }

  return wasGeneratedThisSession ? 'generated' : 'existing'
}
