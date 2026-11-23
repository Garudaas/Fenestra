const DB_NAME = 'FenestriansOfflineDB'
const STORE_NAME = 'kv_store'
const DIRECTORY_KEY = 'emergency_directory_cache'

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveOfflineDirectory(members: any[]): Promise<void> {
  const payload = {
    members,
    syncedAt: new Date().toISOString(),
  }

  try {
    const db = await openOfflineDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(payload, DIRECTORY_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    try {
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage quota issues
    }
  }
}

export async function loadOfflineDirectory(): Promise<{
  members: any[]
  syncedAt: string | null
}> {
  try {
    const db = await openOfflineDB()
    const record = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(DIRECTORY_KEY)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (record && Array.isArray(record.members)) {
      return { members: record.members, syncedAt: record.syncedAt || null }
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(DIRECTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        members: Array.isArray(parsed.members) ? parsed.members : [],
        syncedAt: parsed.syncedAt || null,
      }
    }
  } catch {
    // Ignore
  }

  return { members: [], syncedAt: null }
}

/**
 * Syncs unread alerts + pending tasks onto the installed phone/desktop app icon.
 */
export function updateAppIconBadge(count: number): void {
  try {
    const nav = navigator as any
    if (typeof nav.setAppBadge === 'function') {
      if (count > 0) {
        nav.setAppBadge(count).catch(() => {})
      } else if (typeof nav.clearAppBadge === 'function') {
        nav.clearAppBadge().catch(() => {})
      }
    }
  } catch {
    // Ignore on browsers without Badging API
  }
}
