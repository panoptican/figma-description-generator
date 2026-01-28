import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'

import {
  ApplyDescriptionHandler,
  CacheClearedHandler,
  CacheData,
  CacheLoadedHandler,
  ClearCacheHandler,
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
  Scope,
  Settings,
  SettingsLoadedHandler,
  SettingsSavedHandler,
  SelectComponentHandler
} from '../types'
import { generateDescriptionWithFallback, RetryError, DEFAULT_PROMPT, DEFAULT_VARIANT_PROMPT, getProviderDisplayName, GenerateWithFallbackResult } from '../services/ai'
import { AIProvider } from '../types'
import {
  DescriptionCache,
  generateCacheKey,
  hashPromptConfig,
  hashString
} from '../services/cache'
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
  includeImage: false,
  showVariants: true,
  overwriteExisting: false,
  enableFallback: false,
  providerChain: undefined
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
  const [cacheHits, setCacheHits] = useState<Record<string, boolean>>({})
  const [cacheSize, setCacheSize] = useState(0)
  const [retryStatus, setRetryStatus] = useState<Record<string, { attempt: number; maxAttempts: number } | undefined>>({})
  const [usedProvider, setUsedProvider] = useState<Record<string, AIProvider | undefined>>({})
  const abortGenerateAllRef = useRef(false)
  const abortRetryRef = useRef<Record<string, boolean>>({})
  const imageExportResolveRef = useRef<((imageBase64: string | null) => void) | null>(null)
  const cacheRef = useRef(new DescriptionCache())
  const documentIdRef = useRef<string>('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const CONCURRENCY_LIMIT = 3

  // Helper to export component image and wait for result
  const exportComponentImage = useCallback((componentId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      imageExportResolveRef.current = resolve
      emit<ExportImageHandler>('EXPORT_IMAGE', { id: componentId })
    })
  }, [])

  // Save cache to storage
  const saveCache = useCallback(() => {
    const data: CacheData = {
      entries: cacheRef.current.export(),
      documentId: documentIdRef.current
    }
    emit<SaveCacheHandler>('SAVE_CACHE', data)
    setCacheSize(cacheRef.current.size)
  }, [])

  // Generate cache key for a component
  const getCacheKeyForComponent = useCallback((
    component: ComponentData,
    imageBase64?: string
  ): string => {
    const promptHash = hashPromptConfig(
      settings.customPrompt || DEFAULT_PROMPT,
      settings.customVariantPrompt || DEFAULT_VARIANT_PROMPT,
      settings.includeImage
    )
    return generateCacheKey({
      name: component.name,
      type: component.type,
      properties: component.properties,
      parentName: component.parentName,
      promptHash,
      imageHash: imageBase64 ? hashString(imageBase64) : undefined
    })
  }, [settings.customPrompt, settings.customVariantPrompt, settings.includeImage])

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
        setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings })
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

    const unsubscribeImageExported = on<ImageExportedHandler>(
      'IMAGE_EXPORTED',
      ({ imageBase64 }) => {
        if (imageExportResolveRef.current) {
          imageExportResolveRef.current(imageBase64)
          imageExportResolveRef.current = null
        }
      }
    )

    const unsubscribeCacheLoaded = on<CacheLoadedHandler>(
      'CACHE_LOADED',
      (data: CacheData) => {
        documentIdRef.current = data.documentId
        cacheRef.current.load(data.entries)
        setCacheSize(cacheRef.current.size)
      }
    )

    const unsubscribeCacheCleared = on<CacheClearedHandler>(
      'CACHE_CLEARED',
      () => {
        cacheRef.current.clear()
        setCacheSize(0)
        setCacheHits({})
      }
    )

    emit<LoadSettingsHandler>('LOAD_SETTINGS')
    emit<LoadCacheHandler>('LOAD_CACHE')
    emit<LoadComponentsHandler>('LOAD_COMPONENTS')

    return () => {
      unsubscribeComponents()
      unsubscribeSettings()
      unsubscribeSettingsSaved()
      unsubscribeDescriptionApplied()
      unsubscribeImageExported()
      unsubscribeCacheLoaded()
      unsubscribeCacheCleared()
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
    async (component: ComponentData): Promise<{ description: string; fromCache: boolean; usedProvider?: AIProvider }> => {
      let imageBase64: string | undefined

      if (settings.includeImage) {
        const image = await exportComponentImage(component.id)
        if (image) {
          imageBase64 = image
        }
      }

      // Check cache first (unless overwriteExisting is enabled)
      if (!settings.overwriteExisting) {
        const cacheKey = getCacheKeyForComponent(component, imageBase64)
        const cached = cacheRef.current.get(cacheKey)
        if (cached) {
          setCacheHits((prev) => ({ ...prev, [component.id]: true }))
          return { description: cached.description, fromCache: true }
        }
      }

      // Clear any previous retry abort signal
      abortRetryRef.current[component.id] = false
      setRetryStatus((prev) => ({ ...prev, [component.id]: undefined }))
      setUsedProvider((prev) => ({ ...prev, [component.id]: undefined }))

      try {
        const result = await generateDescriptionWithFallback(
          settings.provider,
          settings.apiKey,
          component.name,
          component.type,
          component.properties,
          component.parentName,
          settings.customPrompt || undefined,
          settings.customVariantPrompt || undefined,
          imageBase64,
          {
            enableFallback: settings.enableFallback,
            providerChain: settings.providerChain,
            onRetry: (attempt, maxAttempts) => {
              setRetryStatus((prev) => ({
                ...prev,
                [component.id]: { attempt: attempt + 1, maxAttempts }
              }))
            },
            onProviderAttempt: (provider) => {
              setUsedProvider((prev) => ({ ...prev, [component.id]: provider }))
            },
            shouldAbort: () => abortRetryRef.current[component.id] || abortGenerateAllRef.current
          }
        )

        // Clear retry status on success
        setRetryStatus((prev) => ({ ...prev, [component.id]: undefined }))

        // Track which provider was used
        setUsedProvider((prev) => ({ ...prev, [component.id]: result.usedProvider }))

        // Store in cache
        const cacheKey = getCacheKeyForComponent(component, imageBase64)
        cacheRef.current.set(cacheKey, result.description)
        saveCache()
        setCacheHits((prev) => ({ ...prev, [component.id]: false }))

        return { description: result.description, fromCache: false, usedProvider: result.usedProvider }
      } catch (error) {
        // Clear retry status on failure
        setRetryStatus((prev) => ({ ...prev, [component.id]: undefined }))
        throw error
      }
    },
    [settings, exportComponentImage, getCacheKeyForComponent, saveCache]
  )

  // Cancel retry for a specific component
  const handleCancelRetry = useCallback((componentId: string) => {
    abortRetryRef.current[componentId] = true
  }, [])

  // Wrapper for ComponentRow that expects just description string
  const handleGenerateForRow = useCallback(
    async (component: ComponentData): Promise<string> => {
      const result = await handleGenerate(component)
      return result.description
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
    setSettings(newSettings)
    emit<SaveSettingsHandler>('SAVE_SETTINGS', newSettings)
  }, [])

  const handleClearCache = useCallback(() => {
    emit<ClearCacheHandler>('CLEAR_CACHE')
  }, [])

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
    let currentIndex = 0
    let cacheHitCount = 0

    const processComponent = async (component: ComponentData) => {
      if (abortGenerateAllRef.current) return

      try {
        const result = await handleGenerate(component)

        if (result.fromCache) {
          cacheHitCount++
        }

        if (abortGenerateAllRef.current) return

        emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', {
          id: component.id,
          description: result.description
        })

        setComponents((prev) =>
          prev.map((c) =>
            c.id === component.id
              ? {
                  ...c,
                  previousDescription: c.currentDescription,
                  currentDescription: result.description
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
        const index = currentIndex++
        const component = componentsToGenerate[index]
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
        cacheHits={cacheHits}
        retryStatus={retryStatus}
        onCancelRetry={handleCancelRetry}
        usedProvider={usedProvider}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        defaultPrompt={DEFAULT_PROMPT}
        defaultVariantPrompt={DEFAULT_VARIANT_PROMPT}
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
