import {
  emit,
  loadSettingsAsync,
  on,
  saveSettingsAsync,
  showUI
} from '@create-figma-plugin/utilities'

import {
  ApplyDescriptionHandler,
  CacheClearedHandler,
  CacheData,
  CacheLoadedHandler,
  CacheSavedHandler,
  ClearCacheHandler,
  ClosePluginHandler,
  ComponentData,
  ComponentsLoadedHandler,
  DescriptionAppliedHandler,
  ExportImageHandler,
  ImageExportedHandler,
  LoadCacheHandler,
  LoadComponentsHandler,
  LoadSettingsHandler,
  SaveCacheHandler,
  SaveSettingsHandler,
  SelectComponentHandler,
  Settings,
  SettingsLoadedHandler,
  SettingsSavedHandler
} from './types'

const DEFAULT_SETTINGS: Settings = {
  provider: 'chatgpt',
  apiKey: '',
  customPrompt: '',
  customVariantPrompt: '',
  customIconPrompt: '',
  includeImage: false,
  showVariants: true,
  overwriteExisting: false,
  enableFallback: false,
  providerChain: undefined
}

type Scope = 'current-page' | 'all-pages'

function getComponents(scope: Scope): ComponentData[] {
  const components: ComponentData[] = []
  const pages = scope === 'current-page' ? [figma.currentPage] : figma.root.children

  for (const page of pages) {
    const nodes = page.findAllWithCriteria({
      types: ['COMPONENT', 'COMPONENT_SET']
    })

    for (const node of nodes) {
      if (node.type === 'COMPONENT_SET') {
        components.push({
          id: node.id,
          name: node.name,
          type: 'COMPONENT_SET',
          properties: extractComponentSetProperties(node),
          currentDescription: node.description,
          pageName: page.name,
          isIcon: /^icon\b/i.test(node.name)
        })

        for (const variant of node.children) {
          if (variant.type === 'COMPONENT') {
            components.push({
              id: variant.id,
              name: variant.name,
              type: 'VARIANT',
              properties: parseVariantName(variant.name),
              currentDescription: variant.description,
              pageName: page.name,
              parentName: node.name,
              isIcon: /^icon\b/i.test(node.name)
            })
          }
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
          pageName: page.name,
          isIcon: /^icon\b/i.test(node.name)
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
    width: 960,
    height: 800
  }, { scope, currentPageName })

  on<LoadComponentsHandler>('LOAD_COMPONENTS', () => {
    const components = getComponents(scope)
    emit<ComponentsLoadedHandler>('COMPONENTS_LOADED', components)
  })

  on<ApplyDescriptionHandler>('APPLY_DESCRIPTION', ({ id, description }) => {
    const node = figma.getNodeById(id)

    if (node && (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET')) {
      node.description = description
      emit<DescriptionAppliedHandler>('DESCRIPTION_APPLIED', { id, success: true })
    } else {
      emit<DescriptionAppliedHandler>('DESCRIPTION_APPLIED', { id, success: false })
    }
  })

  on<LoadSettingsHandler>('LOAD_SETTINGS', async () => {
    const settings = await loadSettingsAsync(DEFAULT_SETTINGS)
    emit<SettingsLoadedHandler>('SETTINGS_LOADED', settings)
  })

  on<SaveSettingsHandler>('SAVE_SETTINGS', async (settings: Settings) => {
    await saveSettingsAsync(settings)
    emit<SettingsSavedHandler>('SETTINGS_SAVED')
  })

  on<SelectComponentHandler>('SELECT_COMPONENT', ({ id }) => {
    const node = figma.getNodeById(id)
    if (node && 'type' in node) {
      // Navigate to the page containing this node
      const page = findPageForNode(node)
      if (page) {
        figma.currentPage = page
      }
      // Select and zoom to the node
      figma.currentPage.selection = [node as SceneNode]
      figma.viewport.scrollAndZoomIntoView([node as SceneNode])
    }
  })

  on<ExportImageHandler>('EXPORT_IMAGE', async ({ id }) => {
    try {
      const node = figma.getNodeById(id)
      if (node && 'exportAsync' in node) {
        const bytes = await (node as SceneNode).exportAsync({
          format: 'PNG',
          constraint: { type: 'SCALE', value: 1 }
        })
        // Convert Uint8Array to base64
        const base64 = figma.base64Encode(bytes)
        emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, imageBase64: base64 })
      } else {
        emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, imageBase64: null })
      }
    } catch (error) {
      console.error('Failed to export image:', error)
      emit<ImageExportedHandler>('IMAGE_EXPORTED', { id, imageBase64: null })
    }
  })

  // Cache handlers using Figma's clientStorage
  const CACHE_KEY = 'description-cache'
  const documentId = figma.root.id

  on<LoadCacheHandler>('LOAD_CACHE', async () => {
    try {
      const stored = await figma.clientStorage.getAsync(CACHE_KEY) as CacheData | undefined
      // Only use cache if it's for the same document
      if (stored && stored.documentId === documentId) {
        emit<CacheLoadedHandler>('CACHE_LOADED', stored)
      } else {
        emit<CacheLoadedHandler>('CACHE_LOADED', { entries: {}, documentId })
      }
    } catch (error) {
      console.error('Failed to load cache:', error)
      emit<CacheLoadedHandler>('CACHE_LOADED', { entries: {}, documentId })
    }
  })

  on<SaveCacheHandler>('SAVE_CACHE', async (data: CacheData) => {
    try {
      await figma.clientStorage.setAsync(CACHE_KEY, { ...data, documentId })
      emit<CacheSavedHandler>('CACHE_SAVED')
    } catch (error) {
      console.error('Failed to save cache:', error)
    }
  })

  on<ClearCacheHandler>('CLEAR_CACHE', async () => {
    try {
      await figma.clientStorage.setAsync(CACHE_KEY, { entries: {}, documentId })
      emit<CacheClearedHandler>('CACHE_CLEARED')
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  })

  on<ClosePluginHandler>('CLOSE_PLUGIN', () => {
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
