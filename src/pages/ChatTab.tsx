import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { publishArchivedAlert } from '@/lib/notificationService'
import { formatISTDateTime } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  MessageCircle,
  Send,
  Copy,
  Check,
  Reply,
  Forward,
  BarChart2,
  X,
  Plus,
  Users,
} from 'lucide-react'

interface ChatMember {
  id: number
  full_name: string
  class_nickname?: string | null
}

interface PollPayload {
  question: string
  options: string[]
  votes: Record<string, number[]>
}

interface ChatMessageRow {
  id: number
  room_id: string
  sender_id: number
  sender_name: string
  message_text: string
  created_at: string
}

const POLL_PREFIX = '[[POLL]]'

function parsePollMessage(text: string): PollPayload | null {
  if (!text.startsWith(POLL_PREFIX)) return null
  try {
    const raw = text.slice(POLL_PREFIX.length)
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.question === 'string' && Array.isArray(parsed.options)) {
      return {
        question: parsed.question,
        options: parsed.options,
        votes: parsed.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
      }
    }
  } catch {
    return null
  }
  return null
}

export default function ChatTab() {
  const { user } = useAuth()

  const [members, setMembers] = useState<ChatMember[]>([])
  const [roomId, setRoomId] = useState<string>('global')
  const [activeDmPartner, setActiveDmPartner] = useState<ChatMember | null>(null)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const [replyTarget, setReplyTarget] = useState<ChatMessageRow | null>(null)
  const [forwardTarget, setForwardTarget] = useState<ChatMessageRow | null>(null)
  const [forwardRoomId, setForwardRoomId] = useState<string>('global')

  const [showPollCreator, setShowPollCreator] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [creatingPoll, setCreatingPoll] = useState(false)

  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const buildDmRoom = (a: number, b: number) => `DM-${Math.min(a, b)}-${Math.max(a, b)}`

  useEffect(() => {
    if (!user) return
    loadMembers()
  }, [user])

  useEffect(() => {
    const handleOpenDm = (ev: Event) => {
      const custom = ev as CustomEvent<{ id: number; name: string }>
      if (!user || !custom.detail?.id) return
      const partner: ChatMember = { id: custom.detail.id, full_name: custom.detail.name }
      setActiveDmPartner(partner)
      setRoomId(buildDmRoom(user.id, partner.id))
    }
    window.addEventListener('open-dm', handleOpenDm)
    return () => window.removeEventListener('open-dm', handleOpenDm)
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
        () => {
          loadMessages(roomId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, roomId])

  const loadMembers = async () => {
    const { data } = await supabase
      .from('alumni')
      .select('id, full_name, class_nickname')
      .eq('is_placeholder', false)
      .neq('full_name', 'System Administrator')
      .order('full_name', { ascending: true })
    if (data) setMembers(data as ChatMember[])
  }

  const loadMessages = async (targetRoom: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', targetRoom)
      .order('created_at', { ascending: true })
      .limit(150)
    if (data) setMessages(data as ChatMessageRow[])
  }

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter(m => {
        const name = (m.full_name || '').toLowerCase()
        const nick = (m.class_nickname || '').toLowerCase()
        return name.includes(q) || nick.includes(q)
      })
      .slice(0, 6)
  }, [members, mentionQuery])

  const handleInputChange = (val: string) => {
    setMessageInput(val)
    const atIndex = val.lastIndexOf('@')
    if (atIndex === -1) {
      setMentionQuery(null)
      return
    }
    const textAfterAt = val.slice(atIndex + 1)
    if (textAfterAt.includes('\n')) {
      setMentionQuery(null)
      return
    }
    setMentionQuery(textAfterAt)
  }

  const handleSelectMention = (member: ChatMember) => {
    const atIndex = messageInput.lastIndexOf('@')
    if (atIndex === -1) return
    const prefix = messageInput.slice(0, atIndex)
    const insertText = `@${member.full_name} `
    setMessageInput(`${prefix}${insertText}`)
    setMentionQuery(null)
    inputRef.current?.focus()
  }

  const notifyMentionedMembers = async (text: string, targetRoom: string) => {
    if (!user) return
    const lower = text.toLowerCase()
    for (const m of members) {
      if (m.id === user.id) continue
      if (lower.includes(`@${m.full_name.toLowerCase()}`)) {
        await publishArchivedAlert({
          category: 'member_message',
          shortTitle: `Mentioned by ${user.full_name}`,
          fullMessage: `${user.full_name} mentioned you in ${
            targetRoom === 'global' ? 'Batch Chat' : 'Direct Chat'
          }: "${text}"`,
          targetUserId: m.id,
        })
      }
    }
  }

  const handleSendMessage = async () => {
    if (!user) return
    const trimmed = messageInput.trim()
    if (!trimmed) return

    setSending(true)
    const composedText = replyTarget
      ? `↩ Replying to ${replyTarget.sender_name}: "${replyTarget.message_text.slice(0, 90)}"\n${trimmed}`
      : trimmed

    const { error } = await supabase.from('chat_messages').insert([
      {
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: composedText,
      },
    ])

    if (!error) {
      if (activeDmPartner && roomId.startsWith('DM-')) {
        await publishArchivedAlert({
          category: 'member_message',
          shortTitle: `New DM from ${user.full_name}`,
          fullMessage: `${user.full_name}: ${trimmed}`,
          targetUserId: activeDmPartner.id,
        })
      }
      await notifyMentionedMembers(trimmed, roomId)
      setMessageInput('')
      setReplyTarget(null)
      setMentionQuery(null)
      await loadMessages(roomId)
    }
    setSending(false)
  }

  const handleCopyMessage = async (msg: ChatMessageRow) => {
    const parsedPoll = parsePollMessage(msg.message_text)
    const textToCopy = parsedPoll
      ? `Poll: ${parsedPoll.question}\n${parsedPoll.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
      : msg.message_text

    try {
      await navigator.clipboard.writeText(textToCopy)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = textToCopy
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedId(msg.id)
    setTimeout(() => setCopiedId(null), 1800)
  }

  const handleConfirmForward = async () => {
    if (!user || !forwardTarget) return
    const forwardedBody = `↪ Forwarded from ${forwardTarget.sender_name}:\n${forwardTarget.message_text}`
    await supabase.from('chat_messages').insert([
      {
        room_id: forwardRoomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: forwardedBody,
      },
    ])
    setForwardTarget(null)
    if (forwardRoomId === roomId) {
      await loadMessages(roomId)
    }
  }

  const handleCreateChatPoll = async () => {
    if (!user) return
    const q = pollQuestion.trim()
    const cleanOpts = pollOptions.map(o => o.trim()).filter(Boolean)
    if (!q || cleanOpts.length < 2) {
      alert('Enter a poll question and at least 2 options.')
      return
    }

    setCreatingPoll(true)
    const payload: PollPayload = {
      question: q,
      options: cleanOpts,
      votes: {},
    }
    await supabase.from('chat_messages').insert([
      {
        room_id: roomId,
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: `${POLL_PREFIX}${JSON.stringify(payload)}`,
      },
    ])
    setCreatingPoll(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setShowPollCreator(false)
    await loadMessages(roomId)
  }

  const handleVoteOnChatPoll = async (msg: ChatMessageRow, optionIndex: number) => {
    if (!user) return
    const parsed = parsePollMessage(msg.message_text)
    if (!parsed) return

    const updatedVotes: Record<string, number[]> = {}
    for (const [optKey, voterIds] of Object.entries(parsed.votes)) {
      updatedVotes[optKey] = (voterIds || []).filter(id => id !== user.id)
    }
    const targetKey = String(optionIndex)
    const currentList = updatedVotes[targetKey] ?? []
    if (!currentList.includes(user.id)) {
      currentList.push(user.id)
    }
    updatedVotes[targetKey] = currentList

    const nextPayload: PollPayload = {
      ...parsed,
      votes: updatedVotes,
    }

    await supabase
      .from('chat_messages')
      .update({ message_text: `${POLL_PREFIX}${JSON.stringify(nextPayload)}` })
      .eq('id', msg.id)

    await loadMessages(roomId)
  }

  if (!user) return null

  return (
    <Card className="border-border/40 bg-card/75 backdrop-blur-sm">
      <CardHeader className="pb-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base text-primary">
            <MessageCircle className="h-5 w-5" />
            {activeDmPartner ? `Direct Chat • ${activeDmPartner.full_name}` : 'Batch Group Chat'}
          </CardTitle>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={roomId === 'global' ? 'default' : 'outline'}
              onClick={() => {
                setActiveDmPartner(null)
                setRoomId('global')
              }}
              className={`h-7 text-xs gap-1 ${
                roomId === 'global' ? 'gold-gradient text-gold-foreground font-semibold' : ''
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Batch Room
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowPollCreator(prev => !prev)}
              className="h-7 text-xs gap-1 border-primary/40 text-primary"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              {showPollCreator ? 'Close Poll' : 'Create Poll'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-muted-foreground shrink-0">DM Member:</span>
          <select
            value={activeDmPartner ? String(activeDmPartner.id) : ''}
            onChange={e => {
              const chosenId = e.target.value
              if (!chosenId) {
                setActiveDmPartner(null)
                setRoomId('global')
                return
              }
              const found = members.find(m => String(m.id) === chosenId)
              if (found) {
                setActiveDmPartner(found)
                setRoomId(buildDmRoom(user.id, found.id))
              }
            }}
            className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs"
          >
            <option value="">-- Batch Group Room --</option>
            {members
              .filter(m => m.id !== user.id)
              .map(m => (
                <option key={m.id} value={String(m.id)}>
                  {m.full_name}
                </option>
              ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-xs">
        {showPollCreator && (
          <div className="rounded-xl border border-primary/35 bg-primary/5 p-3.5 space-y-2.5">
            <p className="font-bold text-primary">Create Quick Chat Poll</p>
            <Input
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="h-8 text-xs"
            />
            <div className="space-y-1.5">
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={opt}
                    onChange={e => {
                      const copy = [...pollOptions]
                      copy[idx] = e.target.value
                      setPollOptions(copy)
                    }}
                    placeholder={`Option ${idx + 1}`}
                    className="h-8 text-xs"
                  />
                  {pollOptions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                      className="h-8 w-8 text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPollOptions([...pollOptions, ''])}
                className="h-7 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Option
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={creatingPoll}
                onClick={handleCreateChatPoll}
                className="h-7 gold-gradient text-gold-foreground font-semibold text-xs"
              >
                {creatingPoll ? 'Posting...' : 'Post Poll to Chat'}
              </Button>
            </div>
          </div>
        )}

        {forwardTarget && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300">
                Forward message from {forwardTarget.sender_name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setForwardTarget(null)}
                className="h-6 w-6"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="rounded bg-background/60 p-2 text-[11px] text-foreground/90 line-clamp-2">
              {forwardTarget.message_text}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={forwardRoomId}
                onChange={e => setForwardRoomId(e.target.value)}
                className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs"
              >
                <option value="global">Batch Group Room</option>
                {members
                  .filter(m => m.id !== user.id)
                  .map(m => (
                    <option key={m.id} value={buildDmRoom(user.id, m.id)}>
                      DM: {m.full_name}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmForward}
                className="h-8 gold-gradient text-gold-foreground font-semibold text-xs gap-1"
              >
                <Forward className="h-3.5 w-3.5" />
                Forward Now
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto space-y-2.5 rounded-xl border border-border/30 bg-background/50 p-3">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No messages yet. Type @ to mention a member and start the conversation.
            </p>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === user.id
              const pollData = parsePollMessage(msg.message_text)
              const totalPollVotes = pollData
                ? Object.values(pollData.votes).reduce((s, arr) => s + (arr?.length || 0), 0)
                : 0

              return (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-3 space-y-1.5 ${
                    isMine
                      ? 'border-primary/40 bg-primary/10 ml-4'
                      : 'border-border/40 bg-card/80 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="font-bold text-primary">{msg.sender_name}</span>
                    <span>{formatISTDateTime(msg.created_at)}</span>
                  </div>

                  {pollData ? (
                    <div className="space-y-2 pt-0.5">
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <BarChart2 className="h-3.5 w-3.5 text-primary" />
                        <span>{pollData.question}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {totalPollVotes} vote{totalPollVotes === 1 ? '' : 's'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        {pollData.options.map((opt, idx) => {
                          const voters = pollData.votes[String(idx)] ?? []
                          const pct =
                            totalPollVotes > 0 ? Math.round((voters.length / totalPollVotes) * 100) : 0
                          const votedByMe = voters.includes(user.id)

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleVoteOnChatPoll(msg, idx)}
                              className={`w-full text-left rounded-lg border px-2.5 py-1.5 transition-all ${
                                votedByMe
                                  ? 'border-emerald-500 bg-emerald-500/15 font-bold text-emerald-300'
                                  : 'border-border/40 bg-background/70 hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span>{opt}</span>
                                <span>
                                  {voters.length} ({pct}%)
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-foreground/95 leading-relaxed">
                      {msg.message_text}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 border-t border-border/20">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget(msg)
                        inputRef.current?.focus()
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                    >
                      <Reply className="h-3 w-3" />
                      Reply
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setForwardTarget(msg)
                        setForwardRoomId('global')
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                    >
                      <Forward className="h-3 w-3" />
                      Forward
                    </button>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {replyTarget && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/35 bg-primary/10 px-3 py-1.5 text-[11px]">
            <span className="truncate text-foreground">
              Replying to <strong>{replyTarget.sender_name}</strong>: {replyTarget.message_text}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setReplyTarget(null)}
              className="h-5 w-5 shrink-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {mentionCandidates.length > 0 && (
          <div className="rounded-xl border border-primary/40 bg-card shadow-lg p-1.5 space-y-1">
            <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Mention a Member
            </p>
            {mentionCandidates.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectMention(m)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-primary/15"
              >
                <span className="font-bold text-foreground">{m.full_name}</span>
                {m.class_nickname && (
                  <span className="text-[10px] text-primary">({m.class_nickname})</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={messageInput}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && mentionCandidates.length === 0) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Type a message (use @ to mention a member)..."
            className="h-9 text-xs"
          />
          <Button
            type="button"
            disabled={sending || !messageInput.trim()}
            onClick={handleSendMessage}
            className="h-9 gold-gradient text-gold-foreground font-semibold gap-1.5 text-xs shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
