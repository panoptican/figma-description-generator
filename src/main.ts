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

const DEFAULT_SETTINGS: Settings = {
  provider: 'chatgpt',
  apiKey: '',
  customPrompt: '',
  customVariantPrompt: '',
  customIconPrompt: '',
  includeImage: false,
  showVariants: true,
  overwriteExisting: false
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
    width: 960,
    height: 800
  }, { scope, currentPageName })

  // Clean up old cache data from previous versions
  figma.clientStorage.deleteAsync('description-cache').catch(() => {})

  const loadComponents = () => {
    const components = getComponents(scope)
    emit<ComponentsLoadedHandler>('COMPONENTS_LOADED', components)
  }

  on<LoadComponentsHandler>('LOAD_COMPONENTS', loadComponents)

  // Current-page mode follows the page the user is working on. All-pages mode
  // intentionally stays document-wide and only refreshes on explicit request.
  const handleCurrentPageChange = () => {
    if (scope === 'current-page') {
      loadComponents()
    }
  }

  if (scope === 'current-page') {
    figma.on('currentpagechange', handleCurrentPageChange)
  }

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
    // Migration: strip removed fields from old settings
    const { enableFallback, providerChain, ...cleanSettings } = settings as Settings & { enableFallback?: boolean; providerChain?: unknown }
    emit<SettingsLoadedHandler>('SETTINGS_LOADED', cleanSettings)
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

  on<ClosePluginHandler>('CLOSE_PLUGIN', () => {
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
