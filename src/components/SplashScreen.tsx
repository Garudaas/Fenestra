import { useState, useEffect } from 'react'

const SPLASH_SESSION_KEY = 'fenestrians_launch_splash_shown'

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    try {
      return sessionStorage.getItem(SPLASH_SESSION_KEY) !== 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!visible) return

    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, 'true')
    } catch {
      // Ignore storage errors in restricted contexts
    }

    const timer = setTimeout(() => {
      setVisible(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black transition-opacity duration-500">
      <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="h-32 w-32 overflow-hidden rounded-3xl border-2 border-primary/50 shadow-2xl shadow-primary/20">
          <img
            src="/icon.png"
            alt="Fenestrians Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-wider text-primary">FENESTRIANS</h1>
          <p className="text-xs tracking-widest uppercase text-muted-foreground">
            Exclusive Alumni Network
          </p>
        </div>
      </div>
    </div>
  )
}
