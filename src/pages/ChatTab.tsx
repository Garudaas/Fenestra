import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadMemberArchiveFile } from '@/lib/fenestriansCore'
import { formatISTDateTime } from '@/lib/formatters'
import { recordIncomingChatNotification, clearChatNotifications } from '@/lib/notificationService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  Send,
  Mic,
  Square,
  Paperclip,
  Pin,
  PinOff,
  Users,
  Plus,
  Trash2,
  FileText,
  Download,
  Languages,
  X,
} from 'lucide-react'

interface ChatMessageItem {
  id: number
  room_id: string
  sender_id: number
  sender_name: string
  message_text: string
  audio_url?: string | null
  attachment_url?: string | null
  attachment_name?: string | null
  attachment_type?: string | null
  reactions_json?: Record<string, number[]> | null
  is_pinned?: boolean
  created_at: string
}

const REACTION_EMOJIS = ['👍', '❤️', '🙏', '🎉', '😂']

export default function ChatTab() {
  const { user, isAdmin } = useAuth()
  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  const [roomId, setRoomId] = useState('global')
  const [roomLabel, setRoomLabel] = useState('Common Batch Chat')
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [members, setMembers] = useState<Array<{ id: number; full_name: string }>>([])
  const [customGroups, setCustomGroups] = useState<string[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupBox, setShowNewGroupBox] = useState(false)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [translatedMap, setTranslatedMap] = useState<Record<number, string>>({})
  const [translatingId, setTranslatingId] = useState<number | null>(null)

  // Voice Note Recording states
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!user) return
    clearChatNotifications(user.id)
    loadMembersAndGroups()

    const dmHandler = (e: any) => {
      if (e.detail?.id && e.detail?.name && user) {
        const dmRoom = `DM-${Math.min(user.id, Number(e.detail.id))}-${Math.max(
          user.id,
          Number(e.detail.id)
        )}`
        setRoomId(dmRoom)
        setRoomLabel(`Private Chat with ${e.detail.name}`)
      }
    }
    window.addEventListener('open-dm', dmHandler)
    return () => window.removeEventListener('open-dm', dmHandler)
  }, [user])

  useEffect(() => {
    if (!user) return
    loadMessages(roomId)

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        payload => {
          loadMessages(roomId)
          if (payload.eventType === 'INSERT') {
            const msg = payload.new as ChatMessageItem
            if (
              msg.sender_id !== user.id &&
              localStorage.getItem('fenestrians_mention_tone') !== 'off' &&
              msg.message_text?.toLowerCase().includes(`@${user.full_name.toLowerCase()}`)
            ) {
              new Audio('/alert-sound.mp3').play().catch(() => {})
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, user])

  const loadMembersAndGroups = async () => {
    const [memRes, roomsRes] = await Promise.all([
      supabase
        .from('alumni')
        .select('id, full_name')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator')
        .order('full_name', { ascending: true }),
      supabase.from('chat_messages').select('room_id').neq('room_id', 'global'),
    ])

    setMembers((memRes.data ?? []) as Array<{ id: number; full_name: string }>)
    const distinctRooms = Array.from(
      new Set(
        (roomsRes.data ?? [])
          .map(r => String(r.room_id))
          .filter(r => r && !r.startsWith('DM-'))
      )
    )
    setCustomGroups(distinctRooms)
  }

  const loadMessages = async (activeRoom: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', activeRoom)
      .order('created_at', { ascending: true })
      .limit(200)

    if (data) {
      setMessages(data as ChatMessageItem[])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
    }
  }

  const notifyRoomParticipants = async (preview: string) => {
    if (!user) return
    if (roomId.startsWith('DM-')) {
      const parts = roomId.split('-')
      const idA = Number(parts[1])
      const idB = Number(parts[2])
      const targetId = idA === user.id ? idB : idA
      if (targetId && targetId !== user.id) {
        await recordIncomingChatNotification({
          recipientUserId: targetId,
          chatType: 'private_chat',
          senderName: user.full_name,
          previewText: preview,
        })
      }
      return
    }

    const chatType = roomId === 'global' ? 'common_chat' : 'group_chat'
    for (const m of members) {
      if (m.id === user.id) continue
      await recordIncomingChatNotification({
        recipientUserId: m.id,
        chatType,
        senderName: user.full_name,
        previewText: preview,
      })
    }
  }

  const handleSendMessage = async () => {
    if (!user || !text.trim()) return
    const outgoing = text.trim()
    setText('')
    setSending(true)

    await supabase.from('chat_messages').insert([
      {
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: outgoing,
      },
    ])

    await notifyRoomParticipants(outgoing)
    setSending(false)
    await loadMessages(roomId)
  }

  // --- VOICE NOTE RECORDING ---
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) window.clearInterval(timerRef.current)
        setRecordingSeconds(0)

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        if (audioBlob.size < 500 || !user) return

        setSending(true)
        const fileName = `voice_note_${user.id}_${Date.now()}.webm`
        const storagePath = `chat_voice/${fileName}`
        const { error: upErr } = await supabase.storage
          .from('fenestrians-media')
          .upload(storagePath, audioBlob, { contentType: 'audio/webm', upsert: true })

        if (!upErr) {
          const { data: pubData } = supabase.storage
            .from('fenestrians-media')
            .getPublicUrl(storagePath)

          if (pubData?.publicUrl) {
            await supabase.from('chat_messages').insert([
              {
                room_id: roomId,
                sender_id: user.id,
                sender_name: user.full_name,
                message_text: '🎤 Voice Note',
                audio_url: pubData.publicUrl,
              },
            ])
            await notifyRoomParticipants('🎤 Sent a voice note')
            await loadMessages(roomId)
          }
        }
        setSending(false)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch {
      alert('Microphone permission is required to record voice notes.')
    }
  }

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  // --- INLINE FILE / MEDIA ATTACHMENT ---
  const handleFileAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return

    setSending(true)
    const uploadRes = await uploadMemberArchiveFile({
      ownerId: user.id,
      ownerName: user.full_name,
      folderCategory: file.type.startsWith('image/') ? 'gallery' : 'folder',
      file,
      isPrivate: false,
      isProfilePicture: false,
    })

    if (!uploadRes.success || !uploadRes.publicUrl) {
      setSending(false)
      alert(uploadRes.error || 'Could not share file.')
      return
    }

    await supabase.from('chat_messages').insert([
      {
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: `📎 Shared ${file.name}`,
        attachment_url: uploadRes.publicUrl,
        attachment_name: file.name,
        attachment_type: file.type || 'application/octet-stream',
      },
    ])

    await notifyRoomParticipants(`📎 Shared ${file.name}`)
    setSending(false)
    await loadMessages(roomId)
  }

  // --- EMOJI REACTIONS ---
  const handleToggleReaction = async (msg: ChatMessageItem, emoji: string) => {
    if (!user) return
    const current = { ...(msg.reactions_json || {}) }
    const usersList = Array.isArray(current[emoji]) ? [...current[emoji]] : []
    const idx = usersList.indexOf(user.id)
    if (idx >= 0) {
      usersList.splice(idx, 1)
    } else {
      usersList.push(user.id)
    }

    if (usersList.length === 0) {
      delete current[emoji]
    } else {
      current[emoji] = usersList
    }

    await supabase
      .from('chat_messages')
      .update({ reactions_json: current })
      .eq('id', msg.id)

    await loadMessages(roomId)
  }

  // --- PIN / UNPIN ANNOUNCEMENT ---
  const handleTogglePin = async (msg: ChatMessageItem) => {
    await supabase
      .from('chat_messages')
      .update({ is_pinned: !msg.is_pinned })
      .eq('id', msg.id)
    await loadMessages(roomId)
  }

  // --- TRANSLATE MESSAGE ---
  const handleTranslateMessage = async (msg: ChatMessageItem) => {
    const targetLang = localStorage.getItem('pref_lang') || 'en'
    if (translatedMap[msg.id]) {
      setTranslatedMap(prev => {
        const copy = { ...prev }
        delete copy[msg.id]
        return copy
      })
      return
    }

    setTranslatingId(msg.id)
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(msg.message_text)}`
      const res = await fetch(url)
      const data = await res.json()
      const translatedText = Array.isArray(data?.[0])
        ? data[0].map((seg: any) => seg[0]).join('')
        : msg.message_text
      setTranslatedMap(prev => ({ ...prev, [msg.id]: translatedText }))
    } catch {
      alert('Translation service is temporarily unavailable.')
    } finally {
      setTranslatingId(null)
    }
  }

  const handleCreateCustomGroup = () => {
    const clean = newGroupName.trim()
    if (!clean) return
    if (!customGroups.includes(clean)) {
      setCustomGroups(prev => [...prev, clean])
    }
    setRoomId(clean)
    setRoomLabel(`Group: ${clean}`)
    setNewGroupName('')
    setShowNewGroupBox(false)
  }

  if (!user) return null

  const pinnedMessages = messages.filter(m => m.is_pinned)

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {/* Room Selector & Private Group Bar */}
      <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <MessageCircle className="h-5 w-5" />
              {roomLabel}
            </CardTitle>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={roomId === 'global' ? 'default' : 'outline'}
                onClick={() => {
                  setRoomId('global')
                  setRoomLabel('Common Batch Chat')
                }}
                className={
                  roomId === 'global'
                    ? 'gold-gradient text-gold-foreground text-xs font-semibold'
                    : 'text-xs'
                }
              >
                Common Chat
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowNewGroupBox(prev => !prev)}
                className="text-xs gap-1"
              >
                <Users className="h-3.5 w-3.5" />
                Groups ({customGroups.length})
              </Button>
            </div>
          </div>

          {showNewGroupBox && (
            <div className="mt-2 pt-2 border-t border-border/30 space-y-2 text-xs">
              <div className="flex gap-2">
                <Input
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Create or join private group name..."
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateCustomGroup}
                  className="h-8 gold-gradient text-gold-foreground font-semibold gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Open Group
                </Button>
              </div>
              {customGroups.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {customGroups.map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setRoomId(g)
                        setRoomLabel(`Group: ${g}`)
                      }}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        roomId === g
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/50 bg-background/60 text-foreground'
                      }`}
                    >
                      # {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* PINNED ANNOUNCEMENTS BANNER */}
          {pinnedMessages.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-1.5 text-xs">
              <p className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                <Pin className="h-3.5 w-3.5" />
                Pinned Announcements ({pinnedMessages.length})
              </p>
              {pinnedMessages.map(pm => (
                <div
                  key={`pin-${pm.id}`}
                  className="flex items-start justify-between gap-2 rounded bg-background/70 px-2.5 py-1.5"
                >
                  <p className="text-foreground/95">
                    <strong className="text-primary">{pm.sender_name}:</strong> {pm.message_text}
                  </p>
                  <button
                    type="button"
                    title="Unpin"
                    onClick={() => handleTogglePin(pm)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* MESSAGES STREAM */}
          <div className="h-[52vh] overflow-y-auto space-y-2.5 rounded-xl border border-border/30 bg-background/40 p-3">
            {messages.length === 0 ? (
              <p className="py-12 text-center text-xs text-muted-foreground">
                No messages in this room yet. Start the conversation!
              </p>
            ) : (
              messages.map(m => {
                const isMine = m.sender_id === user.id
                const reactions = m.reactions_json || {}
                const isImage =
                  m.attachment_type?.startsWith('image/') ||
                  (m.attachment_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(m.attachment_name || ''))
                const isVideo =
                  m.attachment_type?.startsWith('video/') ||
                  (m.attachment_url && /\.(mp4|webm|mov)$/i.test(m.attachment_name || ''))
                const isPdf =
                  m.attachment_type === 'application/pdf' ||
                  (m.attachment_name || '').toLowerCase().endsWith('.pdf')

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1.5 shadow-sm ${
                        isMine
                          ? 'bg-primary/20 border border-primary/40 text-foreground'
                          : 'bg-card border border-border/40 text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-primary text-[11px]">{m.sender_name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            {formatISTDateTime(m.created_at)}
                          </span>
                          <button
                            type="button"
                            title={m.is_pinned ? 'Unpin message' : 'Pin announcement'}
                            onClick={() => handleTogglePin(m)}
                            className="text-muted-foreground hover:text-amber-300"
                          >
                            {m.is_pinned ? (
                              <PinOff className="h-3 w-3 text-amber-400" />
                            ) : (
                              <Pin className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Translate message"
                            onClick={() => handleTranslateMessage(m)}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Languages className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Voice Note Player */}
                      {m.audio_url && (
                        <audio controls src={m.audio_url} className="w-full max-w-[250px] h-8" />
                      )}

                      {/* Inline Photo / Video / PDF Attachment Preview */}
                      {m.attachment_url && (
                        <div className="space-y-1.5 pt-1">
                          {isImage ? (
                            <img
                              src={m.attachment_url}
                              alt={m.attachment_name || 'Shared image'}
                              className="max-h-56 rounded-lg border border-border/40 object-contain"
                            />
                          ) : isVideo ? (
                            <video
                              controls
                              src={m.attachment_url}
                              className="max-h-56 w-full rounded-lg border border-border/40"
                            />
                          ) : isPdf ? (
                            <div className="space-y-1">
                              <iframe
                                src={m.attachment_url}
                                title={m.attachment_name || 'PDF Preview'}
                                className="h-48 w-full rounded-lg border border-border/40 bg-white"
                              />
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Open Full PDF ({m.attachment_name || 'Document.pdf'})
                              </a>
                            </div>
                          ) : (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background/80 px-2.5 py-1.5 text-[11px] font-semibold text-primary"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {m.attachment_name || 'Download Attachment'}
                            </a>
                          )}
                        </div>
                      )}

                      {m.message_text && (
                        <p className="whitespace-pre-line leading-relaxed">{m.message_text}</p>
                      )}

                      {translatingId === m.id && (
                        <p className="text-[10px] italic text-muted-foreground">Translating...</p>
                      )}
                      {translatedMap[m.id] && (
                        <p className="rounded bg-background/70 px-2 py-1 text-[11px] text-emerald-300 border-l-2 border-emerald-500">
                          {translatedMap[m.id]}
                        </p>
                      )}

                      {/* Emoji Reaction Bar */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/20">
                        {REACTION_EMOJIS.map(emoji => {
                          const count = Array.isArray(reactions[emoji])
                            ? reactions[emoji].length
                            : 0
                          const iReacted =
                            Array.isArray(reactions[emoji]) &&
                            reactions[emoji].includes(user.id)

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(m, emoji)}
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] transition-colors ${
                                iReacted
                                  ? 'bg-primary/25 border border-primary/50 text-foreground'
                                  : 'bg-background/50 hover:bg-background text-muted-foreground'
                              }`}
                            >
                              <span>{emoji}</span>
                              {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
                            </button>
                          )
                        })}

                        {(isMine || userIsAdmin) && (
                          <button
                            type="button"
                            title="Delete message"
                            onClick={async () => {
                              await supabase.from('chat_messages').delete().eq('id', m.id)
                              await loadMessages(roomId)
                            }}
                            className="ml-auto text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* MESSAGE, FILE ATTACHMENT & VOICE NOTE INPUT BAR */}
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileAttachment}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={sending || isRecording}
              onClick={() => fileInputRef.current?.click()}
              title="Attach Photo, Video, or PDF"
              className="h-9 w-9 shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {!isRecording ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={sending}
                onClick={startVoiceRecording}
                title="Record Voice Note"
                className="h-9 w-9 shrink-0 text-amber-400 border-amber-500/40"
              >
                <Mic className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={stopVoiceRecording}
                className="h-9 bg-red-600 hover:bg-red-500 text-white font-bold gap-1 shrink-0 text-xs animate-pulse"
              >
                <Square className="h-3.5 w-3.5" />
                Stop &amp; Send ({recordingSeconds}s)
              </Button>
            )}

            <Input
              value={text}
              disabled={isRecording}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Type a message (use @Name to mention)..."
              className="h-9 text-xs"
            />

            <Button
              type="button"
              disabled={sending || isRecording || !text.trim()}
              onClick={handleSendMessage}
              className="h-9 gold-gradient text-gold-foreground font-semibold gap-1 shrink-0 text-xs"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
