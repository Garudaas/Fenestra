import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
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
import MemberProfilePage from '@/pages/MemberProfilePage'
import ShareTargetPage from '@/pages/ShareTargetPage'
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

function PersistentSessionRedirect() {
  const { user, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !user.is_placeholder) {
      if (
        location.pathname === '/' ||
        location.pathname === '/login' ||
        location.pathname === '/admin'
      ) {
        navigate(isAdmin || user.is_admin ? '/admin-dashboard' : '/dashboard', { replace: true })
      }
    }
  }, [user, isAdmin, location.pathname, navigate])

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
        <PersistentSessionRedirect />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<SmartAppLauncher />} />
          <Route path="/login" element={<MemberLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/install" element={<InstallAppPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/share-target" element={<ShareTargetPage />} />
          <Route path="/member/:id" element={<MemberProfilePage />} />
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
