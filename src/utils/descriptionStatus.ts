import { isDescriptionEmpty } from './text'

export type DescriptionStatus = 'missing' | 'existing' | 'generated'

export function getDescriptionStatus(
  description: string | undefined,
  wasGeneratedThisSession: boolean
): DescriptionStatus {
  if (isDescriptionEmpty(description)) {
    return 'missing'
  }

  return wasGeneratedThisSession ? 'generated' : 'existing'
}
