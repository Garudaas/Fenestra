import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getUserStorageUsage, formatBytes } from '@/lib/fenestriansCore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import { Video, Camera, Upload, Image } from 'lucide-react'

export default function VideoTab() {
  const { user } = useAuth()
  const [roomName, setRoomName] = useState('Main-Room')
  const [showCamera, setShowCamera] = useState(false)
  const [galleryPayload, setGalleryPayload] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('category', 'video_call')
      .then(() => window.dispatchEvent(new Event('fenestrians-notifications-updated')))

    const handler = (e: any) => {
      if (e.detail?.roomName) setRoomName(e.detail.roomName)
    }
    window.addEventListener('join-video', handler)
    return () => window.removeEventListener('join-video', handler)
  }, [user])

  const joinVideoCall = async () => {
    if (!user) return

    // Clear caller's own video_call badge immediately
    await supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('category', 'video_call')
    window.dispatchEvent(new Event('fenestrians-notifications-updated'))

    // Notify DM peer or all active members
    const dmMatch = /^DM-(\d+)-(\d+)$/.exec(roomName.trim())
    if (dmMatch) {
      const idA = Number(dmMatch[1])
      const idB = Number(dmMatch[2])
      const targetId = idA === user.id ? idB : idA
      if (targetId && targetId !== user.id) {
        await supabase.from('user_notifications').insert([
          {
            user_id: targetId,
            archive_id: null,
            short_title: 'Video call',
            category: 'video_call',
            full_message: `${user.full_name} is calling you on video (${roomName}).`,
            status: 'unread',
            unread_count: 1,
          },
        ])
      }
    } else {
      const { data: members } = await supabase
        .from('alumni')
        .select('id')
        .eq('is_placeholder', false)
        .neq('id', user.id)
        .neq('full_name', 'System Administrator')

      if (members && members.length > 0) {
        await supabase.from('user_notifications').insert(
          members.map(m => ({
            user_id: m.id,
            archive_id: null,
            short_title: 'Video call',
            category: 'video_call',
            full_message: `${user.full_name} started a video call in ${roomName}.`,
            status: 'unread',
            unread_count: 1,
          }))
        )
      }
    }

    const roomUrl = `https://meet.jit.si/${roomName}-${user.id}`
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
    alert('Photo added to gallery!')
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
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Video className="h-5 w-5" />
            Video Chat
          </CardTitle>
          <CardDescription>
            Connect instantly with video and voice. Type a room name below or keep default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex max-w-md items-center gap-2">
            <Input
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder="Room Name"
              className="font-mono"
            />
            <Button
              onClick={joinVideoCall}
              title="Join Video Call"
              className="gold-gradient text-gold-foreground whitespace-nowrap"
            >
              <Video className="h-4 w-4 mr-2" />
              Join Video Call
            </Button>
          </div>
          <div className="space-y-2 border-t border-border/30 pt-4">
            <h3 className="text-primary font-bold flex items-center gap-2">
              <Image className="h-4 w-4" />
              Share Photo During Call
            </h3>
            <p className="text-xs text-muted-foreground">
              Share pictures or live photos to the gallery while on the call.
            </p>
            <div className="flex flex-wrap gap-2">
              <input type="file" accept="image/*" id="video-lounge-file" className="hidden" onChange={handleFileSelect} />
              <Button
                variant="outline"
                size="sm"
                title="Select Photo"
                onClick={() => document.getElementById('video-lounge-file')?.click()}
              >
                <Upload className="h-4 w-4 mr-1" />
                Select Photo
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Take Photo with Camera"
                onClick={() => setShowCamera(true)}
              >
                <Camera className="h-4 w-4 mr-1" />
                Take Photo
              </Button>
              <Button
                size="sm"
                title="Upload Photo to Gallery"
                onClick={handleGalleryUpload}
                disabled={!galleryPayload}
                className="gold-gradient text-gold-foreground"
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload to Gallery
              </Button>
            </div>
          </div>
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
