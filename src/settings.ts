import { Settings } from './types'

export function createDefaultSettings(): Settings {
  return {
    customPrompt: '',
    customVariantPrompt: '',
    customIconPrompt: '',
    includeImage: false,
    showVariants: true,
    overwriteExisting: false,
    iconOverrides: {}
  }
}
