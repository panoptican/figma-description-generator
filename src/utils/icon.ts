const ICON_NAME_PATTERN = /^icon\b/i
const ICON_PAGE_PATTERN = /\bicons?\b/i

/**
 * Identifies components that should use the icon-specific description prompt.
 * Page names are included because icon libraries often use descriptive names
 * for their components instead of putting "icon" in every component name.
 */
export function isIconComponent(componentName: string, pageName: string): boolean {
  return ICON_NAME_PATTERN.test(componentName) || ICON_PAGE_PATTERN.test(pageName)
}
