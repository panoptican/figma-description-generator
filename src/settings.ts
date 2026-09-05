import { Settings } from './types'

export function createDefaultSettings(): Settings {
  return {
    provider: 'chatgpt',
    apiKey: '',
    customPrompt: '',
    customVariantPrompt: '',
    customIconPrompt: '',
    includeImage: false,
    showVariants: true,
    overwriteExisting: false,
    models: {},
    iconOverrides: {}
  }
}
