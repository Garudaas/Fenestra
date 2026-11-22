import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { sendDevicePushNotification } from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Phone, Headphones } from 'lucide-react'

export default function VoiceTab() {
  const { user } = useAuth()
  const [roomName, setRoomName] = useState('Audio-Lounge')

  useEffect(() => {
    if (!user) return
    supabase
      .from('user_notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('category', 'group_call')
      .then(() => window.dispatchEvent(new Event('fenestrians-notifications-updated')))
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
      const msg = `${user.full_name} started a group voice call in ${roomName}.`
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
        launchUrl: 'https://fenestrians.salmaali.in/dashboard?tab=voice',
      })
    }

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
          <CardDescription>
            Join an audio-only secure call. Your camera is automatically disabled upon entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-md items-center gap-2">
            <Input
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder="Room Name"
              className="font-mono"
            />
            <Button
              onClick={joinVoiceCall}
              title="Join Voice Call"
              className="gold-gradient text-gold-foreground whitespace-nowrap"
            >
              <Phone className="h-4 w-4 mr-2" />
              Join Voice Call
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
