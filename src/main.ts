import { createDefaultSettings } from './settings'
import {
  emit,
  loadSettingsAsync,
  on,
  saveSettingsAsync,
  showUI
} from '@create-figma-plugin/utilities'

import {
  ApplyDescriptionHandler,
  ClosePluginHandler,
  ComponentData,
  ComponentsLoadedHandler,
  DescriptionAppliedHandler,
  ExportImageHandler,
  ImageExportedHandler,
  GetPaymentTokenHandler,
  PaymentTokenHandler,
  StartCheckoutHandler,
  CheckoutFinishedHandler,
  LoadComponentsHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  SelectComponentHandler,
  Settings,
  SettingsLoadedHandler,
  SettingsSavedHandler,
  VariantContext
} from './types'
import { isIconComponent } from './utils/icon'

const DEFAULT_SETTINGS = createDefaultSettings()

type Scope = 'current-page' | 'all-pages'

async function getComponents(scope: Scope): Promise<ComponentData[]> {
  const components: ComponentData[] = []
  const pages = scope === 'current-page' ? [figma.currentPage] : figma.root.children

  for (const page of pages) {
    await page.loadAsync()
    const nodes = page.findAllWithCriteria({
      types: ['COMPONENT', 'COMPONENT_SET']
    })

    for (const node of nodes) {
      if (node.type === 'COMPONENT_SET') {
        const variants = node.children.filter((child) => child.type === 'COMPONENT')
        const variantContext: VariantContext[] = variants.map((variant) => ({
          name: variant.name,
          properties: parseVariantName(variant.name)
        }))

        components.push({
          id: node.id,
          name: node.name,
          type: 'COMPONENT_SET',
          properties: extractComponentSetProperties(node),
          currentDescription: node.description,
          pageId: page.id,
          pageName: page.name,
          variantContext,
          isIcon: isIconComponent(node.name, page.name)
        })

        for (const variant of variants) {
          components.push({
            id: variant.id,
            name: variant.name,
            type: 'VARIANT',
            properties: parseVariantName(variant.name),
            currentDescription: variant.description,
            pageId: page.id,
            pageName: page.name,
            parentName: node.name,
            parentId: node.id,
            variantContext,
            isIcon: isIconComponent(node.name, page.name)
          })
        }
      } else if (node.type === 'COMPONENT') {
        const parent = node.parent
        if (parent && parent.type === 'COMPONENT_SET') {
          continue
        }

        components.push({
          id: node.id,
          name: node.name,
          type: 'COMPONENT',
          properties: [],
          currentDescription: node.description,
          pageId: page.id,
          pageName: page.name,
          isIcon: isIconComponent(node.name, page.name)
        })
      }
    }
  }

  return components
}

function extractComponentSetProperties(componentSet: ComponentSetNode): string[] {
  const properties: string[] = []

  try {
    const propDefs = componentSet.componentPropertyDefinitions
    for (const [key, def] of Object.entries(propDefs)) {
      if (def.type === 'VARIANT') {
        const values = def.variantOptions?.join(', ') || ''
        properties.push(`${key}: ${values}`)
      }
    }
  } catch {
    // Fallback: extract from variant names
    const variantProps = new Set<string>()
    for (const child of componentSet.children) {
      if (child.type === 'COMPONENT') {
        const parsed = parseVariantName(child.name)
        parsed.forEach(p => variantProps.add(p.split('=')[0]))
      }
    }
    properties.push(...Array.from(variantProps))
  }

  return properties
}

function parseVariantName(name: string): string[] {
  return name.split(',').map(part => part.trim()).filter(Boolean)
}

