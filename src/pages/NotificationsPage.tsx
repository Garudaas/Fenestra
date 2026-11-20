import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllStandardNotificationsRead,
  snoozeNotification,
  deleteAllReadNotifications,
  recallNotificationHistory,
  clearChatNotifications,
  clearCallNotification,
  isChatNotification,
  isCallNotification,
  type UserNotificationItem,
} from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Bell,
  CheckCheck,
  Clock,
  X,
  RefreshCw,
  Trash2,
  History,
  MessageSquare,
  Phone,
  Video,
  AlertTriangle,
  Sparkles,
  Users,
  Calendar,
  Heart,
  Cake,
  HelpCircle,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react'

function getCategoryIcon(category: string) {
  switch (category) {
    case 'birthday':
      return <Cake className="h-4 w-4 text-pink-400 shrink-0" />
    case 'anniversary':
      return <Heart className="h-4 w-4 text-rose-400 shrink-0" />
    case 'new_member':
      return <Users className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'app_update':
      return <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
    case 'help_needed':
      return <HelpCircle className="h-4 w-4 text-red-400 shrink-0" />
    case 'event':
      return <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
    case 'common_task':
    case 'personal_task':
      return <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0" />
    case 'common_chat':
    case 'private_chat':
    case 'group_chat':
      return <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0" />
    case 'group_call':
      return <Phone className="h-4 w-4 text-amber-400 shrink-0" />
    case 'video_call':
      return <Video className="h-4 w-4 text-purple-400 shrink-0" />
    case 'instruction':
    case 'important_member_message':
      return <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
    default:
      return <Bell className="h-4 w-4 text-primary shrink-0" />
  }
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread')
  const [items, setItems] = useState<UserNotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  // Modal state for viewing an Unread notification
  const [selectedItem, setSelectedItem] = useState<UserNotificationItem | null>(null)
  const [snoozeValue, setSnoozeValue] = useState<number>(10)
  const [snoozeUnit, setSnoozeUnit] = useState<'minutes' | 'hours'>('minutes')

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const list = await fetchUserNotifications(user.id)
    setItems(list)
    setLoading(false)
    window.dispatchEvent(new Event('fenestrians-notifications-updated'))
  }, [user])

  useEffect(() => {
    if (!user) {
      navigate('/')
      return
    }
    loadAll()
  }, [user, navigate, loadAll])

  // Listen for due snooze popups triggered automatically
  useEffect(() => {
    const handleSnoozeTrigger = (e: Event) => {
      const detail = (e as CustomEvent<UserNotificationItem>).detail
      if (detail) {
        setSelectedItem(detail)
        setSnoozeValue(detail.snooze_minutes || 10)
        setSnoozeUnit('minutes')
      }
    }
    window.addEventListener('fenestrians-open-snoozed', handleSnoozeTrigger)
    return () => window.removeEventListener('fenestrians-open-snoozed', handleSnoozeTrigger)
  }, [])

  const unreadList = items.filter(i => i.status === 'unread')
  const readList = items.filter(i => i.status === 'read')

  const totalUnreadBadgeCount = unreadList.reduce(
    (sum, item) => sum + (item.unread_count || 1),
    0
  )

  const handleUnreadItemClick = async (item: UserNotificationItem) => {
    if (!user) return

    // Chat alert -> do NOT open popup; open chat tab and delete from user's database
    if (isChatNotification(item.category)) {
      await clearChatNotifications(user.id)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
      navigate('/dashboard?tab=chat')
      return
    }

    // Call alert -> do NOT open popup; open call tab and delete from user's database
    if (isCallNotification(item.category)) {
      await clearCallNotification(user.id, item.id)
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
      navigate(item.category === 'video_call' ? '/dashboard?tab=video' : '/dashboard?tab=voice')
      return
    }

    // Standard unread alert -> open popup with Close, Unread, and Snooze buttons
    setSelectedItem(item)
    const defaultMins = item.snooze_minutes || 10
    if (defaultMins >= 60 && defaultMins % 60 === 0) {
      setSnoozeValue(defaultMins / 60)
      setSnoozeUnit('hours')
    } else {
      setSnoozeValue(defaultMins)
      setSnoozeUnit('minutes')
    }
  }

  // Button 1: Close -> moves notification to Read category
  const handlePopupCloseToRead = async () => {
    if (!selectedItem) return
    setActionBusy(true)
    await markNotificationRead(selectedItem.id)
    setSelectedItem(null)
    await loadAll()
    setActionBusy(false)
  }

  // Button 2: Unread -> keeps unread count & list unchanged
  const handlePopupKeepUnread = () => {
    setSelectedItem(null)
  }

  // Button 3: Snooze -> keeps unread count & list unchanged, alerts device after chosen duration (max 8 hrs)
  const handlePopupSnooze = async () => {
    if (!selectedItem) return
    const rawMinutes = snoozeUnit === 'hours' ? snoozeValue * 60 : snoozeValue
    const clampedMinutes = Math.min(480, Math.max(1, Math.round(rawMinutes || 10)))

    setActionBusy(true)
    await snoozeNotification(selectedItem.id, clampedMinutes)
    setSelectedItem(null)
    await loadAll()
    setActionBusy(false)

    const label =
      clampedMinutes >= 60
        ? `${(clampedMinutes / 60).toFixed(clampedMinutes % 60 === 0 ? 0 : 1)} hour(s)`
        : `${clampedMinutes} minute(s)`
    alert(`Notification snoozed for ${label}. It remains in your Unread list and will alert your device again when time is up.`)
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    setActionBusy(true)
    await markAllStandardNotificationsRead(user.id)
    await loadAll()
    setActionBusy(false)
  }

  const handleDeleteAllRead = async () => {
    if (!user) return
    if (!window.confirm('Delete all notifications from your Read list? You can restore them anytime using Recall History.')) {
      return
    }
    setActionBusy(true)
    await deleteAllReadNotifications(user.id)
    await loadAll()
    setActionBusy(false)
  }

  const handleRecallHistory = async () => {
    if (!user) return
    setActionBusy(true)
    await recallNotificationHistory(user.id)
    await loadAll()
    setActionBusy(false)
  }

  return (
    <div className="min-h-svh p-4 sm:p-6 relative">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="border-border/40 bg-card/80 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Bell className="h-5 w-5" />
                Notifications Center
              </CardTitle>

              {/* Read / Unread Tabs */}
              <div className="flex rounded-lg border border-border/50 bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('unread')}
                  className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'unread'
                      ? 'gold-gradient text-gold-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Unread
                  {totalUnreadBadgeCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                      {totalUnreadBadgeCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('read')}
                  className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeTab === 'read'
                      ? 'gold-gradient text-gold-foreground shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Read ({readList.length})
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* UNREAD TAB */}
            {activeTab === 'unread' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <p className="text-xs text-muted-foreground">
                    Tap any alert to view details, or tap Chat/Call alerts to jump straight in.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy || loading}
                      onClick={loadAll}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    {unreadList.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionBusy}
                        onClick={handleMarkAllRead}
                        className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all as read
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Loading unread notifications...</p>
                ) : unreadList.length === 0 ? (
                  <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">No unread notifications</p>
                    <p className="text-xs text-muted-foreground">You are all caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unreadList.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleUnreadItemClick(item)}
                        className="w-full text-left rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 p-3.5 transition-all flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getCategoryIcon(item.category)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">
                                {item.short_title}
                              </span>
                              {item.snoozed_until && new Date(item.snoozed_until) > new Date() && (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                  <Clock className="h-2.5 w-2.5" />
                                  Snoozed
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {new Date(item.created_at).toLocaleString('en-IN', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {isChatNotification(item.category)
                            ? 'Open Chat'
                            : isCallNotification(item.category)
                            ? 'Join Call'
                            : 'Open'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* READ TAB */}
            {activeTab === 'read' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 pb-3">
                  <p className="text-xs text-muted-foreground">
                    Archived notification history ({readList.length})
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy || loading}
                      onClick={loadAll}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionBusy}
                      onClick={handleRecallHistory}
                      className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <History className="h-3.5 w-3.5" />
                      Recall History
                    </Button>
                    {readList.length > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={actionBusy}
                        onClick={handleDeleteAllRead}
                        className="gap-1.5 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete All
                      </Button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <p className="py-8 text-center text-xs text-muted-foreground">Loading read history...</p>
                ) : readList.length === 0 ? (
                  <div className="rounded-xl border border-border/30 bg-muted/10 p-8 text-center space-y-2">
                    <p className="text-sm font-semibold text-foreground">No read notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Tap <span className="font-semibold text-primary">Recall History</span> above to restore archived notifications from the database.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {readList.map(item => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-border/30 bg-muted/15 p-3.5 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(item.category)}
                            <span className="text-xs font-bold text-primary">{item.short_title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed pl-6">
                          {item.full_message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* UNREAD NOTIFICATION DETAIL BOX (Close, Unread, Snooze) */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-primary/40 bg-card shadow-2xl">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                {getCategoryIcon(selectedItem.category)}
                <CardTitle className="text-base text-primary">{selectedItem.short_title}</CardTitle>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {new Date(selectedItem.created_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-3.5 text-sm text-foreground leading-relaxed">
                {selectedItem.full_message}
              </div>

              {/* Editable Snooze Duration (Default 10 mins, Maximum 8 hours) */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Clock className="h-3.5 w-3.5" />
                  Snooze Timer (Default: 10 mins • Max: 8 hours)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={snoozeUnit === 'hours' ? 8 : 480}
                    value={snoozeValue}
                    onChange={e => {
                      const val = Number(e.target.value)
                      const maxVal = snoozeUnit === 'hours' ? 8 : 480
                      setSnoozeValue(Math.min(maxVal, Math.max(1, val || 1)))
                    }}
                    className="w-24 bg-input/50 border-border/50 text-sm font-bold"
                  />
                  <select
                    value={snoozeUnit}
                    onChange={e => {
                      const nextUnit = e.target.value as 'minutes' | 'hours'
                      setSnoozeUnit(nextUnit)
                      if (nextUnit === 'hours' && snoozeValue > 8) {
                        setSnoozeValue(8)
                      }
                    }}
                    className="rounded-md border border-border/50 bg-background px-3 py-2 text-xs font-semibold"
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours (Max 8)</option>
                  </select>
                </div>
              </div>

              {/* Three Action Buttons: Close, Unread, Snooze */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={handlePopupCloseToRead}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={actionBusy}
                  onClick={handlePopupKeepUnread}
                  className="font-semibold gap-1 text-xs"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Unread
                </Button>

                <Button
                  type="button"
                  disabled={actionBusy}
                  onClick={handlePopupSnooze}
                  className="gold-gradient text-gold-foreground font-semibold gap-1 text-xs"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Snooze
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
