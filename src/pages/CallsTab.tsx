import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { sendDevicePushNotification, publishArchivedAlert } from '@/lib/notificationService'
import { getUserStorageUsage, formatBytes } from '@/lib/fenestriansCore'
import { formatISTDateTime } from '@/lib/formatters'
import SmartDateInput from '@/components/shared/SmartDateInput'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import {
  Phone,
  Headphones,
  Video,
  Camera,
  Upload,
  Image,
  CalendarClock,
  Plus,
  Users,
  Radio,
  Trash2,
} from 'lucide-react'

interface ScheduledCallItem {
  id: number
  title: string
  call_type: 'voice' | 'video'
  room_name: string
  scheduled_at: string
  host_id: number | null
  host_name: string
  is_live: boolean
}

interface AttendanceRecord {
  id: number
  call_id: number
  member_name: string
  joined_at: string
}

type AttendanceByCallMap = Record<number, AttendanceRecord[]>

export default function CallsTab() {
  const { user, isAdmin } = useAuth()
  const [voiceRoomName, setVoiceRoomName] = useState('Audio-Lounge')
  const [videoRoomName, setVideoRoomName] = useState('Main-Room')
  const [showCamera, setShowCamera] = useState(false)
  const [galleryPayload, setGalleryPayload] = useState('')

  // Scheduled Call Lobbies & Attendance
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCallItem[]>([])
  const [attendanceMap, setAttendanceMap] = useState<AttendanceByCallMap>({})
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [schedTitle, setSchedTitle] = useState('')
  const [schedType, setSchedType] = useState<'voice' | 'video'>('video')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('20:00')
  const [savingSchedule, setSavingSchedule] = useState(false)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .in('category', ['group_call', 'video_call'])
      .then(() => window.dispatchEvent(new Event('fenestrians-notifications-updated')))

    loadScheduledCalls()

    const channel = supabase
      .channel('scheduled-calls-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_calls' }, () => {
        loadScheduledCalls()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_attendance' }, () => {
        loadScheduledCalls()
      })
      .subscribe()

    const handler = (e: any) => {
      if (e.detail?.roomName) setVideoRoomName(e.detail.roomName)
    }
    window.addEventListener('join-video', handler)
    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('join-video', handler)
    }
  }, [user])

  const loadScheduledCalls = async () => {
    const [callsRes, attRes] = await Promise.all([
      supabase.from('scheduled_calls').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('call_attendance').select('*').order('joined_at', { ascending: true }),
    ])

    setScheduledCalls((callsRes.data ?? []) as ScheduledCallItem[])
    const map: AttendanceByCallMap = {}
    for (const row of (attRes.data ?? []) as AttendanceRecord[]) {
      if (!map[row.call_id]) map[row.call_id] = []
      map[row.call_id].push(row)
    }
    setAttendanceMap(map)
  }

  const handleScheduleCall = async () => {
    if (!user) return
    if (!schedTitle.trim() || !schedDate) {
      alert('Please enter a Call Title and Date.')
      return
    }

    setSavingSchedule(true)
    const scheduledIso = `${schedDate}T${schedTime || '20:00'}:00+05:30`
    const roomSlug = `Fenestrians-${schedTitle
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .slice(0, 24)}-${Date.now().toString().slice(-4)}`

    const { error } = await supabase.from('scheduled_calls').insert([
      {
        title: schedTitle.trim(),
        call_type: schedType,
        room_name: roomSlug,
        scheduled_at: scheduledIso,
        host_id: user.id,
        host_name: user.full_name,
        is_live: false,
      },
    ])

    if (!error) {
      await publishArchivedAlert({
        category: 'event',
        shortTitle: `Scheduled ${schedType === 'voice' ? 'Voice' : 'Video'} Call`,
        fullMessage: `${user.full_name} scheduled "${schedTitle.trim()}" for ${formatISTDateTime(
          scheduledIso
        )}. Join from the Calls tab!`,
      })
    }

    setSavingSchedule(false)
    if (error) {
      alert('Could not schedule call: ' + error.message)
      return
    }

    setSchedTitle('')
    setSchedDate('')
    setShowScheduleForm(false)
    await loadScheduledCalls()
  }

  const handleJoinScheduledCall = async (call: ScheduledCallItem) => {
    if (!user) return

    await Promise.all([
      supabase.from('scheduled_calls').update({ is_live: true }).eq('id', call.id),
      supabase.from('call_attendance').insert([
        {
          call_id: call.id,
          room_name: call.room_name,
          user_id: user.id,
          member_name: user.full_name,
        },
      ]),
    ])

    await loadScheduledCalls()

    const roomUrl =
      call.call_type === 'voice'
        ? `https://meet.jit.si/${call.room_name}#config.startAudioOnly=true&config.startWithVideoMuted=true`
        : `https://meet.jit.si/${call.room_name}`
    window.open(roomUrl, '_blank')
  }

  const handleEndOrDeleteScheduledCall = async (call: ScheduledCallItem) => {
    if (!window.confirm(`Remove scheduled call "${call.title}"?`)) return
    await supabase.from('scheduled_calls').delete().eq('id', call.id)
    await loadScheduledCalls()
  }

  const joinVoiceCall = async () => {
    if (!user) return

    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('category', 'group_call')
    window.dispatchEvent(new Event('fenestrians-notifications-updated'))

    const { data: members } = await supabase
      .from('alumni')
      .select('id')
      .eq('is_placeholder', false)
      .neq('id', user.id)
      .neq('full_name', 'System Administrator')

    if (members && members.length > 0) {
      const msg = `${user.full_name} started a group voice call in ${voiceRoomName}.`
      await supabase.from('user_notifications').insert(
        members.map(m => ({
          user_id: m.id,
          archive_id: null,
          short_title: 'Group call',
          category: 'group_call',
          full_message: msg,
          status: 'unread',
          unread_count: 1,
        }))
      )
      sendDevicePushNotification({
        shortTitle: 'Group call',
        fullMessage: msg,
        targetUserIds: members.map(m => m.id),
        launchUrl: 'https://fenestrians.salmaali.in/dashboard?tab=calls',
      })
    }

    const roomUrl = `https://meet.jit.si/${voiceRoomName}-${user.id}#config.startAudioOnly=true&config.startWithVideoMuted=true`
    window.open(roomUrl, '_blank')
  }

  const joinVideoCall = async () => {
    if (!user) return

    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('category', 'video_call')
    window.dispatchEvent(new Event('fenestrians-notifications-updated'))

    const dmMatch = /^DM-(\d+)-(\d+)$/.exec(videoRoomName.trim())
    if (dmMatch) {
      const idA = Number(dmMatch[1])
      const idB = Number(dmMatch[2])
      const targetId = idA === user.id ? idB : idA
      if (targetId && targetId !== user.id) {
        const msg = `${user.full_name} is calling you on video (${videoRoomName}).`
        await supabase.from('user_notifications').insert([
          {
            user_id: targetId,
            archive_id: null,
            short_title: 'Video call',
            category: 'video_call',
            full_message: msg,
            status: 'unread',
            unread_count: 1,
          },
        ])
        sendDevicePushNotification({
          shortTitle: 'Incoming Video Call',
          fullMessage: msg,
          targetUserIds: [targetId],
          launchUrl: 'https://fenestrians.salmaali.in/dashboard?tab=calls',
        })
      }
    } else {
      const { data: members } = await supabase
        .from('alumni')
        .select('id')
        .eq('is_placeholder', false)
        .neq('id', user.id)
        .neq('full_name', 'System Administrator')

      if (members && members.length > 0) {
        const msg = `${user.full_name} started a video call in ${videoRoomName}.`
        await supabase.from('user_notifications').insert(
          members.map(m => ({
            user_id: m.id,
            archive_id: null,
            short_title: 'Video call',
            category: 'video_call',
            full_message: msg,
            status: 'unread',
            unread_count: 1,
          }))
        )
        sendDevicePushNotification({
          shortTitle: 'Video call',
          fullMessage: msg,
          targetUserIds: members.map(m => m.id),
          launchUrl: 'https://fenestrians.salmaali.in/dashboard?tab=calls',
        })
      }
    }

    const roomUrl = `https://meet.jit.si/${videoRoomName}-${user.id}`
    window.open(roomUrl, '_blank')
  }

  const handleGalleryUpload = async () => {
    if (!user || !galleryPayload) return

    const approxBytes = Math.round(galleryPayload.length * 0.75)
    const { usedBytes, quotaBytes, quotaMb } = await getUserStorageUsage(user.id)

    if (usedBytes + approxBytes > quotaBytes) {
      alert(
        `Storage space exceeded (${formatBytes(usedBytes)} used of ${quotaMb} MB limit). Further media/file sharing is not allowed.`
      )
      return
    }

    await supabase.from('member_media_files').insert([
      {
        owner_id: user.id,
        owner_name: user.full_name,
        folder_category: 'gallery',
        file_name: `Video_Call_Photo_${new Date().toISOString().slice(0, 10)}.jpg`,
        file_url: galleryPayload,
        storage_path: `video_call_${user.id}_${Date.now()}`,
        mime_type: 'image/jpeg',
        file_size_bytes: approxBytes,
        is_private: false,
        is_profile_picture: false,
      },
    ])

    await supabase
      .from('photo_gallery')
      .insert([{ alumni_id: user.id, image_url: galleryPayload, description: `${user.full_name}: Photo from video chat` }])
    setGalleryPayload('')
    alert('Photo added to your gallery folder!')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const data = await readFileAsDataURL(file)
      setGalleryPayload(data)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Headphones className="h-5 w-5" />
              Voice Call Lounge
            </CardTitle>
            <CardDescription>
              Join an audio-only secure call with your camera disabled upon entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={voiceRoomName}
              onChange={e => setVoiceRoomName(e.target.value)}
              placeholder="Voice Room Name"
              className="font-mono text-xs"
            />
            <Button
              onClick={joinVoiceCall}
              className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <Phone className="h-4 w-4" />
              Join Voice Call
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Video className="h-5 w-5" />
              Video Chat
            </CardTitle>
            <CardDescription>
              Connect instantly with live video and voice. Enter a room name or keep default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={videoRoomName}
              onChange={e => setVideoRoomName(e.target.value)}
              placeholder="Video Room Name"
              className="font-mono text-xs"
            />
            <Button
              onClick={joinVideoCall}
              className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <Video className="h-4 w-4" />
              Join Video Call
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* SCHEDULED CALL LOBBIES & LIVE ATTENDANCE LOG */}
      <Card className="border-primary/35 bg-card/75 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <CalendarClock className="h-5 w-5" />
              Scheduled Call Lobbies &amp; Attendance Log ({scheduledCalls.length})
            </CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowScheduleForm(prev => !prev)}
              className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {showScheduleForm ? 'Close Form' : 'Schedule Call Lobby'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showScheduleForm && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold">Call Title *</label>
                  <Input
                    value={schedTitle}
                    onChange={e => setSchedTitle(e.target.value)}
                    placeholder="e.g., Monthly Batch Catch-up / ExCom Sync"
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold">Call Type</label>
                  <select
                    value={schedType}
                    onChange={e => setSchedType(e.target.value as 'voice' | 'video')}
                    className="mt-1 w-full h-9 rounded-md border border-border/50 bg-background px-3 text-xs"
                  >
                    <option value="video">Video Call Lobby</option>
                    <option value="voice">Voice-Only Call Lobby</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold">Date (DD/MM/YYYY) *</label>
                  <SmartDateInput value={schedDate} onChange={setSchedDate} className="mt-1" />
                </div>
                <div>
                  <label className="font-semibold">Time (IST)</label>
                  <Input
                    type="time"
                    value={schedTime}
                    onChange={e => setSchedTime(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={savingSchedule}
                onClick={handleScheduleCall}
                className="gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {savingSchedule ? 'Scheduling...' : 'Create & Notify Members'}
              </Button>
            </div>
          )}

          {scheduledCalls.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No scheduled call lobbies yet. Create one above to track live status and attendance.
            </p>
          ) : (
            <div className="space-y-2.5">
              {scheduledCalls.map(call => {
                const attendees = attendanceMap[call.id] ?? []
                const uniqueNames = Array.from(new Set(attendees.map(a => a.member_name)))
                const canDelete = call.host_id === user?.id || userIsAdmin

                return (
                  <div
                    key={call.id}
                    className="rounded-xl border border-border/40 bg-muted/15 p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-foreground">{call.title}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {call.call_type}
                          </Badge>
                          {call.is_live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300 animate-pulse">
                              <Radio className="h-3 w-3" />
                              IN CALL NOW
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Scheduled: <strong className="text-primary">{formatISTDateTime(call.scheduled_at)}</strong> • Host:{' '}
                          {call.host_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleJoinScheduledCall(call)}
                          className="h-8 gold-gradient text-gold-foreground font-semibold gap-1 text-xs"
                        >
                          {call.call_type === 'voice' ? (
                            <Phone className="h-3.5 w-3.5" />
                          ) : (
                            <Video className="h-3.5 w-3.5" />
                          )}
                          Join Lobby
                        </Button>
                        {canDelete && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEndOrDeleteScheduledCall(call)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground border-t border-border/25 pt-2">
                      <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        Attendance Log ({uniqueNames.length}):{' '}
                        <strong className="text-foreground">
                          {uniqueNames.length > 0 ? uniqueNames.join(', ') : 'No participants yet'}
                        </strong>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-primary flex items-center gap-2">
            <Image className="h-4 w-4" />
            Share Photo During Call
          </CardTitle>
          <CardDescription className="text-xs">
            Capture or upload pictures directly to your gallery folder while on a call.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <input type="file" accept="image/*" id="video-lounge-file" className="hidden" onChange={handleFileSelect} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('video-lounge-file')?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Select Photo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCamera(true)}
          >
            <Camera className="h-4 w-4 mr-1" />
            Take Photo
          </Button>
          <Button
            size="sm"
            onClick={handleGalleryUpload}
            disabled={!galleryPayload}
            className="gold-gradient text-gold-foreground"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload to Gallery
          </Button>
        </CardContent>
      </Card>

      {showCamera && (
        <CameraModal
          onCapture={data => {
            setGalleryPayload(data)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
