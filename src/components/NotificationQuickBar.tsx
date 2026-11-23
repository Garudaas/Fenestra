import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { updateAppIconBadge } from '@/lib/offlineCache'
import {
  fetchUserNotifications,
  clearChatNotifications,
  isChatNotification,
  isCallNotification,
} from '@/lib/notificationService'
import { Bell, MessageSquare, Phone, GripVertical } from 'lucide-react'

const POS_STORAGE_KEY = 'fenestrians_quickbar_pos'

export default function NotificationQuickBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [unreadCallCount, setUnreadCallCount] = useState(0)

  const [customPos, setCustomPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const dragStateRef = useRef<{
    dragging: boolean
    startX: number
    startY: number
    origX: number
    origY: number
  }>({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 })
  const barRef = useRef<HTMLDivElement | null>(null)

  const refreshCounts = useCallback(async () => {
    if (!user || user.is_placeholder) return

    const [list, pendingTasksRes] = await Promise.all([
      fetchUserNotifications(user.id),
      supabase
        .from('member_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to_user_id', user.id)
        .eq('status', 'pending'),
    ])

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

    const totalAlertBadge = otherTotal + chatTotal + callTotal
    setUnreadChatCount(chatTotal)
    setUnreadCallCount(callTotal)
    setUnreadAlertsCount(totalAlertBadge)

    // Sync total unread alerts + pending tasks onto the phone/desktop app icon badge
    const pendingTaskCount = pendingTasksRes.count || 0
    updateAppIconBadge(Math.max(totalAlertBadge, pendingTaskCount))

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
    if (!user || user.is_placeholder) {
      updateAppIconBadge(0)
      return
    }
    refreshCounts()

    const channel = supabase
      .channel(`live-quickbar-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshCounts()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications_archive',
        },
        () => {
          refreshCounts()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_tasks',
          filter: `assigned_to_user_id=eq.${user.id}`,
        },
        () => {
          refreshCounts()
        }
      )
      .subscribe()

    const snoozeTimer = setInterval(refreshCounts, 30000)
    window.addEventListener('fenestrians-notifications-updated', refreshCounts)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(snoozeTimer)
      window.removeEventListener('fenestrians-notifications-updated', refreshCounts)
    }
  }, [user, refreshCounts])

  useEffect(() => {
    if (!user) return
    if (location.search.includes('tab=chat')) {
      clearChatNotifications(user.id).then(() => setUnreadChatCount(0))
    }
  }, [user, location.search])

  const clampPosition = (x: number, y: number) => {
    const el = barRef.current
    const width = el?.offsetWidth || 230
    const height = el?.offsetHeight || 48
    const maxX = Math.max(8, window.innerWidth - width - 8)
    const maxY = Math.max(60, window.innerHeight - height - 8)
    return {
      x: Math.min(maxX, Math.max(8, x)),
      y: Math.min(maxY, Math.max(60, y)),
    }
  }

  const startDrag = (clientX: number, clientY: number) => {
    const rect = barRef.current?.getBoundingClientRect()
    const origX = rect ? rect.left : window.innerWidth - 240
    const origY = rect ? rect.top : window.innerHeight - 64
    dragStateRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origX,
      origY,
    }
  }

  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!dragStateRef.current.dragging) return
      const dx = clientX - dragStateRef.current.startX
      const dy = clientY - dragStateRef.current.startY
      const next = clampPosition(
        dragStateRef.current.origX + dx,
        dragStateRef.current.origY + dy
      )
      setCustomPos(next)
    }

    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY)
    const handleTouchMove = (e: TouchEvent) => {
      if (dragStateRef.current.dragging && e.touches[0]) {
        onMove(e.touches[0].clientX, e.touches[0].clientY)
      }
    }

    const handleEnd = () => {
      if (dragStateRef.current.dragging) {
        dragStateRef.current.dragging = false
        setCustomPos(curr => {
          if (curr) {
            try {
              localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(curr))
            } catch {
              // Ignore
            }
          }
          return curr
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchend', handleEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [])

  if (!user || user.is_placeholder) return null

  const positionStyle: React.CSSProperties = customPos
    ? { left: `${customPos.x}px`, top: `${customPos.y}px` }
    : { right: '16px', bottom: '16px' }

  return (
    <div
      ref={barRef}
      style={positionStyle}
      className="fixed z-40 flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/90 px-2.5 py-2 shadow-2xl backdrop-blur-md"
    >
      <button
        type="button"
        title="Drag to move floating bar"
        onMouseDown={e => {
          e.preventDefault()
          startDrag(e.clientX, e.clientY)
        }}
        onTouchStart={e => {
          if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY)
        }}
        className="flex h-7 w-5 cursor-grab active:cursor-grabbing items-center justify-center text-muted-foreground hover:text-primary touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

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

      <button
        type="button"
        onClick={() => navigate('/dashboard?tab=calls')}
        title="Voice & Video Calls"
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
