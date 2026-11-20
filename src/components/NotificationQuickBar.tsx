import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  fetchUserNotifications,
  clearChatNotifications,
  isChatNotification,
  isCallNotification,
} from '@/lib/notificationService'
import { Bell, MessageSquare, Phone } from 'lucide-react'

export default function NotificationQuickBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [unreadCallCount, setUnreadCallCount] = useState(0)

  const refreshCounts = useCallback(async () => {
    if (!user || user.is_placeholder) return

    const list = await fetchUserNotifications(user.id)
    const unread = list.filter(item => item.status === 'unread')

    let chatTotal = 0
    let callTotal = 0
    let otherTotal = 0

    for (const item of unread) {
      if (isChatNotification(item.category)) {
        chatTotal += item.unread_count || 1
      } else if (isCallNotification(item.category)) {
        callTotal += item.unread_count || 1
      } else {
        otherTotal += 1
      }
    }

    setUnreadChatCount(chatTotal)
    setUnreadCallCount(callTotal)
    setUnreadAlertsCount(otherTotal + chatTotal + callTotal)

    // Check if any snoozed notification is due now
    const now = Date.now()
    for (const item of unread) {
      if (
        item.snoozed_until &&
        !item.snooze_notified &&
        new Date(item.snoozed_until).getTime() <= now
      ) {
        await supabase
          .from('user_notifications')
          .update({ snooze_notified: true, updated_at: new Date().toISOString() })
          .eq('id', item.id)

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Snoozed: ${item.short_title}`, {
            body: item.full_message,
            icon: '/icon.png',
          })
        }

        window.dispatchEvent(new CustomEvent('fenestrians-open-snoozed', { detail: item }))
        if (location.pathname !== '/notifications') {
          navigate('/notifications')
        }
        break
      }
    }
  }, [user, location.pathname, navigate])

  useEffect(() => {
    if (!user || user.is_placeholder) return
    refreshCounts()

    const interval = setInterval(refreshCounts, 20000)
    window.addEventListener('fenestrians-notifications-updated', refreshCounts)
    return () => {
      clearInterval(interval)
      window.removeEventListener('fenestrians-notifications-updated', refreshCounts)
    }
  }, [user, refreshCounts])

  // Reset unread chat count immediately when user opens the chat window
  useEffect(() => {
    if (!user) return
    if (location.search.includes('tab=chat')) {
      clearChatNotifications(user.id).then(() => setUnreadChatCount(0))
    }
  }, [user, location.search])

  if (!user || user.is_placeholder) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-primary/40 bg-card/90 px-3 py-2 shadow-2xl backdrop-blur-md">
      {/* Unread Notifications Button */}
      <button
        type="button"
        onClick={() => navigate('/notifications')}
        title="Notifications"
        className="relative flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-all"
      >
        <Bell className="h-4 w-4" />
        <span>Alerts</span>
        {unreadAlertsCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
            {unreadAlertsCount}
          </span>
        )}
      </button>

      {/* Unread Chats Red Circle Counter */}
      <button
        type="button"
        onClick={async () => {
          await clearChatNotifications(user.id)
          setUnreadChatCount(0)
          navigate('/dashboard?tab=chat')
        }}
        title="Chat"
        className="relative flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
      >
        <MessageSquare className="h-4 w-4 text-emerald-400" />
        {unreadChatCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
            {unreadChatCount}
          </span>
        )}
      </button>

      {/* Unread Calls Red Circle Counter */}
      <button
        type="button"
        onClick={() => navigate('/dashboard?tab=voice')}
        title="Calls"
        className="relative flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all"
      >
        <Phone className="h-4 w-4 text-amber-400" />
        {unreadCallCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
            {unreadCallCount}
          </span>
        )}
      </button>
    </div>
  )
}
