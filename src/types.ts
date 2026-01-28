import { EventHandler } from '@create-figma-plugin/utilities'

export type AIProvider = 'gemini' | 'claude' | 'chatgpt'
export type Scope = 'current-page' | 'all-pages'

export interface ComponentData {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET' | 'VARIANT'
  properties: string[]
  currentDescription: string
  previousDescription?: string
  pageName: string
  parentName?: string
}

export interface ProviderConfig {
  provider: AIProvider
  apiKey: string
  enabled: boolean
}

export interface Settings {
  provider: AIProvider
  apiKey: string
  customPrompt: string
  customVariantPrompt: string
  includeImage: boolean
  showVariants: boolean
  overwriteExisting: boolean
  // Fallback chain configuration
  providerChain?: ProviderConfig[]
  enableFallback?: boolean
}

export interface LoadComponentsHandler extends EventHandler {
  name: 'LOAD_COMPONENTS'
  handler: () => void
}

export interface ComponentsLoadedHandler extends EventHandler {
  name: 'COMPONENTS_LOADED'
  handler: (components: ComponentData[]) => void
}

export interface ApplyDescriptionHandler extends EventHandler {
  name: 'APPLY_DESCRIPTION'
  handler: (data: { id: string; description: string }) => void
}

export interface DescriptionAppliedHandler extends EventHandler {
  name: 'DESCRIPTION_APPLIED'
  handler: (data: { id: string; success: boolean }) => void
}

export interface LoadSettingsHandler extends EventHandler {
  name: 'LOAD_SETTINGS'
  handler: () => void
}

export interface SettingsLoadedHandler extends EventHandler {
  name: 'SETTINGS_LOADED'
  handler: (settings: Settings) => void
}

export interface SaveSettingsHandler extends EventHandler {
  name: 'SAVE_SETTINGS'
  handler: (settings: Settings) => void
}

export interface SettingsSavedHandler extends EventHandler {
  name: 'SETTINGS_SAVED'
  handler: () => void
}

export interface ClosePluginHandler extends EventHandler {
  name: 'CLOSE_PLUGIN'
  handler: () => void
}

export interface SelectComponentHandler extends EventHandler {
  name: 'SELECT_COMPONENT'
  handler: (data: { id: string }) => void
}

export interface ExportImageHandler extends EventHandler {
  name: 'EXPORT_IMAGE'
  handler: (data: { id: string }) => void
}

export interface ImageExportedHandler extends EventHandler {
  name: 'IMAGE_EXPORTED'
  handler: (data: { id: string; imageBase64: string | null }) => void
}

// Cache-related types and handlers
export interface CacheEntry {
  description: string
  timestamp: number
}

export interface CacheData {
  entries: Record<string, CacheEntry>
  documentId: string
}

export interface LoadCacheHandler extends EventHandler {
  name: 'LOAD_CACHE'
  handler: () => void
}

export interface CacheLoadedHandler extends EventHandler {
  name: 'CACHE_LOADED'
  handler: (data: CacheData) => void
}

export interface SaveCacheHandler extends EventHandler {
  name: 'SAVE_CACHE'
  handler: (data: CacheData) => void
}

export interface CacheSavedHandler extends EventHandler {
  name: 'CACHE_SAVED'
  handler: () => void
}

export interface ClearCacheHandler extends EventHandler {
  name: 'CLEAR_CACHE'
  handler: () => void
}

export interface CacheClearedHandler extends EventHandler {
  name: 'CACHE_CLEARED'
  handler: () => void
}
