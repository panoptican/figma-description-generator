import { useEffect, useCallback, MutableRef } from 'preact/hooks'

export interface KeyboardShortcutHandlers {
  onGenerateSingle?: () => void
  onGenerateAll?: () => void
  onFocusSearch?: () => void
  onCloseModal?: () => void
  onRevert?: () => void
}

/**
 * Hook for handling keyboard shortcuts throughout the application.
 * Uses Cmd on Mac and Ctrl on Windows.
 *
 * Shortcuts:
 * - Cmd/Ctrl+G: Generate description for selected component
 * - Cmd/Ctrl+Shift+G: Generate all descriptions
 * - Cmd/Ctrl+F: Focus search field
 * - Cmd/Ctrl+Z: Revert to previous description (when not in text field)
 * - Escape: Close settings modal if open
 */
export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  searchInputRef?: MutableRef<HTMLInputElement | null>,
  enabled: boolean = true,
  isModalOpen: boolean = false
) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Check for modifier key (Cmd on Mac, Ctrl on Windows)
    const modKey = event.metaKey || event.ctrlKey

    // Escape - close modal
    if (event.key === 'Escape') {
      event.preventDefault()
      handlers.onCloseModal?.()
      return
    }

    // Keep Escape available, but leave modal editing and focus to the dialog.
    if (isModalOpen) return

    // Don't trigger shortcuts when typing in input fields (except Escape)
    const target = event.target as HTMLElement
    const isInTextInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    // Cmd/Ctrl+F - focus search (allow even in text inputs)
    if (modKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      if (searchInputRef?.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
      handlers.onFocusSearch?.()
      return
    }

    // Skip other shortcuts when in text inputs
    if (isInTextInput) return

    // Cmd/Ctrl+Shift+G - generate all
    if (modKey && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      handlers.onGenerateAll?.()
      return
    }

    // Cmd/Ctrl+G - generate single
    if (modKey && !event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault()
      handlers.onGenerateSingle?.()
      return
    }

    // Cmd/Ctrl+Z - revert (only when not in text input)
    if (modKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      handlers.onRevert?.()
      return
    }
  }, [handlers, searchInputRef, enabled, isModalOpen])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, enabled])
}

/**
 * Returns the correct modifier key label based on platform
 */
export function getModifierKeyLabel(): string {
  // Check if we're on Mac
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  return isMac ? '⌘' : 'Ctrl+'
}

/**
 * Get formatted shortcut label for display
 */
export function getShortcutLabel(key: string, shift: boolean = false): string {
  const mod = getModifierKeyLabel()
  return shift ? `${mod}⇧${key}` : `${mod}${key}`
}