function initPlugin(scope: Scope) {
  const currentPageName = figma.currentPage.name

  showUI({
    width: 675,
    height: 800
  }, { scope, currentPageName })

  // Clean up old cache data from previous versions
  figma.clientStorage.deleteAsync('description-cache').catch(() => {})

  let scanVersion = 0
  const loadComponents = async () => {
    const version = ++scanVersion
    const scannedPage = figma.currentPage
    try {
      const components = await getComponents(scope)
      // Page switches and rescans can overtake an earlier asynchronous scan.
      if (version === scanVersion) {
        emit<ComponentsLoadedHandler>('COMPONENTS_LOADED', components, scannedPage.name)
      }
    } catch (error) {
      if (version !== scanVersion) return
      console.error('Failed to load components:', error)
      figma.notify('Could not load components. Please try Rescan.', { error: true })
      emit<ComponentsLoadedHandler>('COMPONENTS_LOADED', [], scannedPage.name)
    }
  }

  on<LoadComponentsHandler>('LOAD_COMPONENTS', loadComponents)

  // Current-page mode follows the page the user is working on. All-pages mode
  // intentionally stays document-wide and only refreshes on explicit request.
  const handleCurrentPageChange = () => {
    if (scope === 'current-page') {
      return loadComponents()
    }
  }

  if (scope === 'current-page') {
    figma.on('currentpagechange', handleCurrentPageChange)
  }

  const pendingDescriptions = new Map<string, object>()
  on<ApplyDescriptionHandler>('APPLY_DESCRIPTION', async ({ id, description }) => {
    const request = {}
    pendingDescriptions.set(id, request)
    let success = false
    try {
      const node = await figma.getNodeByIdAsync(id)
      // A newer edit or revert must win if node lookups finish out of order.
      if (pendingDescriptions.get(id) !== request) return
      if (node && (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
        node.description = description
        success = true
      }
    } catch (error) {
      if (pendingDescriptions.get(id) !== request) return
      console.error('Failed to apply description:', error)
    }
    pendingDescriptions.delete(id)
    emit<DescriptionAppliedHandler>('DESCRIPTION_APPLIED', { id, success })
  })

  on<LoadSettingsHandler>('LOAD_SETTINGS', async () => {
    const stored = await loadSettingsAsync(DEFAULT_SETTINGS) as Settings & Record<string, unknown>
    // Migration: earlier releases stored a provider API key and model choices. Drop those fields and
    // rewrite storage so a key from the bring-your-own-key era does not linger on disk.
    const { provider, apiKey, models, enableFallback, providerChain, ...cleanSettings } = stored
    const hadRemovedFields = [provider, apiKey, models, enableFallback, providerChain].some(value => value !== undefined)
    if (hadRemovedFields) await saveSettingsAsync(cleanSettings)
    emit<SettingsLoadedHandler>('SETTINGS_LOADED', cleanSettings as Settings)
  })

  on<SaveSettingsHandler>('SAVE_SETTINGS', async (settings: Settings) => {
    await saveSettingsAsync(settings)
    emit<SettingsSavedHandler>('SETTINGS_SAVED')
  })

  on<SelectComponentHandler>('SELECT_COMPONENT', async ({ id }) => {
    try {
      const node = await figma.getNodeByIdAsync(id)
      if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
        figma.notify('This component is no longer available.', { error: true })
        return
      }
      const page = findPageForNode(node)
      if (page) {
        await figma.setCurrentPageAsync(page)
        page.selection = [node]
        figma.viewport.scrollAndZoomIntoView([node])
      }
    } catch (error) {
      console.error('Failed to select component:', error)
      figma.notify('Could not select this component. Please try Rescan.', { error: true })
    }
  })

  on<ExportImageHandler>('EXPORT_IMAGE', async ({ id, requestId }) => {
    try {
      const node = await figma.getNodeByIdAsync(id)
      if (node && 'exportAsync' in node) {
        const bytes = await (node as SceneNode).exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        })
        // Convert Uint8Array to base64
        const base64 = figma.base64Encode(bytes)
        emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, requestId, imageBase64: base64 })
      } else {
        emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, requestId, imageBase64: null })
      }
    } catch (error) {
      console.error('Failed to export image:', error)
      emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, requestId, imageBase64: null })
    }
  })

  on<GetPaymentTokenHandler>('GET_PAYMENT_TOKEN', async (requestId) => {
    try {
      const payments = figma.payments
      const token = payments ? await payments.getPluginPaymentTokenAsync() : null
      emit<PaymentTokenHandler>('PAYMENT_TOKEN', { requestId, token, status: payments?.status?.type ?? 'NOT_SUPPORTED' })
    } catch {
      emit<PaymentTokenHandler>('PAYMENT_TOKEN', { requestId, token: null, status: figma.payments?.status?.type ?? 'NOT_SUPPORTED' })
    }
  })

  on<StartCheckoutHandler>('START_CHECKOUT', async () => {
    try {
      await figma.payments?.initiateCheckoutAsync({ interstitial: 'PAID_FEATURE' })
    } catch {
      // The UI refreshes identity after both completed and dismissed checkout.
    }
    emit<CheckoutFinishedHandler>('CHECKOUT_FINISHED', { status: figma.payments?.status?.type ?? 'NOT_SUPPORTED' })
  })

  on<ClosePluginHandler>('CLOSE_PLUGIN', () => {
    scanVersion++
    pendingDescriptions.clear()
    if (scope === 'current-page') {
      figma.off('currentpagechange', handleCurrentPageChange)
    }
    figma.closePlugin()
  })
}

// Named exports for menu commands
export function currentPage() {
  initPlugin('current-page')
}

export function allPages() {
  initPlugin('all-pages')
}

function findPageForNode(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node
  while (current) {
    if (current.type === 'PAGE') {
      return current as PageNode
    }
    current = current.parent
  }
  return null
}
