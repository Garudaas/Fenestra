import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  uploadMemberArchiveFile,
  deleteMemberArchiveFile,
  getUserStorageUsage,
  formatBytes,
} from '@/lib/fenestriansCore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Folder,
  FolderOpen,
  Upload,
  Trash2,
  Download,
  Lock,
  Globe,
  FileText,
  HardDrive,
  ShieldAlert,
  ArrowLeft,
  ArrowUpDown,
} from 'lucide-react'

interface ArchiveFileRecord {
  id: number
  owner_id: number
  owner_name: string
  folder_category: string
  file_name: string
  file_url: string
  storage_path: string
  mime_type: string
  file_size_bytes: number
  is_private: boolean
  is_profile_picture: boolean
  created_at: string
}

interface AdminStorageSummary {
  user_id: number
  full_name: string
  storage_quota_mb: number
  total_used_bytes: number
  private_used_bytes: number
  total_files_count: number
}

export default function FolderTab() {
  const { user, isAdmin } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [files, setFiles] = useState<ArchiveFileRecord[]>([])
  const [ownerPermissions, setOwnerPermissions] = useState<Record<number, boolean>>({})
  const [selectedFolderOwnerId, setSelectedFolderOwnerId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'largest'>('newest')
  const [showLargestCleanup, setShowLargestCleanup] = useState(false)
  const [isPrivateUpload, setIsPrivateUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [myUsage, setMyUsage] = useState({ usedBytes: 0, quotaMb: 100 })
  const [adminSummaries, setAdminSummaries] = useState<AdminStorageSummary[]>([])
  const [quotaInputs, setQuotaInputs] = useState<Record<number, number>>({})
  const [savingQuotaId, setSavingQuotaId] = useState<number | null>(null)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user) return
    loadAllData()
  }, [user])

  const loadAllData = async () => {
    if (!user) return
    setLoading(true)

    const [{ data: memberRows }, { data: fileRows }, usage] = await Promise.all([
      supabase
        .from('alumni')
        .select('id, allow_media_download, default_media_private')
        .eq('is_placeholder', false),
      supabase
        .from('member_media_files')
        .select('*')
        .order('created_at', { ascending: false }),
      getUserStorageUsage(user.id),
    ])

    const permMap: Record<number, boolean> = {}
    for (const m of memberRows ?? []) {
      permMap[m.id] = m.allow_media_download ?? true
      if (m.id === user.id) {
        setIsPrivateUpload(m.default_media_private ?? false)
      }
    }
    setOwnerPermissions(permMap)
    setMyUsage({ usedBytes: usage.usedBytes, quotaMb: usage.quotaMb })

    const visibleFiles = ((fileRows ?? []) as ArchiveFileRecord[]).filter(
      f => f.owner_id === user.id || !f.is_private
    )
    setFiles(visibleFiles)

    if (userIsAdmin) {
      const { data: summaryRows } = await supabase
        .from('admin_user_storage_summary')
        .select('*')
        .order('total_used_bytes', { ascending: false })
      if (summaryRows) {
        const typed = summaryRows as AdminStorageSummary[]
        setAdminSummaries(typed)
        const initialQuotas: Record<number, number> = {}
        for (const s of typed) {
          initialQuotas[s.user_id] = s.storage_quota_mb
        }
        setQuotaInputs(initialQuotas)
      }
    }

    setLoading(false)
  }

  const handleUpdateMemberQuota = async (targetUserId: number) => {
    if (!user || !userIsAdmin) return
    const nextQuota = Number(quotaInputs[targetUserId])
    if (!nextQuota || nextQuota < 10 || nextQuota > 102400) {
      alert('Please enter a valid storage limit between 10 MB and 102400 MB (100 GB).')
      return
    }

    setSavingQuotaId(targetUserId)
    const { error } = await supabase.rpc('admin_update_member_quota', {
      p_admin_id: user.id,
      p_target_user_id: targetUserId,
      p_new_quota_mb: nextQuota,
    })

    if (error) {
      await supabase
        .from('alumni')
        .update({ storage_quota_mb: nextQuota })
        .eq('id', targetUserId)
    }

    setSavingQuotaId(null)
    await loadAllData()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    const result = await uploadMemberArchiveFile({
      ownerId: user.id,
      ownerName: user.full_name,
      folderCategory: 'folder',
      file,
      isPrivate: isPrivateUpload,
      isProfilePicture: false,
    })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''

    if (!result.success) {
      alert(result.error || 'Upload failed.')
      return
    }

    await loadAllData()
  }

  const handleDeleteFile = async (item: ArchiveFileRecord) => {
    if (item.is_profile_picture) {
      alert('Profile pictures cannot be deleted. Only the member can update their profile picture.')
      return
    }
    if (!window.confirm(`Delete "${item.file_name}"?`)) return

    const res = await deleteMemberArchiveFile(item.id)
    if (!res.success) {
      alert(res.error || 'Could not delete file.')
      return
    }
    await loadAllData()
  }

  if (!user) return null

  const sortFilesList = (list: ArchiveFileRecord[]) => {
    const copy = [...list]
    if (sortBy === 'largest') {
      copy.sort((a, b) => Number(b.file_size_bytes || 0) - Number(a.file_size_bytes || 0))
    } else {
      copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return copy
  }

  const folderMap = new Map<number, { ownerId: number; ownerName: string; items: ArchiveFileRecord[] }>()
  folderMap.set(user.id, { ownerId: user.id, ownerName: user.full_name, items: [] })

  for (const item of files) {
    if (!folderMap.has(item.owner_id)) {
      folderMap.set(item.owner_id, {
        ownerId: item.owner_id,
        ownerName: item.owner_name,
        items: [],
      })
    }
    folderMap.get(item.owner_id)!.items.push(item)
  }

  const folderList = Array.from(folderMap.values())
  const activeFolder = selectedFolderOwnerId ? folderMap.get(selectedFolderOwnerId) ?? null : null

  const myLargestFiles = [...files]
    .filter(f => f.owner_id === user.id && !f.is_profile_picture)
    .sort((a, b) => Number(b.file_size_bytes || 0) - Number(a.file_size_bytes || 0))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Folder className="h-5 w-5" />
              Member Folders &amp; Shared Files
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showLargestCleanup ? 'default' : 'outline'}
                title="View Your Largest Files to Free Up Space"
                onClick={() => setShowLargestCleanup(prev => !prev)}
                className={
                  showLargestCleanup
                    ? 'gold-gradient text-gold-foreground text-xs gap-1.5'
                    : 'text-xs gap-1.5 border-primary/40 text-primary'
                }
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {showLargestCleanup ? 'Hide Largest Files Cleanup' : 'Largest Files Cleanup'}
              </Button>
              <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <HardDrive className="h-3.5 w-3.5" />
                Your Storage: {formatBytes(myUsage.usedBytes)} / {myUsage.quotaMb} MB
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Every member has a personal folder under their name to store and share any file format (documents, PDFs, audio, videos, photos, archives).
          </p>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3.5">
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            <Button
              type="button"
              title="Upload File to Your Folder"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gold-gradient text-gold-foreground font-semibold gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : `Upload File to "${user.full_name}" Folder`}
            </Button>

            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivateUpload}
                onChange={e => setIsPrivateUpload(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              <span>Keep this file private (do not share with others)</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Personal Largest Files Cleanup Drawer */}
      {showLargestCleanup && (
        <Card className="border-primary/40 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary">
              Your Largest Files ({myLargestFiles.length} deletable item{myLargestFiles.length === 1 ? '' : 's'})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {myLargestFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">You have no deletable files in your archive.</p>
            ) : (
              myLargestFiles.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{item.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Size: <span className="font-bold text-primary">{formatBytes(item.file_size_bytes)}</span> •{' '}
                      {item.folder_category === 'gallery' ? 'Gallery' : 'Folder'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    title="Delete to Free Space"
                    onClick={() => handleDeleteFile(item)}
                    className="h-7 gap-1 text-xs shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Admin Storage Usage & Adjustable Quotas */}
      {userIsAdmin && adminSummaries.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              Admin Storage Accounting &amp; Adjustable Member Quotas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {adminSummaries.map(s => {
                const quotaBytes = s.storage_quota_mb * 1024 * 1024
                const overQuota = s.total_used_bytes > quotaBytes
                return (
                  <div
                    key={s.user_id}
                    className={`rounded-lg border p-3 text-xs space-y-2 ${
                      overQuota
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-border/40 bg-background/60'
                    }`}
                  >
                    <div>
                      <p className="font-bold text-foreground truncate">{s.full_name}</p>
                      <p className="text-muted-foreground mt-0.5">
                        Used:{' '}
                        <span className={overQuota ? 'font-bold text-red-400' : 'font-semibold text-primary'}>
                          {formatBytes(Number(s.total_used_bytes))}
                        </span>{' '}
                        / {s.storage_quota_mb} MB
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Hidden/Private: {formatBytes(Number(s.private_used_bytes))} ({s.total_files_count} files)
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                      <Input
                        type="number"
                        min={10}
                        max={102400}
                        value={quotaInputs[s.user_id] ?? s.storage_quota_mb}
                        onChange={e =>
                          setQuotaInputs(prev => ({
                            ...prev,
                            [s.user_id]: Number(e.target.value),
                          }))
                        }
                        className="h-7 w-20 text-xs bg-input/50"
                      />
                      <span className="text-[11px] text-muted-foreground">MB</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={savingQuotaId === s.user_id}
                        onClick={() => handleUpdateMemberQuota(s.user_id)}
                        className="ml-auto h-7 px-2 text-[11px] border-primary/40 text-primary hover:bg-primary/10"
                      >
                        {savingQuotaId === s.user_id ? 'Saving...' : 'Set Limit'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder Browser */}
      {loading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading member folders...</p>
      ) : !activeFolder ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {folderList.map(folder => (
            <button
              key={folder.ownerId}
              type="button"
              title={`Open ${folder.ownerName}'s Folder`}
              onClick={() => setSelectedFolderOwnerId(folder.ownerId)}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/70 hover:border-primary/50 hover:bg-primary/5 p-4 text-left transition-all shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{folder.ownerName}</p>
                <p className="text-xs text-muted-foreground">
                  {folder.items.length} accessible file{folder.items.length === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="border-border/40 bg-card/70">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <FolderOpen className="h-5 w-5" />
                {activeFolder.ownerName}’s Folder
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'newest' | 'largest')}
                  title="Sort Files"
                  className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs font-semibold"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="largest">Sort: Largest Files First</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Back to All Folders"
                  onClick={() => setSelectedFolderOwnerId(null)}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Folders
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {activeFolder.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No shared files in this folder yet.
              </p>
            ) : (
              sortFilesList(activeFolder.items).map(item => {
                const canDelete =
                  !item.is_profile_picture && (item.owner_id === user.id || userIsAdmin)
                const ownerAllowsDownload =
                  item.owner_id === user.id || (ownerPermissions[item.owner_id] ?? true)

                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate">{item.file_name}</p>
                          {item.is_private ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              <Lock className="h-2.5 w-2.5" />
                              Private
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              <Globe className="h-2.5 w-2.5" />
                              Shared
                            </span>
                          )}
                          {item.is_profile_picture && (
                            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              Profile Copy
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-primary/90">{formatBytes(item.file_size_bytes)}</span> •{' '}
                          {new Date(item.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {ownerAllowsDownload ? (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={item.file_name}
                          title="Open or Download File"
                          className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Open / Save
                        </a>
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground">
                          Download restricted by owner
                        </span>
                      )}

                      {canDelete && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          title="Delete File"
                          onClick={() => handleDeleteFile(item)}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
