import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import LandingPage, { MemberLoginPage, AdminLoginPage, RegisterPage } from '@/pages/AuthPages'
import MemberDashboard from '@/pages/MemberDashboard'
import AdminDashboard from '@/pages/AdminDashboard'
import AlumniAssociationHome from '@/pages/AlumniAssociationHome'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<MemberLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
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
