import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { checkIsPresidentOrGenSec } from '@/lib/taskAuditService'

export interface AlumniUser {
  id: number
  custom_username: string
  custom_password: string
  full_name: string
  gender: string
  dob: string | null
  email: string | null
  contact_number: string | null
  whatsapp_number: string | null
  blood_group: string | null
  education_level?: string | null
  current_status: string | null
  profile_picture_url: string | null
  permanent_address: string | null
  permanent_geo_location: string | null
  current_address: string | null
  current_geo_location: string | null
  marital_status: string | null
  wedding_date: string | null
  divorce_date: string | null
  spouse_name: string | null
  spouse_dob: string | null
  spouse_details: string | null
  diary_logs: string | null
  hide_from_peers: boolean
  hide_from_admin: boolean
  allow_profile_pic_download?: boolean
  allow_media_download?: boolean
  default_media_private?: boolean
  storage_quota_mb?: number
  is_placeholder: boolean
  is_admin: boolean
  officer_title?: string | null
  placeholder_code: string | null
  class_nickname: string | null
}

interface AuthContextType {
  user: AlumniUser | null
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>
  adminLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (
    code: string,
    username: string,
    password: string,
    name: string,
    gender: string,
    dob: string,
    email: string,
    phone: string
  ) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAdmin: boolean
}

const SESSION_STORAGE_KEY = 'alumni_session'
const SESSION_COOKIE_NAME = 'fenestrians_uid'

function setPersistentCookie(userId: number) {
  try {
    const oneYearSeconds = 60 * 60 * 24 * 365
    document.cookie = `${SESSION_COOKIE_NAME}=${userId}; path=/; max-age=${oneYearSeconds}; SameSite=Lax`
  } catch {
    // Ignore
  }
}

