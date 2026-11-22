import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  recordIncomingChatNotification,
  clearChatNotifications,
  publishArchivedAlert,
} from '@/lib/notificationService'
import { getUserStorageUsage, formatBytes } from '@/lib/fenestriansCore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { getDmRoomId, playMentionTone, readFileAsDataURL, translateText } from '@/lib/helpers'
import { EMOJIS, STICKERS, REACTION_EMOJIS } from '@/lib/constants'
import CameraModal from '@/components/shared/CameraModal'
import {
  Send,
  Mic,
  Camera,
  Paperclip,
  Film,
  BarChart3,
  Smile,
  Globe,
  Copy,
  Reply,
  Forward,
  Pencil,
  Trash2,
  Hash,
  Lock,
  MessageCircle,
  MessageSquare,
  Plus,
  Megaphone,
} from 'lucide-react'

interface ChatMessage {
  id: number
  room_id: string
  sender_id: number
  sender_name: string
  message_text: string
  created_at: string
}

interface Reaction {
  id: number
  message_id: number
  room_id: string
  user_id: number
  emoji: string
}

type PostAlertTag = 'normal' | 'member_message' | 'important_member_message' | 'instruction'

export default function ChatTab() {
  const { user, isAdmin } = useAuth()
  const [activeRoomId, setActiveRoomId] = useState('global')
  const [activeRoomTitle, setActiveRoomTitle] = useState('General Chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({})
  const [inputText, setInputText] = useState('')
  const [postTag, setPostTag] = useState<PostAlertTag>('normal')
  const [rooms, setRooms] = useState<any[]>([])
  const [dmUsers, setDmUsers] = useState<any[]>([])
  const [replyContext, setReplyContext] = useState<{ id: number; sender: string; text: string } | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showVideoRecord, setShowVideoRecord] = useState(false)
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionStartIdx, setMentionStartIdx] = useState(-1)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const subscriptionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeRoomRef = useRef(activeRoomId)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    if (!user) return

    clearChatNotifications(user.id).then(() => {
      window.dispatchEvent(new Event('fenestrians-notifications-updated'))
    })

    loadSidebar()
    setupRealtimeSubscription()

    const handler = (e: any) => {
      if (e.detail?.id && e.detail?.name) {
        const dmId = getDmRoomId(user.id, e.detail.id)
        switchRoom(dmId, `${e.detail.name}`)
      }
    }
    window.addEventListener('open-dm', handler)
    return () => {
      window.removeEventListener('open-dm', handler)
      if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current)
    }
  }, [user])

  useEffect(() => {
    loadMessages()
    if (user) {
      clearChatNotifications(user.id).then(() => {
        window.dispatchEvent(new Event('fenestrians-notifications-updated'))
      })
    }
  }, [activeRoomId, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const setupRealtimeSubscription = () => {
    if (subscriptionRef.current) supabase.removeChannel(subscriptionRef.current)

    subscriptionRef.current = supabase
      .channel('realtime-chat-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
        if (payload.eventType === 'INSERT' && payload.new.room_id === activeRoomRef.current) {
          const msg = payload.new as ChatMessage
          setMessages(prev => [...prev, msg])
          checkMention(msg)
          if (user) {
            clearChatNotifications(user.id).then(() => {
              window.dispatchEvent(new Event('fenestrians-notifications-updated'))
            })
          }
        } else if (payload.eventType === 'UPDATE' && payload.new.room_id === activeRoomRef.current) {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? (payload.new as ChatMessage) : m)))
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, payload => {
        if (payload.eventType === 'INSERT') {
          const r = payload.new as Reaction
          setReactions(prev => ({ ...prev, [r.message_id]: [...(prev[r.message_id] || []), r] }))
        } else if (payload.eventType === 'DELETE') {
          const old = payload.old as Reaction
