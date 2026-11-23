import { useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadMemberArchiveFile } from '@/lib/fenestriansCore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Share2, MessageSquare, FolderUp, ArrowLeft, CheckCircle2, Upload } from 'lucide-react'

export default function ShareTargetPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const initialSharedText = [
    searchParams.get('title'),
    searchParams.get('text'),
    searchParams.get('url'),
  ]
    .filter(Boolean)
    .join('\n')

  const [sharedMessage, setSharedMessage] = useState(initialSharedText)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [keepPrivate, setKeepPrivate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  if (!user) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/40 bg-card/85 p-6 text-center space-y-4">
          <CardTitle className="text-primary">Sign In to Share to Fenestrians</CardTitle>
          <p className="text-xs text-muted-foreground">
            Please log in first to post shared links, notes, or files to Fenestrians.
          </p>
          <Button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full gold-gradient text-gold-foreground font-semibold"
          >
            Go to Login
          </Button>
        </Card>
      </div>
    )
  }

  const handlePostToCommonChat = async () => {
    const trimmed = sharedMessage.trim()
    if (!trimmed) {
      alert('Enter or paste a message/link to share in Common Chat.')
      return
    }
    setBusy(true)
    await supabase.from('chat_messages').insert([
      {
        room_id: 'global',
        sender_id: user.id,
        sender_name: user.full_name,
        message_text: trimmed,
      },
    ])
    setBusy(false)
    setDoneMsg('Shared directly to Common Chat!')
    setTimeout(() => navigate('/dashboard?tab=chat'), 900)
  }

  const handleSaveToFolder = async () => {
    if (!selectedFile) {
      alert('Select a file or photo to save to your Fenestrians folder.')
      return
    }
    setBusy(true)
    const isImage = selectedFile.type.startsWith('image/')
    const res = await uploadMemberArchiveFile({
      ownerId: user.id,
      ownerName: user.full_name,
      folderCategory: isImage ? 'gallery' : 'folder',
      file: selectedFile,
      isPrivate: keepPrivate,
      isProfilePicture: false,
    })
    setBusy(false)
    if (!res.success) {
      alert(res.error || 'Could not upload file.')
      return
    }
    setDoneMsg(`Saved "${selectedFile.name}" to your ${isImage ? 'Gallery' : 'Folder'}!`)
    setTimeout(() => navigate('/dashboard?tab=media'), 900)
  }

  return (
    <div className="min-h-svh bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-lg space-y-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="gap-1.5 text-xs text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        {doneMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {doneMsg}
          </div>
        )}

        <Card className="border-primary/40 bg-card/80 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Share2 className="h-5 w-5" />
              Share to Fenestrians
            </CardTitle>
            <CardDescription className="text-xs">
              Post shared links/messages to Common Chat or upload photos/documents straight into your Member Folder.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 text-xs">
            <div className="space-y-2 rounded-xl border border-border/40 bg-muted/15 p-3.5">
              <p className="font-bold text-primary">1. Share Text or Link to Common Chat</p>
              <Textarea
                value={sharedMessage}
                onChange={e => setSharedMessage(e.target.value)}
                placeholder="Paste link or message to share with batchmates..."
                className="h-24 text-xs"
              />
              <Button
                type="button"
                disabled={busy}
                onClick={handlePostToCommonChat}
                className="w-full gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                <MessageSquare className="h-4 w-4" />
                Post to Common Chat
              </Button>
            </div>

            <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/15 p-3.5">
              <p className="font-bold text-primary">2. Save Photo or Document to Your Folder</p>
              <input
                ref={fileRef}
                type="file"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Choose File / Photo
                </Button>
                <Input
                  readOnly
                  value={selectedFile ? selectedFile.name : 'No file selected'}
                  className="text-xs bg-background/60"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepPrivate}
                  onChange={e => setKeepPrivate(e.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                <span>Keep file private (only visible to me)</span>
              </label>

              <Button
                type="button"
                disabled={busy || !selectedFile}
                onClick={handleSaveToFolder}
                className="w-full gold-gradient text-gold-foreground font-semibold gap-1.5"
              >
                <FolderUp className="h-4 w-4" />
                Save to My Folder
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
