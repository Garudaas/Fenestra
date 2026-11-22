import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { sendDevicePushNotification } from '@/lib/notificationService'
import { getUserStorageUsage, formatBytes } from '@/lib/fenestriansCore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import { Phone, Headphones, Video, Camera, Upload, Image } from 'lucide-react'

export default function CallsTab() {
  const { user } = useAuth()
  const [voiceRoomName, setVoiceRoomName] = useState('Audio-Lounge')
  const [videoRoomName, setVideoRoomName] = useState('Main-Room')
  const [showCamera, setShowCamera] = useState(false)
  const [galleryPayload, setGalleryPayload] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .in('category', ['group_call', 'video_call'])
      .then(() => window.dispatchEvent(new Event('fenestrians-notifications-updated')))

    const handler = (e: any) => {
      if (e.detail?.roomName) setVideoRoomName(e.detail.roomName)
    }
    window.addEventListener('join-video', handler)
    return () => window.removeEventListener('join-video', handler)
  }, [user])

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
        {/* Voice Call Lounge */}
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
              title="Join Voice Call"
              className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <Phone className="h-4 w-4" />
              Join Voice Call
            </Button>
          </CardContent>
        </Card>

        {/* Video Chat */}
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
              title="Join Video Call"
              className="w-full gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <Video className="h-4 w-4" />
              Join Video Call
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Share Photo During Call */}
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