function getPersistentCookieUserId(): number | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE_NAME}=([^;]*)`))
    if (match && match[1]) {
      const parsed = Number(decodeURIComponent(match[1]))
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null
    }
  } catch {
    // Ignore
  }
  return null
}

function clearPersistentCookie() {
  try {
    document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
  } catch {
    // Ignore
  }
}

function sanitizeUserForStorage(raw: any): AlumniUser {
  const pic = typeof raw.profile_picture_url === 'string' ? raw.profile_picture_url : null
  const lightweightPic = pic && pic.startsWith('data:') && pic.length > 50000 ? null : pic

  return {
    ...raw,
    custom_password: '',
    profile_picture_url: lightweightPic,
  } as AlumniUser
}

function persistSession(rawUser: any) {
  const safeUser = sanitizeUserForStorage(rawUser)
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeUser))
  } catch {
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          id: safeUser.id,
          full_name: safeUser.full_name,
          custom_username: safeUser.custom_username,
          is_admin: Boolean(safeUser.is_admin),
          officer_title: safeUser.officer_title || null,
          is_placeholder: false,
        })
      )
    } catch {
      // Cookie backup still preserves user ID
    }
  }
  setPersistentCookie(safeUser.id)
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {})
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AlumniUser | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return Boolean(parsed.is_admin)
      }
      return false
    } catch {
      return false
    }
  })

  useEffect(() => {
    const restoreOrRefreshSession = async () => {
      const storedId = user?.id ?? getPersistentCookieUserId()
      if (!storedId) return

      const [{ data, error }, execInfo] = await Promise.all([
        supabase
          .from('alumni_directory_safe')
          .select('*')
          .eq('id', storedId)
          .eq('is_placeholder', false)
          .maybeSingle(),
        checkIsPresidentOrGenSec(storedId),
      ])

      if (data && !error) {
        const effectiveAdmin = Boolean(data.is_admin || execInfo.hasExecutiveAdmin)
        const hydrated = {
          ...data,
          custom_password: '',
          is_admin: effectiveAdmin,
          officer_title: execInfo.officeTitle,
        } as AlumniUser
        setUser(hydrated)
        setIsAdmin(effectiveAdmin)
        persistSession(hydrated)
      }
    }

    restoreOrRefreshSession()
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const cleanId = identifier.trim()

    const { data: rpcRows } = await supabase.rpc('verify_member_credentials', {
      p_identifier: cleanId,
      p_password: password,
    })

    let matchedUser = Array.isArray(rpcRows) && rpcRows.length > 0 ? rpcRows[0] : null

    if (!matchedUser) {
      const { data, error } = await supabase
        .from('alumni')
        .select('*')
        .or(`custom_username.ilike.${cleanId},email.ilike.${cleanId},contact_number.eq.${cleanId}`)
        .eq('custom_password', password)
        .eq('is_placeholder', false)
        .maybeSingle()

      if (!data) {
        return { success: false, error: error?.message || 'Login failed. Please check your credentials.' }
      }
      matchedUser = data
    }

    const execInfo = await checkIsPresidentOrGenSec(matchedUser.id)
    const effectiveAdmin = Boolean(matchedUser.is_admin || execInfo.hasExecutiveAdmin)

    const safeUser = {
      ...matchedUser,
      custom_password: '',
      is_admin: effectiveAdmin,
      officer_title: execInfo.officeTitle,
    } as AlumniUser

    setUser(safeUser)
    setIsAdmin(effectiveAdmin)
    persistSession(safeUser)
    return { success: true }
  }, [])

  const adminLogin = useCallback(async (username: string, password: string) => {
    const cleanUser = username.trim()

    const { data: rpcRows } = await supabase.rpc('verify_member_credentials', {
      p_identifier: cleanUser,
      p_password: password,
    })

    let matchedAdmin = Array.isArray(rpcRows) && rpcRows.length > 0 ? rpcRows[0] : null

    if (!matchedAdmin) {
      const { data } = await supabase
        .from('alumni')
        .select('*')
        .eq('custom_username', cleanUser)
        .eq('custom_password', password)
        .eq('is_placeholder', false)
        .maybeSingle()

      if (!data) {
        return { success: false, error: 'Access Denied.' }
      }
      matchedAdmin = data
    }

    const execInfo = await checkIsPresidentOrGenSec(matchedAdmin.id)
    if (!matchedAdmin.is_admin && !execInfo.hasExecutiveAdmin) {
      return { success: false, error: 'Access Denied.' }
    }

    const safeAdmin = {
      ...matchedAdmin,
      custom_password: '',
      is_admin: true,
      officer_title: execInfo.officeTitle,
    } as AlumniUser

    setUser(safeAdmin)
    setIsAdmin(true)
    persistSession(safeAdmin)
    return { success: true }
  }, [])

  const register = useCallback(
    async (
      code: string,
      username: string,
      password: string,
      name: string,
      gender: string,
      dob: string,
      email: string,
      phone: string
    ) => {
      const { data: slot } = await supabase
        .from('alumni')
        .select('*')
        .eq('placeholder_code', code)
        .eq('is_placeholder', true)
        .maybeSingle()

      if (!slot) {
        return { success: false, error: 'Invalid Passcode.' }
      }

      const { error } = await supabase
        .from('alumni')
        .update({
          custom_username: username,
          custom_password: password,
          full_name: name,
          gender,
          dob,
          email,
          contact_number: phone,
          is_placeholder: false,
        })
        .eq('id', slot.id)

      if (error) {
        return { success: false, error: error.message }
      }

      try {
        await fetch('https://dojlbfnfhkfltlxggxiy.supabase.co/functions/v1/daily-notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'sb_publishable_CmCFzsQ_L8dk7NxUmIVZ0g_pl_jq0fV',
          },
          body: JSON.stringify({
            event: 'new_member',
            fullName: name.trim(),
          }),
        })
      } catch (notifyErr) {
        console.error('Failed to send new member notification:', notifyErr)
      }

      return { success: true }
    },
    []
  )

  const logout = useCallback(() => {
    setUser(null)
    setIsAdmin(false)
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // Ignore
    }
    clearPersistentCookie()
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, adminLogin, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
