import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import OneSignal from 'react-onesignal'
import { AuthProvider } from '@/context/AuthContext'
import LandingPage, { MemberLoginPage, AdminLoginPage, RegisterPage } from '@/pages/AuthPages'
import MemberDashboard from '@/pages/MemberDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import AlumniAssociationHome from '@/pages/AlumniAssociationHome'
import InvitePage from '@/pages/InvitePage'

export function App() {
  useEffect(() => {
    const initOneSignal = async () => {
      await OneSignal.init({
        appId: "b7497f89-baee-4453-aed3-94e7380e7007",
        allowLocalhostAsSecureOrigin: true
      })
      OneSignal.Slidedown.promptPush()
    }
    
    initOneSignal()

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      ;(window as any).deferredInstallPrompt = e
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<MemberLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/dashboard" element={<MemberDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/alumni-association" element={<AlumniAssociationHome />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
