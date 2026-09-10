import { EventHandler } from '@create-figma-plugin/utilities'

export type Scope = 'current-page' | 'all-pages'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'NOT_SUPPORTED'

export interface VariantContext {
  name: string
  properties: string[]
}

export interface ComponentData {
  id: string
  name: string
  type: 'COMPONENT' | 'COMPONENT_SET' | 'VARIANT'
  properties: string[]
  currentDescription: string
  previousDescription?: string
  pageId: string
  pageName: string
  parentName?: string
  parentId?: string
  variantContext?: VariantContext[]
  isIcon?: boolean
}

export interface Settings {
  customPrompt: string
  customVariantPrompt: string
  customIconPrompt: string
  includeImage: boolean
  showVariants: boolean
  overwriteExisting: boolean
  iconOverrides?: Record<string, boolean>
}

export interface LoadComponentsHandler extends EventHandler {
  name: 'LOAD_COMPONENTS'
  handler: () => void
}

export interface ComponentsLoadedHandler extends EventHandler {
  name: 'COMPONENTS_LOADED'
  handler: (components: ComponentData[], currentPageName: string) => void
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
  handler: (data: { id: string; requestId: number }) => void
}

export interface ImageExportedHandler extends EventHandler {
  name: 'IMAGE_EXPORTED'
  handler: (data: { id: string; requestId: number; imageBase64: string | null }) => void
}

export interface GetPaymentTokenHandler extends EventHandler {
  name: 'GET_PAYMENT_TOKEN'
  handler: (requestId: number) => void
}

export interface PaymentTokenHandler extends EventHandler {
  name: 'PAYMENT_TOKEN'
  handler: (data: { requestId: number; token: string | null; status: PaymentStatus }) => void
}

export interface StartCheckoutHandler extends EventHandler {
  name: 'START_CHECKOUT'
  handler: () => void
}

export interface CheckoutFinishedHandler extends EventHandler {
  name: 'CHECKOUT_FINISHED'
  handler: (data: { status: PaymentStatus }) => void
}
