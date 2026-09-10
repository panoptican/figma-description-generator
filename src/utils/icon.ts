const ICON_PATTERN = /\bicons?\b/i

/**
 * Identifies components that should use the icon-specific description prompt.
 * Page names are included because icon libraries often use descriptive names
 * for their components instead of putting "icon" in every component name.
 */
export function isIconComponent(componentName: string, pageName: string): boolean {
  return ICON_PATTERN.test(componentName) || ICON_PATTERN.test(pageName)
}

export function isIconModeEnabled(autoDetected: boolean | undefined, override: boolean | undefined): boolean {
  // Older manual-on overrides cannot enable icon mode without the naming rule.
  return autoDetected === true && override !== false
}
