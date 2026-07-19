import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

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
  is_placeholder: boolean
  is_admin: boolean
  placeholder_code: string | null
  class_nickname: string | null
}

interface AuthContextType {
  user: AlumniUser | null
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>
  adminLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (code: string, username: string, password: string, name: string, gender: string, dob: string, email: string, phone: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AlumniUser | null>(() => {
    const saved = localStorage.getItem('alumni_session')
    return saved ? JSON.parse(saved) : null
  })
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem('alumni_session')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.is_admin || false
    }
    return false
  })

  const login = useCallback(async (identifier: string, password: string) => {
    const { data, error } = await supabase
      .from('alumni')
      .select('*')
      .or(`custom_username.ilike.${identifier},email.ilike.${identifier},contact_number.eq.${identifier}`)
      .eq('custom_password', password)
      .eq('is_placeholder', false)
      .maybeSingle() // Fixed

    if (data) {
      setUser(data)
      setIsAdmin(false)
      localStorage.setItem('alumni_session', JSON.stringify(data))
      return { success: true }
    }
    return { success: false, error: error?.message || 'Login failed. Please check your credentials.' }
  }, [])

  const adminLogin = useCallback(async (username: string, password: string) => {
    const { data } = await supabase
      .from('alumni')
      .select('*')
      .eq('custom_username', username)
      .eq('custom_password', password)
      .eq('is_admin', true)
      .maybeSingle() // Fixed

    if (data) {
      setUser(data)
      setIsAdmin(true)
      localStorage.setItem('alumni_session', JSON.stringify(data))
      return { success: true }
    }
    return { success: false, error: 'Access Denied.' }
  }, [])

  const register = useCallback(async (code: string, username: string, password: string, name: string, gender: string, dob: string, email: string, phone: string) => {
    const { data: slot } = await supabase
      .from('alumni')
      .select('*')
      .eq('placeholder_code', code)
      .eq('is_placeholder', true)
      .maybeSingle() // Fixed

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
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setIsAdmin(false)
    localStorage.removeItem('alumni_session')
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
