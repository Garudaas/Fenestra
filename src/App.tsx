import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import OneSignal from 'react-onesignal'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import LandingPage, { MemberLoginPage, AdminLoginPage, RegisterPage } from '@/pages/AuthPages'
import MemberDashboard from '@/pages/MemberDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import AlumniAssociationHome from '@/pages/AlumniAssociationHome'
import InvitePage from '@/pages/InvitePage'
import InstallAppPage from '@/pages/InstallAppPage'
import NotificationsPage from '@/pages/NotificationsPage'
import SmartAppLauncher from '@/pages/SmartAppLauncher'
import NotificationQuickBar from '@/components/NotificationQuickBar'
import SplashScreen from '@/components/SplashScreen'

function OneSignalUserSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (user && !user.is_placeholder) {
      OneSignal.login(String(user.id)).catch(() => {})
    }
  }, [user])

  return null
}

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
      <SplashScreen />
      <OneSignalUserSync />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<SmartAppLauncher />} />
          <Route path="/login" element={<MemberLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/install" element={<InstallAppPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/dashboard" element={<MemberDashboard />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/alumni-association" element={<AlumniAssociationHome />} />
        </Routes>
        <NotificationQuickBar />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
