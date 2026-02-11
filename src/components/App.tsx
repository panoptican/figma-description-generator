import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import {
  ApplyDescriptionHandler,
  ComponentData,
  ComponentsLoadedHandler,
  DescriptionAppliedHandler,
  ExportImageHandler,
  ImageExportedHandler,
  LoadComponentsHandler,
  LoadSettingsHandler,
  SaveSettingsHandler,
  Scope,
  Settings,
  SettingsLoadedHandler,
  SettingsSavedHandler,
  SelectComponentHandler
} from '../types'
import { generateDescription, DEFAULT_PROMPT, DEFAULT_VARIANT_PROMPT, DEFAULT_ICON_PROMPT } from '../services/ai'
import { exportDescriptions, ExportFormat } from '../utils/export'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Header } from './Header'
import { SettingsModal } from './SettingsModal'
import { ExportModal } from './ExportModal'
import { ComponentList } from './ComponentList'

interface AppProps {
  scope: Scope
  currentPageName: string
}

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

export function App({ scope, currentPageName }: AppProps) {
  const [components, setComponents] = useState<ComponentData[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [searchValue, setSearchValue] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({})
  const [iconOverrides, setIconOverrides] = useState<Record<string, boolean>>({})
  const abortGenerateAllRef = useRef(false)
  // BUG-001 fix: Map of resolvers keyed by component ID instead of single ref
  const imageExportResolvers = useRef<Map<string, (value: string | null) => void>>(new Map())
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const CONCURRENCY_LIMIT = 3

  // Helper to export component image and wait for result
  const exportComponentImage = useCallback((componentId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      imageExportResolvers.current.set(componentId, resolve)
      emit<ExportImageHandler>('EXPORT_IMAGE', { id: componentId })
    })
  }, [])

  // Load initial data
  useEffect(() => {
    const unsubscribeComponents = on<ComponentsLoadedHandler>(
      'COMPONENTS_LOADED',
      (loadedComponents) => {
        setComponents(loadedComponents)
        setIsLoading(false)
      }
    )

    const unsubscribeSettings = on<SettingsLoadedHandler>(
      'SETTINGS_LOADED',
      (loadedSettings) => {
        const merged = { ...DEFAULT_SETTINGS, ...loadedSettings }
        setSettings(merged)
        // BUG-003 fix: load persisted icon overrides
        if (merged.iconOverrides) {
          setIconOverrides(merged.iconOverrides)
        }
      }
    )

    const unsubscribeSettingsSaved = on<SettingsSavedHandler>(
      'SETTINGS_SAVED',
      () => {
        // Settings saved successfully
      }
    )

    const unsubscribeDescriptionApplied = on<DescriptionAppliedHandler>(
      'DESCRIPTION_APPLIED',
      ({ id, success }) => {
        if (!success) {
          console.error(`Failed to apply description for component ${id}`)
          setRowErrors((prev) => ({ ...prev, [id]: 'Failed to apply description to canvas' }))
        } else {
          setRowErrors((prev) => ({ ...prev, [id]: undefined }))
        }
      }
    )

    // BUG-001 fix: resolve by component ID from the Map
    const unsubscribeImageExported = on<ImageExportedHandler>(
      'IMAGE_EXPORTED',
      ({ id, imageBase64 }) => {
        const resolve = imageExportResolvers.current.get(id)
        if (resolve) {
          resolve(imageBase64)
          imageExportResolvers.current.delete(id)
        }
      }
    )

    emit<LoadSettingsHandler>('LOAD_SETTINGS')
    emit<LoadComponentsHandler>('LOAD_COMPONENTS')

    return () => {
      unsubscribeComponents()
      unsubscribeSettings()
      unsubscribeSettingsSaved()
      unsubscribeDescriptionApplied()
      unsubscribeImageExported()
    }
  }, [])

  // Filter components by search and variant toggle
  const filteredComponents = components.filter((component) => {
    if (!settings.showVariants && component.type === 'VARIANT') {
      return false
    }

    if (!searchValue) return true
    const searchLower = searchValue.toLowerCase()
    return (
      component.name.toLowerCase().includes(searchLower) ||
      component.pageName.toLowerCase().includes(searchLower) ||
      component.properties.some((p) => p.toLowerCase().includes(searchLower))
    )
  })

  const totalDisplayed = filteredComponents.length
  const missingCount = filteredComponents.filter((c) => !c.currentDescription).length
  const generateCount = filteredComponents.filter(
    (c) => settings.overwriteExisting || !c.currentDescription
  ).length
  const exportCount = filteredComponents.filter(
    (c) => c.currentDescription && c.currentDescription.trim().length > 0
  ).length

  const handleGenerate = useCallback(
    async (component: ComponentData): Promise<string> => {
      const isIcon = iconOverrides[component.id] ?? component.isIcon ?? false
      let imageBase64: string | undefined

      if (settings.includeImage || isIcon) {
        const image = await exportComponentImage(component.id)
        if (image) {
          imageBase64 = image
        }
      }

      const description = await generateDescription(
        settings.provider,
        settings.apiKey,
        component.name,
        component.type,
        component.properties,
        component.parentName,
        settings.customPrompt || undefined,
        settings.customVariantPrompt || undefined,
        imageBase64,
        { isIcon, customIconPrompt: settings.customIconPrompt || undefined }
      )

      return description
    },
    [settings, exportComponentImage, iconOverrides]
  )

  // Toggle icon status for a component
  const handleToggleIcon = useCallback((componentId: string) => {
    setIconOverrides((prev) => {
      const current = prev[componentId]
      const component = components.find((c) => c.id === componentId)
      const autoDetected = component?.isIcon ?? false
      let newOverrides: Record<string, boolean>
      // Cycle: if no override, set opposite of auto; if overridden, clear override
      if (current === undefined) {
        newOverrides = { ...prev, [componentId]: !autoDetected }
      } else {
        const { [componentId]: _, ...rest } = prev
        newOverrides = rest
      }

      // BUG-003 fix: persist icon overrides to settings
      const newSettings = { ...settings, iconOverrides: newOverrides }
      emit<SaveSettingsHandler>('SAVE_SETTINGS', newSettings)

      return newOverrides
    })
  }, [components, settings])

  // Wrapper for ComponentRow that expects just description string
  const handleGenerateForRow = useCallback(
    async (component: ComponentData): Promise<string> => {
      return handleGenerate(component)
    },
    [handleGenerate]
  )

  const handleConfirm = useCallback((id: string, description: string) => {
    emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', { id, description })

    // Update local state
    setComponents((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              previousDescription: c.currentDescription,
              currentDescription: description
            }
          : c
      )
    )
    setRowErrors((prev) => ({ ...prev, [id]: undefined }))
  }, [])

  const handleReject = useCallback((id: string) => {
    // Reset is handled in ComponentRow
  }, [])

  const handleRevert = useCallback((id: string) => {
    const target = components.find((c) => c.id === id)
    if (!target || target.previousDescription === undefined) {
      return
    }

    setComponents((prev) =>
      prev.map((c) =>
        c.id === id && c.previousDescription !== undefined
          ? {
              ...c,
              currentDescription: c.previousDescription,
              previousDescription: c.currentDescription
            }
          : c
      )
    )
    setRowErrors((prev) => ({ ...prev, [id]: undefined }))
    emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', {
      id,
      description: target.previousDescription
    })
  }, [components])

  const handleSaveSettings = useCallback((newSettings: Settings) => {
    // Preserve current iconOverrides in saved settings
    const toSave = { ...newSettings, iconOverrides: iconOverrides }
    setSettings(toSave)
    emit<SaveSettingsHandler>('SAVE_SETTINGS', toSave)
  }, [iconOverrides])

  const handleExport = useCallback((format: ExportFormat) => {
    const { dataURL, filename } = exportDescriptions(filteredComponents, format)

    // Create a temporary link element to trigger download
    const link = document.createElement('a')
    link.href = dataURL
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [filteredComponents])

  const handleGenerateAll = useCallback(async () => {
    if (!settings.apiKey) return

    setIsGeneratingAll(true)
    abortGenerateAllRef.current = false

    const componentsToGenerate = filteredComponents.filter(
      (c) => settings.overwriteExisting || !c.currentDescription
    )

    if (componentsToGenerate.length === 0) {
      setIsGeneratingAll(false)
      setGenerateProgress({ current: 0, total: 0 })
      return
    }

    setGenerateProgress({ current: 0, total: componentsToGenerate.length })

    let completed = 0

    // BUG-002 fix: queue-based approach instead of shared index
    const queue = [...componentsToGenerate]

    const processComponent = async (component: ComponentData) => {
      if (abortGenerateAllRef.current) return

      try {
        const description = await handleGenerate(component)

        if (abortGenerateAllRef.current) return

        emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', {
          id: component.id,
          description
        })

        setComponents((prev) =>
          prev.map((c) =>
            c.id === component.id
              ? {
                  ...c,
                  previousDescription: c.currentDescription,
                  currentDescription: description
                }
              : c
          )
        )

        setRowErrors((prev) => ({ ...prev, [component.id]: undefined }))
      } catch (error) {
        console.error(`Failed to generate for ${component.name}:`, error)
        setRowErrors((prev) => ({
          ...prev,
          [component.id]: error instanceof Error ? error.message : 'Generation failed'
        }))
      } finally {
        completed += 1
        setGenerateProgress({ current: completed, total: componentsToGenerate.length })
      }
    }

    const runWorker = async () => {
      while (!abortGenerateAllRef.current) {
        const component = queue.shift()
        if (!component) break
        await processComponent(component)
      }
    }

    const workerCount = Math.min(CONCURRENCY_LIMIT, componentsToGenerate.length || 1)
    await Promise.all(Array.from({ length: workerCount }, runWorker))

    setIsGeneratingAll(false)
    setGenerateProgress({ current: 0, total: 0 })
    abortGenerateAllRef.current = false
  }, [filteredComponents, settings, handleGenerate])

  const handleCancelGenerateAll = useCallback(() => {
    abortGenerateAllRef.current = true
  }, [])

  // Close any open modal
  const handleCloseModal = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
    } else if (isExportOpen) {
      setIsExportOpen(false)
    }
  }, [isSettingsOpen, isExportOpen])

  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      onGenerateAll: () => {
        if (settings.apiKey && !isGeneratingAll) {
          handleGenerateAll()
        }
      },
      onCloseModal: handleCloseModal,
      onFocusSearch: () => {
        searchInputRef.current?.focus()
      }
    },
    searchInputRef,
    !isLoading
  )

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '40px'
        }}
      >
        Loading components...
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      <Header
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onGenerateAllClick={handleGenerateAll}
        onCancelClick={handleCancelGenerateAll}
        onExportClick={() => setIsExportOpen(true)}
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
        progress={generateProgress}
        generateCount={generateCount}
        exportCount={exportCount}
        searchInputRef={searchInputRef}
      />

      <ComponentList
        components={filteredComponents}
        onGenerate={handleGenerateForRow}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onRevert={handleRevert}
        onSelect={(id) => emit<SelectComponentHandler>('SELECT_COMPONENT', { id })}
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
        rowErrors={rowErrors}
        iconOverrides={iconOverrides}
        onToggleIcon={handleToggleIcon}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        defaultPrompt={DEFAULT_PROMPT}
        defaultVariantPrompt={DEFAULT_VARIANT_PROMPT}
        defaultIconPrompt={DEFAULT_ICON_PROMPT}
      />

      <ExportModal
        isOpen={isExportOpen}
        exportCount={exportCount}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExport}
      />
    </div>
  )
}
