const EXPANDED_PREFIX = 'fenestrians_expanded_'
const PREV_ROUTE_KEY = 'fenestrians_prev_route'

/**
 * Reads the currently expanded accordion key for a given page scope.
 * Defaults to null (all tabs collapsed).
 */
export function getPersistedExpandedTab(scope: string): string | null {
  try {
    return sessionStorage.getItem(`${EXPANDED_PREFIX}${scope}`) || null
  } catch {
    return null
  }
}

/**
 * Persists the single expanded accordion key for a page scope.
 * Passing null collapses all tabs in that scope.
 */
export function setPersistedExpandedTab(scope: string, tabKey: string | null): void {
  try {
    const key = `${EXPANDED_PREFIX}${scope}`
    if (!tabKey) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, tabKey)
    }
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Toggles a tab so opening it collapses all other tabs in the same scope,
 * or collapses it if already open.
 */
export function toggleExclusiveTab(scope: string, currentKey: string | null, clickedKey: string): string | null {
  const next = currentKey === clickedKey ? null : clickedKey
  setPersistedExpandedTab(scope, next)
  return next
}

/**
 * Records the current route before navigating forward to another page.
 */
export function recordPreviousRoute(currentFullPath: string): void {
  try {
    sessionStorage.setItem(PREV_ROUTE_KEY, currentFullPath)
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Returns the recorded previous route (or fallback) when closing a page.
 */
export function consumePreviousRoute(fallback = '/dashboard'): string {
  try {
    const prev = sessionStorage.getItem(PREV_ROUTE_KEY)
    if (prev && prev.trim()) {
      return prev
    }
  } catch {
    // Ignore storage restrictions
  }
  return fallback
}
