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
import {
  generateDescription,
  DEFAULT_PROMPT,
  DEFAULT_VARIANT_PROMPT,
  DEFAULT_ICON_PROMPT,
  getProviderDisplayName
} from '../services/ai'
import { getComponentSetMembers, getGenerationBatches } from '../utils/generationBatches'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { Header } from './Header'
import { SettingsModal } from './SettingsModal'
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export function App({ scope, currentPageName }: AppProps) {
  const [components, setComponents] = useState<ComponentData[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [searchValue, setSearchValue] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generatedThisSession, setGeneratedThisSession] = useState<Set<string>>(new Set())
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({})
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [iconOverrides, setIconOverrides] = useState<Record<string, boolean>>({})
  const abortGenerateAllRef = useRef(false)
  const generateAllAbortControllerRef = useRef<AbortController | null>(null)
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
        setSelectedRowId(null)
        setRowErrors({})
        setIsRefreshing(false)
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

  const handleRefreshComponents = useCallback(() => {
    if (isRefreshing || isGeneratingAll) {
      return
    }

    setIsRefreshing(true)
    setSelectedRowId(null)
    setRowErrors({})
    emit<LoadComponentsHandler>('LOAD_COMPONENTS')
  }, [isRefreshing, isGeneratingAll])

  const markGeneratedThisSession = useCallback((id: string) => {
    setGeneratedThisSession((previous) => {
      if (previous.has(id)) {
        return previous
      }

      const next = new Set(previous)
      next.add(id)
      return next
    })
  }, [])

  const clearGeneratedThisSession = useCallback((id: string) => {
    setGeneratedThisSession((previous) => {
      if (!previous.has(id)) {
        return previous
      }

      const next = new Set(previous)
      next.delete(id)
      return next
    })
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

  const generationBatches = getGenerationBatches(components, filteredComponents, settings.overwriteExisting)
  const generateCount = generationBatches.reduce((count, batch) => count + batch.members.length, 0)
  const selectedComponent = useMemo(
    () => filteredComponents.find((component) => component.id === selectedRowId) ?? null,
    [filteredComponents, selectedRowId]
  )
  const providerLabel = useMemo(() => getProviderDisplayName(settings.provider), [settings.provider])

  useEffect(() => {
    if (selectedRowId === null) {
      return
    }
    if (!filteredComponents.some((component) => component.id === selectedRowId)) {
      setSelectedRowId(null)
    }
  }, [filteredComponents, selectedRowId])

  const handleGenerate = useCallback(
    async (component: ComponentData, abortSignal?: AbortSignal): Promise<string> => {
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
        { isIcon, customIconPrompt: settings.customIconPrompt || undefined },
        component.variantContext,
        abortSignal
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

  const handleGenerateComponentSet = useCallback(async (componentSet: ComponentData): Promise<void> => {
    const members = getComponentSetMembers(components, componentSet)
    const failures: string[] = []

    for (const member of members) {
      try {
        const description = await handleGenerate(member)
        markGeneratedThisSession(member.id)
        handleConfirm(member.id, description)
      } catch (error) {
        console.error(`Failed to generate for ${member.name}:`, error)
        failures.push(member.name)
        setRowErrors((prev) => ({
          ...prev,
          [member.id]: error instanceof Error ? error.message : 'Generation failed'
        }))
      }
    }

    if (failures.length > 0) {
      throw new Error(`Failed to generate: ${failures.join(', ')}`)
    }
  }, [components, handleGenerate, markGeneratedThisSession, handleConfirm])

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
    clearGeneratedThisSession(id)
    setRowErrors((prev) => ({ ...prev, [id]: undefined }))
    emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', {
      id,
      description: target.previousDescription
    })
  }, [components, clearGeneratedThisSession])

  const handleSaveSettings = useCallback((newSettings: Settings) => {
    // Preserve current iconOverrides in saved settings
    const toSave = { ...newSettings, iconOverrides: iconOverrides }
    setSettings(toSave)
    emit<SaveSettingsHandler>('SAVE_SETTINGS', toSave)
  }, [iconOverrides])

  const handleGenerateAll = useCallback(async () => {
    if (!settings.apiKey) return

    setIsGeneratingAll(true)
    abortGenerateAllRef.current = false
    const abortController = new AbortController()
    generateAllAbortControllerRef.current = abortController

    const batchesToGenerate = generationBatches
    const totalToGenerate = batchesToGenerate.reduce((count, batch) => count + batch.members.length, 0)

    if (totalToGenerate === 0) {
      setIsGeneratingAll(false)
      setGenerateProgress({ current: 0, total: 0 })
      generateAllAbortControllerRef.current = null
      return
    }

    setGenerateProgress({ current: 0, total: totalToGenerate })

    let completed = 0

    // BUG-002 fix: queue-based approach instead of shared index. Component sets
    // remain atomic jobs while their members are generated sequentially.
    const queue = [...batchesToGenerate]

    const processBatch = async (batch: typeof batchesToGenerate[number]) => {
      for (const component of batch.members) {
        if (abortGenerateAllRef.current) return

        try {
          const description = await handleGenerate(component, abortController.signal)

          // Cancel drops results even if the provider already returned.
          if (abortGenerateAllRef.current) return

          markGeneratedThisSession(component.id)
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
          if (abortGenerateAllRef.current || isAbortError(error)) {
            return
          }
          console.error(`Failed to generate for ${component.name}:`, error)
          setRowErrors((prev) => ({
            ...prev,
            [component.id]: error instanceof Error ? error.message : 'Generation failed'
          }))
        } finally {
          completed += 1
          setGenerateProgress({ current: completed, total: totalToGenerate })
        }
      }
    }

    const runWorker = async () => {
      while (!abortGenerateAllRef.current) {
        const batch = queue.shift()
        if (!batch) break
        await processBatch(batch)
      }
    }

    const workerCount = Math.min(CONCURRENCY_LIMIT, batchesToGenerate.length || 1)
    await Promise.all(Array.from({ length: workerCount }, runWorker))

    setIsGeneratingAll(false)
    setGenerateProgress({ current: 0, total: 0 })
    abortGenerateAllRef.current = false
    generateAllAbortControllerRef.current = null
  }, [generationBatches, settings, handleGenerate, markGeneratedThisSession])

  const handleCancelGenerateAll = useCallback(() => {
    abortGenerateAllRef.current = true
    generateAllAbortControllerRef.current?.abort()
  }, [])

  const handleGenerateSelected = useCallback(async () => {
    if (!selectedComponent || !settings.apiKey || isGeneratingAll) {
      return
    }

    try {
      if (selectedComponent.type === 'VARIANT') {
        const parent = components.find((component) => component.id === selectedComponent.parentId)
        if (parent) {
          await handleGenerateComponentSet(parent)
        }
        return
      }

      const description = await handleGenerate(selectedComponent)
      markGeneratedThisSession(selectedComponent.id)
      handleConfirm(selectedComponent.id, description)
    } catch (error) {
      console.error(`Failed to generate for ${selectedComponent.name}:`, error)
      setRowErrors((prev) => ({
        ...prev,
        [selectedComponent.id]: error instanceof Error ? error.message : 'Generation failed'
      }))
    }
  }, [selectedComponent, components, settings.apiKey, isGeneratingAll, handleGenerate, handleGenerateComponentSet, markGeneratedThisSession, handleConfirm])

  const handleRevertSelected = useCallback(() => {
    if (!selectedComponent) {
      return
    }
    handleRevert(selectedComponent.id)
  }, [selectedComponent, handleRevert])

  // Close Settings with Escape
  const handleCloseModal = useCallback(() => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
    }
  }, [isSettingsOpen])

  // Keyboard shortcuts
  useKeyboardShortcuts(
    {
      onGenerateAll: () => {
        if (settings.apiKey && !isGeneratingAll) {
          handleGenerateAll()
        }
      },
      onGenerateSingle: () => {
        void handleGenerateSelected()
      },
      onRevert: handleRevertSelected,
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
        onRefreshClick={handleRefreshComponents}
        refreshTitle={scope === 'current-page' ? 'Rescan this page' : 'Rescan entire file'}
        scopeLabel={scope === 'current-page' ? `This page · ${currentPageName}` : 'Entire file'}
        overwriteExisting={settings.overwriteExisting}
        isGenerating={isGeneratingAll}
        isRefreshing={isRefreshing}
        hasApiKey={!!settings.apiKey}
        progress={generateProgress}
        generateCount={generateCount}
        searchInputRef={searchInputRef}
      />

      <ComponentList
        components={filteredComponents}
        searchValue={searchValue}
        scope={scope}
        onGenerate={handleGenerateForRow}
        onGenerateComponentSet={handleGenerateComponentSet}
        onGenerated={markGeneratedThisSession}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onRevert={handleRevert}
        selectedRowId={selectedRowId}
        onRowSelect={setSelectedRowId}
        onSelect={(id) => {
          setSelectedRowId(id)
          emit<SelectComponentHandler>('SELECT_COMPONENT', { id })
        }}
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
        providerLabel={providerLabel}
        rowErrors={rowErrors}
        iconOverrides={iconOverrides}
        onToggleIcon={handleToggleIcon}
        generatedThisSession={generatedThisSession}
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
    </div>
  )
}
