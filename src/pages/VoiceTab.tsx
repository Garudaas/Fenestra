import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone, Headphones } from 'lucide-react'

export default function VoiceTab() {
  const { user } = useAuth()
  const [roomName, setRoomName] = useState('Audio-Lounge')

  const joinVoiceCall = () => {
    if (!user) return
    const roomUrl = `https://meet.jit.si/${roomName}-${user.id}#config.startAudioOnly=true&config.startWithVideoMuted=true`
    window.open(roomUrl, '_blank')
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Headphones className="h-5 w-5" />
            Voice Call Lounge
          </CardTitle>
          <CardDescription>Join an audio-only secure call. Your camera is automatically disabled upon entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md items-center gap-2">
            <Input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Room Name" className="font-mono" />
            <Button onClick={joinVoiceCall} className="gold-gradient text-gold-foreground whitespace-nowrap">
              <Phone className="h-4 w-4 mr-2" />
              Join Voice Call
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
