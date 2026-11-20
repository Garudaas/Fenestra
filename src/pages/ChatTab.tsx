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

export default function ChatTab() {
  const { user } = useAuth()
  const [activeRoomId, setActiveRoomId] = useState('global')
  const [activeRoomTitle, setActiveRoomTitle] = useState('General Chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Record<number, Reaction[]>>({})
  const [inputText, setInputText] = useState('')
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

  useEffect(() => {
    activeRoomRef.current = activeRoomId
  }, [activeRoomId])

  useEffect(() => {
    if (!user) return

    // Reset unread chat count immediately when user opens the chat window
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
          setReactions(prev => {
            const updated = { ...prev }
            for (const msgId in updated) {
              const idx = updated[msgId].findIndex(x => x.id === old.id)
              if (idx > -1) {
                updated[msgId] = updated[msgId].filter(x => x.id !== old.id)
                break
              }
            }
            return updated
          })
        }
      })
      .subscribe()
  }

  const checkMention = (msg: ChatMessage) => {
    if (!user || msg.sender_id === user.id) return
    const names = [user.full_name]
    if (user.class_nickname) names.push(user.class_nickname)
    const pattern = new RegExp(
      `@(${names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![a-zA-Z0-9_])`,
      'gi'
    )
    if (pattern.test(msg.message_text)) playMentionTone()
  }

  const loadSidebar = async () => {
    if (!user) return
    const [usersRes, groupsRes] = await Promise.all([
      supabase.from('alumni').select('*').eq('is_placeholder', false).neq('full_name', 'System Administrator'),
      supabase.from('chat_rooms').select('*'),
    ])

    if (groupsRes.data) {
      const filtered = groupsRes.data.filter(g => {
        const access = g.allowed_members ? g.allowed_members.split(',') : []
        return !g.is_private || g.created_by == user.id || access.includes(String(user.id))
      })
      setRooms(filtered)
    }

    if (usersRes.data) {
      setDmUsers(usersRes.data.filter(u => u.id !== user.id))
    }
  }

  const loadMessages = async () => {
    const [msgRes, rxRes] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('room_id', activeRoomId).order('created_at', { ascending: true }),
      supabase.from('chat_reactions').select('*').eq('room_id', activeRoomId),
    ])
    if (msgRes.data) setMessages(msgRes.data)
    if (rxRes.data) {
      const map: Record<number, Reaction[]> = {}
      rxRes.data.forEach(r => {
        if (!map[r.message_id]) map[r.message_id] = []
        map[r.message_id].push(r)
      })
      setReactions(map)
    }
  }

  const switchRoom = (roomId: string, title: string) => {
    setActiveRoomId(roomId)
    setActiveRoomTitle(title)
    setReplyContext(null)
    setShowEmoji(false)
    setReactionPickerMsgId(null)
  }

  const sendMessage = async (text: string) => {
    if (!user || !text) return
    await supabase.from('chat_messages').insert([
      {
        room_id: activeRoomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: text,
      },
    ])

    const previewText = text.startsWith('data:image/')
      ? 'Sent an image'
      : text.startsWith('data:audio/')
      ? 'Sent a voice message'
      : text.startsWith('data:video/')
      ? 'Sent a video message'
      : text.slice(0, 80)

    // Determine chat type & recipients for aggregated unread chat counter
    let chatType: 'common_chat' | 'private_chat' | 'group_chat' = 'common_chat'
    let recipientIds: number[] = []

    const matchedGroup = rooms.find(r => String(r.id) === String(activeRoomId))
    if (activeRoomId === 'global') {
      chatType = 'common_chat'
      recipientIds = dmUsers.map(u => u.id)
    } else if (matchedGroup) {
      chatType = 'group_chat'
      const access = matchedGroup.allowed_members
        ? String(matchedGroup.allowed_members)
            .split(',')
            .map((s: string) => s.trim())
        : []
      recipientIds = dmUsers
        .filter(
          u =>
            !matchedGroup.is_private ||
            String(matchedGroup.created_by) === String(u.id) ||
            access.includes(String(u.id))
        )
        .map(u => u.id)
    } else {
      chatType = 'private_chat'
      const dmTarget = dmUsers.find(u => getDmRoomId(user.id, u.id) === activeRoomId)
      if (dmTarget) {
        recipientIds = [dmTarget.id]
      }
    }

    await Promise.all(
      recipientIds.map(recipientUserId =>
        recordIncomingChatNotification({
          recipientUserId,
          chatType,
          senderName: user.full_name,
          previewText,
        })
      )
    )

    // Auto-alert as "Your friend Needs help" if message contains the word "help"
    if (!text.startsWith('data:') && /\bhelp\b/i.test(text)) {
      await publishArchivedAlert({
        category: 'help_needed',
        shortTitle: 'Your friend Needs help',
        fullMessage: `${user.full_name} sent a message mentioning help in ${activeRoomTitle}: "${text}"`,
        needsHelpFlag: true,
      })
    }
  }

  const handleSend = async () => {
    if (!inputText.trim()) return
    let msg = inputText.trim()
    if (replyContext) {
      msg = `> ${replyContext.text}\n\n` + msg
    }
    setShowEmoji(false)
    await sendMessage(msg)
    setInputText('')
    setReplyContext(null)
  }

  const handleImageSend = async (base64: string) => {
    if (!user) return
    const approxBytes = Math.round(base64.length * 0.75)
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
        file_name: `Chat_Photo_${new Date().toISOString().slice(0, 10)}.jpg`,
        file_url: base64,
        storage_path: `chat_img_${user.id}_${Date.now()}`,
        mime_type: 'image/jpeg',
        file_size_bytes: approxBytes,
        is_private: false,
        is_profile_picture: false,
      },
    ])

    await supabase
      .from('photo_gallery')
      .insert([{ alumni_id: user.id, image_url: base64, description: `${user.full_name}: Sent a photo in chat` }])
    await sendMessage(base64)
  }

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const data = await readFileAsDataURL(file)
      await handleImageSend(data)
    }
    e.target.value = ''
  }

  const toggleVoiceRecord = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      setIsRecording(false)
      return
    }

    try {
      audioChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const reader = new FileReader()
          reader.onloadend = () => sendMessage(reader.result as string)
          reader.readAsDataURL(blob)
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err: any) {
      alert('Microphone access required: ' + err.message)
    }
  }

  const toggleReaction = async (msgId: number, emoji: string) => {
    if (!user) return
    const existing = (reactions[msgId] || []).find(r => r.user_id === user.id && r.emoji === emoji)
    if (existing) {
      await supabase.from('chat_reactions').delete().eq('id', existing.id)
    } else {
      await supabase
        .from('chat_reactions')
        .insert([{ message_id: msgId, room_id: activeRoomId, user_id: user.id, emoji }])
    }
    setReactionPickerMsgId(null)
  }

  const handleTranslate = async (msgId: number) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg || msg.message_text.startsWith('data:') || msg.message_text.startsWith('http')) {
      alert('Cannot translate media items.')
      return
    }
    const targetLang = localStorage.getItem('pref_lang') || 'en'
    try {
      const translated = await translateText(msg.message_text, targetLang)
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId ? { ...m, message_text: m.message_text + `\n\n[Translation: ${translated}]` } : m
        )
      )
    } catch {
      alert('Translation failed.')
    }
  }

  const handleEdit = async (msgId: number) => {
    const msg = messages.find(m => m.id === msgId)
    if (!msg) return
    const newText = prompt('Edit your message:', msg.message_text)
    if (newText !== null && newText.trim() !== '' && newText !== msg.message_text) {
      await supabase.from('chat_messages').update({ message_text: newText.trim() }).eq('id', msgId)
    }
  }

  const handleDelete = async (msgId: number) => {
    if (confirm('Are you sure you want to delete this message for everyone?')) {
      await supabase.from('chat_messages').delete().eq('id', msgId)
    }
  }

  const handlePollCreate = async () => {
    const question = prompt('Enter Poll Question:')
    if (!question) return
    const options = prompt('Enter comma-separated options:\nExample: Yes, No, Maybe')
    if (!options) return
    await sendMessage(`📊 POLL:${question}|${options}`)
  }

  const handlePollVote = async (messageId: number, optionIndex: number) => {
    if (!user) return
    await supabase.from('poll_votes').delete().eq('message_id', messageId).eq('user_id', user.id)
    await supabase.from('poll_votes').insert([{ message_id: messageId, user_id: user.id, option_index: optionIndex }])
  }

  const handleRsvp = async (eventTitle: string, status: string) => {
    if (!user) return
    const { data: ev } = await supabase.from('calendar_events').select('id').eq('title', eventTitle).maybeSingle()
    if (ev) {
      await supabase.from('event_rsvps').delete().eq('event_id', ev.id).eq('alumni_id', user.id)
      await supabase.from('event_rsvps').insert([{ event_id: ev.id, alumni_id: user.id, status }])
      alert(`RSVP saved: ${status}`)
    }
  }

  const handleGroupCreate = async () => {
    const name = prompt('Enter group name:')
    if (!name || !user) return
    const membersCSV = prompt('Enter member IDs (comma-separated) who can access this group:')
    await supabase
      .from('chat_rooms')
      .insert([{ name, is_private: true, created_by: user.id, allowed_members: membersCSV || '' }])
    loadSidebar()
  }

  const openVideoRecordModal = () => setShowVideoRecord(true)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputText(val)
    const cursorPos = e.target.selectionStart || val.length
    const textUpToCursor = val.slice(0, cursorPos)
    const lastAt = textUpToCursor.lastIndexOf('@')
    if (lastAt !== -1) {
      const charBefore = lastAt > 0 ? textUpToCursor[lastAt - 1] : ' '
      if (charBefore === ' ' || charBefore === '\n' || lastAt === 0) {
        const query = textUpToCursor.slice(lastAt + 1)
        if (!/\s/.test(query)) {
          setMentionQuery(query.toLowerCase())
          setMentionStartIdx(lastAt)
          return
        }
      }
    }
    setMentionQuery(null)
    setMentionStartIdx(-1)
  }

  const insertMention = (name: string) => {
    const before = inputText.slice(0, mentionStartIdx)
    const after = inputText.slice(mentionStartIdx + (mentionQuery?.length || 0) + 1)
    setInputText(`${before}@${name} ${after}`)
    setMentionQuery(null)
    setMentionStartIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleNameClick = (senderName: string) => {
    setInputText(prev => prev + `@${senderName} `)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const filteredMentionUsers =
    mentionQuery !== null
      ? dmUsers.filter(
          u =>
            u.full_name.toLowerCase().includes(mentionQuery) ||
            (u.class_nickname && u.class_nickname.toLowerCase().includes(mentionQuery))
        )
      : []

  if (!user) return null

  return (
    <div className="mx-auto grid h-[550px] max-w-5xl gap-4 text-xs md:grid-cols-4">
      <Card className="flex flex-col overflow-y-auto border-border/40 bg-card/60 backdrop-blur-sm p-3">
        <div className="mb-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/60">
            <Hash className="h-3 w-3" />
            Channels
          </h2>
          <Button
            variant="ghost"
            size="sm"
            title="Open General Chat"
            className={`w-full justify-start text-xs ${activeRoomId === 'global' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-primary/5'}`}
            onClick={() => switchRoom('global', 'General Chat')}
          >
            General Chat
          </Button>
        </div>

        <div className="mb-3 border-t border-border/30 pt-2">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/60">
              <Lock className="h-3 w-3" />
              Private Groups
            </h2>
            <Button
              variant="link"
              size="sm"
              title="Create Private Group"
              className="h-4 p-0 text-[10px] text-primary"
              onClick={handleGroupCreate}
            >
              <Plus className="mr-0.5 h-3 w-3" />
              New
            </Button>
          </div>
          {rooms.map(g => (
            <Button
              key={g.id}
              variant="ghost"
              size="sm"
              title={`Open ${g.name}`}
              className={`w-full justify-start truncate text-xs ${activeRoomId === g.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-primary/5'}`}
              onClick={() => switchRoom(g.id, g.name)}
            >
              {g.name}
            </Button>
          ))}
        </div>

        <div className="min-h-0 flex-1 border-t border-border/30 pt-2">
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary/60">
            <MessageCircle className="h-3 w-3" />
            Direct Messages
          </h2>
          <div className="space-y-0.5 overflow-y-auto">
            {dmUsers.map(u => (
              <Button
                key={u.id}
                variant="ghost"
                size="sm"
                title={`Chat with ${u.full_name}`}
                className="w-full justify-start truncate text-xs text-muted-foreground hover:bg-primary/5 hover:text-primary"
                onClick={() => switchRoom(getDmRoomId(user.id, u.id), u.full_name)}
              >
                {u.full_name}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex flex-col overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm md:col-span-3">
        <header className="flex items-center justify-between border-b border-border/30 bg-muted/30 backdrop-blur-sm px-3 py-2">
          <span className="font-bold text-primary">{activeRoomTitle}</span>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
            Live
          </span>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 && (
            <p className="text-center italic text-muted-foreground">No messages here yet. Break the ice!</p>
          )}
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMe={msg.sender_id === user.id}
              reactions={reactions[msg.id] || []}
              userId={user.id}
              onReact={(emoji: string) => toggleReaction(msg.id, emoji)}
              onTranslate={() => handleTranslate(msg.id)}
              onCopy={() => navigator.clipboard.writeText(msg.message_text)}
              onReply={() =>
                setReplyContext({
                  id: msg.id,
                  sender: msg.sender_name,
                  text: msg.message_text.length > 40 ? msg.message_text.substring(0, 40) + '...' : msg.message_text,
                })
              }
              onForward={() => setInputText(`> Forwarded from ${msg.sender_name}:\n> ${msg.message_text}\n`)}
              onEdit={() => handleEdit(msg.id)}
              onDelete={() => handleDelete(msg.id)}
              onMention={() => handleNameClick(msg.sender_name)}
              onDM={() => switchRoom(getDmRoomId(user.id, msg.sender_id), msg.sender_name)}
              reactionPickerOpen={reactionPickerMsgId === msg.id}
              onOpenReactionPicker={() => setReactionPickerMsgId(msg.id === reactionPickerMsgId ? null : msg.id)}
              onPollVote={(idx: number) => handlePollVote(msg.id, idx)}
              onRsvp={handleRsvp}
              currentUserName={user.full_name}
              currentUserNickname={user.class_nickname}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {replyContext && (
          <div className="flex items-center justify-between border-t border-border/30 bg-muted/30 backdrop-blur-sm px-3 py-1.5 text-[10px] text-muted-foreground">
            <span className="truncate border-l-2 border-primary/50 pl-2 italic">
              Replying to {replyContext.sender}: {replyContext.text}
            </span>
            <Button variant="ghost" size="sm" className="h-5 text-destructive" onClick={() => setReplyContext(null)}>
              x
            </Button>
          </div>
        )}

        <div className="space-y-2 border-t border-border/30 p-3">
          <div className="flex items-center gap-1">
            <input type="file" accept="image/*" id="chat-file-input" className="hidden" onChange={handleFileAttach} />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-border/40 hover:border-primary/30 hover:shadow-primary/5"
              onClick={() => document.getElementById('chat-file-input')?.click()}
              title="Attach Image"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-border/40 hover:border-primary/30 hover:shadow-primary/5"
              onClick={() => setShowCamera(true)}
              title="Send Photo"
            >
              <Camera className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-border/40 hover:border-primary/30 hover:shadow-primary/5"
              onClick={openVideoRecordModal}
              title="Record Video"
            >
              <Film className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 border-border/40 hover:border-primary/30 hover:shadow-primary/5"
              onClick={handlePollCreate}
              title="Create Poll"
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative flex items-center gap-2">
            {showEmoji && (
              <div className="absolute -top-56 left-0 z-50 flex max-h-56 w-72 flex-col gap-2 overflow-y-auto rounded-xl border border-border/30 bg-popover/95 backdrop-blur-xl p-3 shadow-xl shadow-primary/5">
                <div className="border-b border-border/30 pb-1 text-[10px] text-muted-foreground">Emojis</div>
                <div className="flex flex-wrap gap-2 text-xl">
                  {EMOJIS.map(e => (
                    <span
                      key={e}
                      className="cursor-pointer transition hover:scale-125"
                      onClick={() => {
                        setInputText(prev => prev + e)
                      }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
                <div className="mt-2 border-b border-border/30 pb-1 text-[10px] text-muted-foreground">Stickers</div>
                <div className="grid grid-cols-4 gap-2">
                  {STICKERS.map(s => (
                    <img
                      key={s}
                      src={s}
                      className="h-12 w-full cursor-pointer rounded object-cover hover:opacity-80"
                      onClick={() => {
                        sendMessage(s)
                        setShowEmoji(false)
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              title="Emojis & Stickers"
              className="h-9 px-2 border-border/40 hover:border-primary/30"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Smile className="h-4 w-4" />
            </Button>
            <div className="relative flex-1">
              {mentionQuery !== null && filteredMentionUsers.length > 0 && (
                <div className="absolute bottom-full left-0 z-50 mb-2 max-h-40 w-full overflow-y-auto rounded-xl border border-border/30 bg-popover/95 backdrop-blur-xl shadow-xl shadow-primary/5">
                  {filteredMentionUsers.map(u => (
                    <button
                      key={u.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/10"
                      onMouseDown={e => {
                        e.preventDefault()
                        insertMention(u.full_name)
                      }}
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                        {u.full_name?.[0]}
                      </div>
                      <span className="font-medium text-foreground">{u.full_name}</span>
                      {u.class_nickname && <span className="text-muted-foreground">({u.class_nickname})</span>}
                    </button>
                  ))}
                </div>
              )}
              <Input
                ref={inputRef}
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={e => {
                  if (e.key === 'Enter' && mentionQuery === null) handleSend()
                }}
                placeholder="Type @ to mention, or type in En/Ta/Ml..."
                className="w-full text-xs border-border/40 focus:border-primary/30"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`h-9 px-2 ${isRecording ? 'animate-pulse bg-destructive text-destructive-foreground' : 'border-border/40 hover:border-primary/30'}`}
              onClick={toggleVoiceRecord}
              title="Voice Message"
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button size="sm" title="Send Message" className="h-9 gold-gradient text-gold-foreground" onClick={handleSend}>
              <Send className="mr-1 h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraModal
          onCapture={data => {
            handleImageSend(data)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
      {showVideoRecord && (
        <VideoRecordModal
          onSend={data => {
            sendMessage(data)
            setShowVideoRecord(false)
          }}
          onClose={() => setShowVideoRecord(false)}
        />
      )}
    </div>
  )
}

function MessageBubble({
  msg,
  isMe,
  reactions,
  userId,
  onReact,
  onTranslate,
  onCopy,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onMention,
  onDM,
  reactionPickerOpen,
  onOpenReactionPicker,
  onPollVote,
  onRsvp,
  currentUserName,
  currentUserNickname,
}: any) {
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const renderContent = () => {
    const text = msg.message_text

    if (text.startsWith('data:audio/')) {
      return <audio controls src={text} className="h-8 w-full max-w-[220px] rounded-full" />
    }
    if (text.startsWith('data:video/')) {
      return <video controls src={text} className="aspect-video max-w-[220px] rounded border border-border/40 bg-black" />
    }
    if (text.startsWith('data:image/') || /\.(jpeg|jpg|gif|png|webp)$/i.test(text)) {
      return (
        <img
          src={text}
          className="max-w-[200px] cursor-pointer rounded border border-border/40 object-cover hover:opacity-90"
          onClick={() => window.open(text)}
        />
      )
    }

    if (text.startsWith('🎟️ INVITATION:')) {
      const lines = text.split('\n')
      const titleLine = lines.find((l: string) => l.startsWith('📍 Event: '))
      const eventTitle = titleLine ? titleLine.replace('📍 Event: ', '').trim() : ''
      return (
        <div className="max-w-xs space-y-2 rounded-xl border border-primary/30 bg-muted/50 p-3 text-xs text-primary">
          <div className="whitespace-pre-line font-medium">{text}</div>
          <div className="flex gap-1 border-t border-border/30 pt-2">
            <Button
              size="sm"
              className="h-5 bg-green-700 text-[10px] text-white hover:bg-green-600"
              onClick={() => onRsvp(eventTitle, 'Going')}
            >
              Going
            </Button>
            <Button size="sm" variant="outline" className="h-5 text-[10px]" onClick={() => onRsvp(eventTitle, 'Maybe')}>
              Maybe
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-5 text-[10px] text-destructive"
              onClick={() => onRsvp(eventTitle, 'Declined')}
            >
              Decline
            </Button>
          </div>
        </div>
      )
    }

    if (text.startsWith('📊 POLL:')) {
      const clean = text.replace('📊 POLL:', '')
      const tokens = clean.split('|')
      const question = tokens[0]
      const options = tokens[1]?.split(',') || []
      return (
        <div className="max-w-xs space-y-2 rounded-xl border border-primary/30 bg-muted/50 p-3">
          <h4 className="font-bold text-primary">Poll: {question}</h4>
          <div className="space-y-1.5">
            {options.map((opt: string, idx: number) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="w-full justify-between text-xs border-border/40 hover:border-primary/30"
                onClick={() => onPollVote(idx)}
              >
                <span>{opt.trim()}</span>
                <span className="text-[10px] font-bold text-primary">Vote</span>
              </Button>
            ))}
          </div>
        </div>
      )
    }

    let html = text
    const validNames = [currentUserName]
    if (currentUserNickname) validNames.push(currentUserNickname)
    const escaped = validNames.map((n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const myMentionRegex = new RegExp(`@(${escaped.join('|')})(?![a-zA-Z0-9_])`, 'gi')

    html = html.replace(myMentionRegex, '<span class="rounded bg-primary/20 px-1 font-bold text-primary">$&</span>')
    html = html.replace(/@([a-zA-Z0-9_]+)/g, '<span class="font-bold text-primary/70">@$1</span>')
    html = html.replace(
      /^> (.*)$/gm,
      '<div class="mb-1 border-l-2 border-primary/50 bg-muted/40 p-1 pl-2 text-[10px] italic text-muted-foreground">$1</div>'
    )

    return <div dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap break-words" />
  }

  const groupedReactions: Record<string, { count: number; iReacted: boolean }> = {}
  reactions.forEach((r: Reaction) => {
    if (!groupedReactions[r.emoji]) groupedReactions[r.emoji] = { count: 0, iReacted: false }
    groupedReactions[r.emoji].count++
    if (r.user_id === userId) groupedReactions[r.emoji].iReacted = true
  })

  return (
    <div className={`group flex w-full flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      <div className="mb-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        {!isMe && (
          <span className="flex items-center gap-1.5">
            <button onClick={onMention} className="font-bold transition hover:text-primary cursor-pointer">
              {msg.sender_name}
            </button>
            <button
              onClick={onDM}
              className="inline-flex h-4 w-4 items-center justify-center rounded border border-primary/20 bg-primary/5 text-primary/70 transition-all hover:scale-110 hover:border-primary/40 hover:bg-primary/15 hover:text-primary hover:shadow-sm hover:shadow-primary/10"
              title="Direct Message"
            >
              <MessageSquare className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={onReply}
              className="inline-flex h-4 w-4 items-center justify-center rounded hover:text-primary"
              title="Reply"
            >
              <Hash className="h-2.5 w-2.5" />
            </button>
          </span>
        )}
        {isMe && <span className="font-bold">{msg.sender_name}</span>}

        <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="md:hidden ml-auto px-1 font-bold">
