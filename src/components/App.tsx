import { createDefaultSettings } from '../settings'
import { emit, on } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

import {
  ApplyDescriptionHandler,
  ComponentData,
  ComponentsLoadedHandler,
  DescriptionAppliedHandler,
  StartCheckoutHandler,
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
  DEFAULT_PROMPT,
  DEFAULT_VARIANT_PROMPT,
  DEFAULT_ICON_PROMPT
} from '../services/ai'
import { GenerationBatch, getComponentSetMembers, getGenerationBatches } from '../utils/generationBatches'
import { isIconModeEnabled } from '../utils/icon'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { usePaymentSession } from '../hooks/usePaymentSession'
import { useGenerationCooldown } from '../hooks/useGenerationCooldown'
import { createGenerationRunner, GenerationError, idleGeneration } from '../services/generationRunner'
import { createComponentImageExporter } from '../services/componentImage'
import { Header } from './Header'
import { SettingsModal } from './SettingsModal'
import { ComponentList } from './ComponentList'

interface AppProps {
  scope: Scope
  currentPageName: string
}

const DEFAULT_SETTINGS = createDefaultSettings()

export function App({ scope, currentPageName }: AppProps) {
  const [components, setComponents] = useState<ComponentData[]>([])
  const [loadedPageName, setLoadedPageName] = useState(currentPageName)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [searchValue, setSearchValue] = useState('')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [images] = useState(createComponentImageExporter)
  useEffect(() => () => images.dispose(), [images])
  const [generation, setGeneration] = useState(idleGeneration)
  const isGenerating = generation.total > 0
  const [generatedThisSession, setGeneratedThisSession] = useState<Set<string>>(new Set())
  const cooldown = useGenerationCooldown()
  const [rowErrors, setRowErrors] = useState<Record<string, GenerationError | undefined>>({})
  const [headerNotice, setHeaderNotice] = useState<string | null>(null)
  const [iconOverrides, setIconOverrides] = useState<Record<string, boolean>>({})
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const { session: payments, usageState } = usePaymentSession(() => {
    setHeaderNotice(null)
    setRowErrors({})
  })
  // Load initial data and the current Figma payment identity.
  useEffect(() => {
    const unsubscribeComponents = on<ComponentsLoadedHandler>(
      'COMPONENTS_LOADED',
      (loadedComponents, pageName) => {
        setComponents(loadedComponents)
        setLoadedPageName(pageName)
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
          setRowErrors((prev) => ({ ...prev, [id]: { message: 'Failed to apply description to canvas' } }))
        } else {
          setRowErrors((prev) => ({ ...prev, [id]: undefined }))
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
    }
  }, [])

  const handleRefreshComponents = useCallback(() => {
    if (isRefreshing || isGenerating) {
      return
    }

    setIsRefreshing(true)
    setRowErrors({})
    setHeaderNotice(null)
    emit<LoadComponentsHandler>('LOAD_COMPONENTS')
  }, [isRefreshing, isGenerating])

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

  const generationBatches = getGenerationBatches(components, filteredComponents, settings.overwriteExisting, settings.showVariants)
  const generateCount = generationBatches.reduce((count, batch) => count + batch.members.length, 0)
  const pageGenerationCounts = new Map<string, number>()
  const coolingDownPages = new Set<string>()
  const coolingDownSets = new Set<string>()
  for (const component of components) {
    if (cooldown.ids.has(component.id)) coolingDownSets.add(component.parentId || component.id)
  }
  for (const batch of generationBatches) {
    for (const member of batch.members) {
      pageGenerationCounts.set(member.pageId, (pageGenerationCounts.get(member.pageId) || 0) + 1)
      if (cooldown.ids.has(member.id)) coolingDownPages.add(member.pageId)
    }
  }

  const handleGenerate = useCallback(
    async (component: ComponentData, abortSignal: AbortSignal): Promise<string> => {
      const isIcon = isIconModeEnabled(component.isIcon, iconOverrides[component.id])
      let imageBase64: string | undefined

      if (settings.includeImage || isIcon) {
        const image = await images.export(component.id, abortSignal)
        if (image) {
          imageBase64 = image
        }
      }

      const input = {
        componentName: component.name,
        componentType: component.type,
        properties: component.properties,
        parentName: component.parentName,
        customPrompt: settings.customPrompt || undefined,
        customVariantPrompt: settings.customVariantPrompt || undefined,
        imageBase64,
        iconOptions: { isIcon, customIconPrompt: settings.customIconPrompt || undefined },
        variantContext: component.variantContext,
        abortSignal
      }
      return payments.generate(input)
    },
    [settings, iconOverrides, payments, images]
  )

  const handleDisableIcon = useCallback((componentId: string) => {
    if (!components.find((component) => component.id === componentId)?.isIcon) return

    setIconOverrides((prev) => {
      if (prev[componentId] === false) return prev
      const newOverrides = { ...prev, [componentId]: false }

      // BUG-003 fix: persist icon overrides to settings
      const newSettings = { ...settings, iconOverrides: newOverrides }
      emit<SaveSettingsHandler>('SAVE_SETTINGS', newSettings)

      return newOverrides
    })
  }, [components, settings])

  const handleConfirm = useCallback((id: string, description: string) => {
    clearGeneratedThisSession(id)
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
  }, [clearGeneratedThisSession])

  const [runner] = useState(() => createGenerationRunner({
    onChange: setGeneration,
    onStart: ids => {
      setHeaderNotice(null)
      setRowErrors(previous => {
        const next = { ...previous }
        ids.forEach(id => { delete next[id] })
        return next
      })
    },
    onResult: (component, description) => {
      handleConfirm(component.id, description)
      markGeneratedThisSession(component.id)
      cooldown.start(component.id)
    },
    onError: (id, error) => setRowErrors(previous => ({ ...previous, [id]: error })),
    onQuotaExceeded: setHeaderNotice,
  }))
  useEffect(() => () => runner.cancel(), [runner])

  const handleGenerateBatches = useCallback((batches: GenerationBatch[], pageId?: string) => {
    if (isRefreshing || cooldown.includes(batches.flatMap(batch => batch.members.map(member => member.id)))) return Promise.resolve()
    return runner.run(batches, handleGenerate, pageId)
  }, [isRefreshing, runner, handleGenerate, cooldown.includes])

  const handleGenerateForRow = useCallback((component: ComponentData) => (
    handleGenerateBatches([{ members: [component] }])
  ), [handleGenerateBatches])

  const handleGenerateComponentSet = useCallback((componentSet: ComponentData) => (
    handleGenerateBatches([{ members: getComponentSetMembers(components, componentSet, settings.showVariants) }])
  ), [components, settings.showVariants, handleGenerateBatches])

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

  const handleResetSettings = useCallback(() => {
    const defaults = createDefaultSettings()
    setSettings(defaults)
    setIconOverrides({})
    emit<SaveSettingsHandler>('SAVE_SETTINGS', defaults)
  }, [])

  const handleUpgrade = useCallback(() => {
    emit<StartCheckoutHandler>('START_CHECKOUT')
  }, [])

  const handleGenerateAll = useCallback(() => {
    return handleGenerateBatches(generationBatches)
  }, [generationBatches, handleGenerateBatches])

  const handleGeneratePage = useCallback((pageId: string) => {
    const batches = getGenerationBatches(components, filteredComponents, settings.overwriteExisting, settings.showVariants, pageId)
    return handleGenerateBatches(batches, pageId)
  }, [components, filteredComponents, settings.overwriteExisting, settings.showVariants, handleGenerateBatches])

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
        if (!isGenerating) {
          handleGenerateAll()
        }
      },
      onCloseModal: handleCloseModal,
      onFocusSearch: () => {
        searchInputRef.current?.focus()
      }
    },
    searchInputRef,
    !isLoading,
    isSettingsOpen
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
        onCancelClick={runner.cancel}
        onRefreshClick={handleRefreshComponents}
        refreshTitle={scope === 'current-page' ? 'Rescan this page' : 'Rescan entire file'}
        scopeLabel={scope === 'current-page' ? 'This page' : 'Entire file'}
        pageName={scope === 'current-page' ? loadedPageName : undefined}
        overwriteExisting={settings.overwriteExisting}
        isGenerating={isGenerating}
        isRefreshing={isRefreshing}
        isCoolingDown={coolingDownPages.size > 0}
        progress={generation}
        generateCount={generateCount}
        searchInputRef={searchInputRef}
        usageState={usageState}
        notice={headerNotice}
        onUpgrade={handleUpgrade}
      />

      <ComponentList
        components={filteredComponents}
        pageGeneration={scope === 'all-pages' ? {
          counts: pageGenerationCounts,
          activePageId: generation.pageId,
          progress: generation,
          overwriteExisting: settings.overwriteExisting,
          isRefreshing,
          coolingDownPages,
          onGenerate: handleGeneratePage,
          onCancel: runner.cancel,
        } : undefined}
        showVariants={settings.showVariants}
        searchValue={searchValue}
        scope={scope}
        isModalOpen={isSettingsOpen}
        onGenerate={handleGenerateForRow}
        onGenerateComponentSet={handleGenerateComponentSet}
        onConfirm={handleConfirm}
        onRevert={handleRevert}
        onSelect={(id) => {
          emit<SelectComponentHandler>('SELECT_COMPONENT', { id })
        }}
        isGenerating={isGenerating}
        rowErrors={rowErrors}
        iconOverrides={iconOverrides}
        onDisableIcon={handleDisableIcon}
        generatedThisSession={generatedThisSession}
        coolingDownIds={cooldown.ids}
        coolingDownSets={coolingDownSets}
        onUpgrade={handleUpgrade}
        pendingIds={generation.pendingIds}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
        defaultPrompt={DEFAULT_PROMPT}
        defaultVariantPrompt={DEFAULT_VARIANT_PROMPT}
        defaultIconPrompt={DEFAULT_ICON_PROMPT}
      />
    </div>
  )
}
