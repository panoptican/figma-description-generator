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
  SettingsSavedHandler
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
  includeImage: true
}

export function App({ scope, currentPageName }: AppProps) {
  const [components, setComponents] = useState<ComponentData[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [searchValue, setSearchValue] = useState('')
  const [showVariants, setShowVariants] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false)
  const [generateProgress, setGenerateProgress] = useState({ current: 0, total: 0 })
  const abortGenerateAllRef = useRef(false)
  const imageExportResolveRef = useRef<((imageBase64: string | null) => void) | null>(null)

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
        setSettings(loadedSettings)
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
    // Filter out variants if toggle is off
    if (!showVariants && component.type === 'VARIANT') {
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
        c.id === id ? { ...c, currentDescription: description } : c
      )
    )
  }, [])

  const handleReject = useCallback((id: string) => {
    // Reset is handled in ComponentRow
  }, [])

  const handleSaveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings)
    emit<SaveSettingsHandler>('SAVE_SETTINGS', newSettings)
  }, [])

  const handleGenerateAll = useCallback(async () => {
    if (!settings.apiKey) return

    setIsGeneratingAll(true)
    abortGenerateAllRef.current = false

    // Generate descriptions for all components without existing descriptions
    const componentsToGenerate = filteredComponents.filter(
      (c) => !c.currentDescription
    )

    setGenerateProgress({ current: 0, total: componentsToGenerate.length })

    for (let i = 0; i < componentsToGenerate.length; i++) {
      const component = componentsToGenerate[i]

      // Check if cancelled
      if (abortGenerateAllRef.current) {
        break
      }

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

        // Check again after async call in case cancelled during generation
        if (abortGenerateAllRef.current) {
          break
        }

        emit<ApplyDescriptionHandler>('APPLY_DESCRIPTION', {
          id: component.id,
          description
        })

        setComponents((prev) =>
          prev.map((c) =>
            c.id === component.id ? { ...c, currentDescription: description } : c
          )
        )

        setGenerateProgress({ current: i + 1, total: componentsToGenerate.length })
      } catch (error) {
        console.error(`Failed to generate for ${component.name}:`, error)
        setGenerateProgress({ current: i + 1, total: componentsToGenerate.length })
      }
    }

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
        showVariants={showVariants}
        onShowVariantsChange={setShowVariants}
        scope={scope}
        currentPageName={currentPageName}
      />

      <ComponentList
        components={filteredComponents}
        onGenerate={handleGenerate}
        onConfirm={handleConfirm}
        onReject={handleReject}
        isGenerating={isGeneratingAll}
        hasApiKey={!!settings.apiKey}
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
