import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

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
import { generateDescription, DEFAULT_PROMPT, DEFAULT_VARIANT_PROMPT } from '../services/ai'
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
  includeImage: false,
  showVariants: true,
  overwriteExisting: false
}

export function App({ scope, currentPageName }: AppProps) {
  const [components, setComponents] = useState<ComponentData[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [searchValue, setSearchValue] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
  const [rowErrors, setRowErrors] = useState<Record<string, string | undefined>>({})
  const abortGenerateAllRef = useRef(false)
  const imageExportResolveRef = useRef<((imageBase64: string | null) => void) | null>(null)
  const CONCURRENCY_LIMIT = 3

  // Helper to export component image and wait for result
  const exportComponentImage = useCallback((componentId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      imageExportResolveRef.current = resolve
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

  const handleGenerate = useCallback(
    async (component: ComponentData): Promise<string> => {
      let imageBase64: string | undefined

      if (settings.includeImage) {
        const image = await exportComponentImage(component.id)
        if (image) {
          imageBase64 = image
        }
      }

      return generateDescription(
        settings.provider,
        settings.apiKey,
        component.name,
        component.type,
        component.properties,
        component.parentName,
        settings.customPrompt || undefined,
        settings.customVariantPrompt || undefined,
        imageBase64
      )
    },
    [settings, exportComponentImage]
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

    const processComponent = async (component: ComponentData) => {
      if (abortGenerateAllRef.current) return

      try {
        let imageBase64: string | undefined

        if (settings.includeImage) {
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
          imageBase64
        )

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
  }, [filteredComponents, settings, exportComponentImage])

  const handleCancelGenerateAll = useCallback(() => {
    abortGenerateAllRef.current = true
  }, [])

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
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
        progress={generateProgress}
        totalCount={totalDisplayed}
        missingCount={missingCount}
        generateCount={generateCount}
        scope={scope}
        currentPageName={currentPageName}
      />

      <ComponentList
        components={filteredComponents}
        onGenerate={handleGenerate}
        onConfirm={handleConfirm}
        onReject={handleReject}
        onRevert={handleRevert}
        onSelect={(id) => emit<SelectComponentHandler>('SELECT_COMPONENT', { id })}
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
        rowErrors={rowErrors}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        defaultPrompt={DEFAULT_PROMPT}
        defaultVariantPrompt={DEFAULT_VARIANT_PROMPT}
      />
    </div>
  )
}
