import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
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
    const handler = (e: any) => { if (e.detail?.roomName) setRoomName(e.detail.roomName) }
    window.addEventListener('join-video', handler)
    return () => window.removeEventListener('join-video', handler)
  }, [])

  const joinVideoCall = () => {
    if (!user) return
    const roomUrl = `https://meet.jit.si/${roomName}-${user.id}`
    window.open(roomUrl, '_blank')
  }

  const handleGalleryUpload = async () => {
    if (!user || !galleryPayload) return
    await supabase.from('photo_gallery').insert([{ alumni_id: user.id, image_url: galleryPayload, description: `${user.full_name}: Photo from video chat` }])
    setGalleryPayload(''); alert('Photo added to gallery!')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { const data = await readFileAsDataURL(file); setGalleryPayload(data) }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Video className="h-5 w-5" />
            Video Chat
          </CardTitle>
          <CardDescription>Connect instantly with video and voice. Type a room name below or keep default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex max-w-md items-center gap-2">
            <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room Name" className="font-mono" />
            <Button onClick={joinVideoCall} className="gold-gradient text-gold-foreground whitespace-nowrap">
              <Video className="h-4 w-4 mr-2" />
              Join Video Call
            </Button>
          </div>
          <div className="space-y-2 border-t border-border/30 pt-4">
            <h3 className="text-primary font-bold flex items-center gap-2">
              <Image className="h-4 w-4" />
              Share Photo During Call
            </h3>
            <p className="text-xs text-muted-foreground">Share pictures or live photos to the gallery while on the call.</p>
            <div className="flex flex-wrap gap-2">
              <input type="file" accept="image/*" id="video-lounge-file" className="hidden" onChange={handleFileSelect} />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('video-lounge-file')?.click()}>
                <Upload className="h-4 w-4 mr-1" />
                Select Photo
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCamera(true)}>
                <Camera className="h-4 w-4 mr-1" />
                Take Photo
              </Button>
              <Button size="sm" onClick={handleGalleryUpload} disabled={!galleryPayload} className="gold-gradient text-gold-foreground">
                <Upload className="h-4 w-4 mr-1" />
                Upload to Gallery
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {showCamera && <CameraModal onCapture={data => { setGalleryPayload(data); setShowCamera(false) }} onClose={() => setShowCamera(false)} />}
    </div>
  )
}
