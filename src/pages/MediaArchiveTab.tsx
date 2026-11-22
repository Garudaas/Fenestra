import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  uploadMemberArchiveFile,
  deleteMemberArchiveFile,
  getUserStorageUsage,
  formatBytes,
} from '@/lib/fenestriansCore'
import { formatFullDate } from '@/lib/formatters'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import {
  FolderOpen,
  Upload,
  Trash2,
  Download,
  Lock,
  Globe,
  Eye,
  FileText,
  HardDrive,
  ShieldAlert,
  ArrowLeft,
  ArrowUpDown,
  Camera,
  Image as ImageIcon,
} from 'lucide-react'

interface ArchiveItem {
  id: number
  source: 'archive' | 'legacy'
  ownerId: number
  ownerName: string
  folderCategory: string
  fileName: string
  fileUrl: string
  storagePath: string
  mimeType: string
  fileSizeBytes: number
  isPrivate: boolean
  allowDownload: boolean
  isProfilePicture: boolean
  createdAt: string
}

interface AdminStorageSummary {
  user_id: number
  full_name: string
  storage_quota_mb: number
  total_used_bytes: number
  private_used_bytes: number
  total_files_count: number
}

type ShareMode = 'private' | 'view_only' | 'downloadable'

export default function MediaArchiveTab() {
  const { user, isAdmin } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [items, setItems] = useState<ArchiveItem[]>([])
  const [ownerDownloadDefaults, setOwnerDownloadDefaults] = useState<Record<number, boolean>>({})
  const [selectedFolderOwnerId, setSelectedFolderOwnerId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'largest'>('newest')
  const [showLargestCleanup, setShowLargestCleanup] = useState(false)
  const [shareMode, setShareMode] = useState<ShareMode>('downloadable')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)
  const [myUsage, setMyUsage] = useState({ usedBytes: 0, quotaMb: 100 })
  const [adminSummaries, setAdminSummaries] = useState<AdminStorageSummary[]>([])
  const [quotaInputs, setQuotaInputs] = useState<Record<number, number>>({})
  const [savingQuotaId, setSavingQuotaId] = useState<number | null>(null)

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (!user) return
    loadAllMedia()
  }, [user])

  const loadAllMedia = async () => {
    if (!user) return
    setLoading(true)

    const [membersRes, archiveRes, legacyRes, usage] = await Promise.all([
      supabase
        .from('alumni')
        .select('id, full_name, profile_picture_url, allow_media_download, default_media_private')
        .eq('is_placeholder', false)
        .neq('full_name', 'System Administrator'),
      supabase
        .from('member_media_files')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('photo_gallery').select('*'),
      getUserStorageUsage(user.id),
    ])

    const nameMap: Record<number, string> = {}
    const dlMap: Record<number, boolean> = {}
    const membersList = membersRes.data ?? []

    for (const m of membersList) {
      nameMap[m.id] = m.full_name
      dlMap[m.id] = m.allow_media_download ?? true
      if (m.id === user.id) {
        if (m.default_media_private) setShareMode('private')
        else if (m.allow_media_download === false) setShareMode('view_only')
        else setShareMode('downloadable')
      }
    }
    setOwnerDownloadDefaults(dlMap)
    setMyUsage({ usedBytes: usage.usedBytes, quotaMb: usage.quotaMb })

    const combined: ArchiveItem[] = []
    const seenUrls = new Set<string>()
    const ownersWithProfileCopy = new Set<number>()

    for (const row of archiveRes.data ?? []) {
      if (row.is_profile_picture) {
        ownersWithProfileCopy.add(row.owner_id)
      }
      // Enforce owner privacy: private items are never shown to other members
      if (row.owner_id !== user.id && row.is_private) continue

      seenUrls.add(row.file_url)
      const perItemAllowDl =
        typeof row.allow_download === 'boolean'
          ? row.allow_download
          : dlMap[row.owner_id] ?? true

      combined.push({
        id: row.id,
        source: 'archive',
        ownerId: row.owner_id,
        ownerName: row.owner_name || nameMap[row.owner_id] || 'Member',
        folderCategory: row.folder_category || 'folder',
        fileName: row.file_name,
        fileUrl: row.file_url,
        storagePath: row.storage_path || '',
        mimeType: row.mime_type || '',
        fileSizeBytes: Number(row.file_size_bytes || 0),
        isPrivate: Boolean(row.is_private),
        allowDownload: perItemAllowDl,
        isProfilePicture: Boolean(row.is_profile_picture),
        createdAt: row.created_at,
      })
    }

    // Ensure every member's current profile picture appears in their folder
    for (const m of membersList) {
      if (m.profile_picture_url && !ownersWithProfileCopy.has(m.id) && !seenUrls.has(m.profile_picture_url)) {
        seenUrls.add(m.profile_picture_url)
        combined.push({
          id: -m.id,
          source: 'legacy',
          ownerId: m.id,
          ownerName: m.full_name,
          folderCategory: 'gallery',
          fileName: `${m.full_name} — Profile Picture`,
          fileUrl: m.profile_picture_url,
          storagePath: '',
          mimeType: 'image/jpeg',
          fileSizeBytes: 0,
          isPrivate: false,
          allowDownload: dlMap[m.id] ?? true,
          isProfilePicture: true,
          createdAt: new Date().toISOString(),
        })
      }
    }

    for (const row of legacyRes.data ?? []) {
      if (seenUrls.has(row.image_url)) continue
      seenUrls.add(row.image_url)
      combined.push({
        id: row.id,
        source: 'legacy',
        ownerId: row.alumni_id,
        ownerName: nameMap[row.alumni_id] || 'Member',
        folderCategory: 'gallery',
        fileName: row.description || 'Shared Photo',
        fileUrl: row.image_url,
        storagePath: '',
        mimeType: 'image/jpeg',
        fileSizeBytes: 0,
        isPrivate: false,
        allowDownload: dlMap[row.alumni_id] ?? true,
        isProfilePicture: (row.description || '').includes('Profile Picture Copy'),
        createdAt: row.created_at || new Date().toISOString(),
      })
    }

    setItems(combined)

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
      alert('Please enter a valid storage limit between 10 MB and 102400 MB.')
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
    await loadAllMedia()
  }

  const uploadSingleFile = async (file: File) => {
    if (!user) return
    const isImage = file.type.startsWith('image/')
    const isPrivate = shareMode === 'private'

    setUploading(true)
    const result = await uploadMemberArchiveFile({
      ownerId: user.id,
      ownerName: user.full_name,
      folderCategory: isImage ? 'gallery' : 'folder',
      file,
      isPrivate,
      isProfilePicture: false,
    })
    setUploading(false)

    if (!result.success) {
      alert(result.error || 'Upload failed.')
      return
    }

    // Store per-item download preference if supported
    await supabase
      .from('member_media_files')
      .update({
        allow_download: shareMode === 'downloadable',
        ...(descriptionInput.trim() ? { file_name: descriptionInput.trim() } : {}),
      })
      .eq('owner_id', user.id)
      .order('id', { ascending: false })
      .limit(1)

    setDescriptionInput('')
    await loadAllMedia()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadSingleFile(file)
  }

  const handleCameraCapture = async (dataUrl: string) => {
    setShowCamera(false)
    const arr = dataUrl.split(',')
    const bstr = atob(arr[1] || '')
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    const name = `${(descriptionInput.trim() || `Photo_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')}.jpg`
    const file = new File([u8arr], name, { type: 'image/jpeg' })
    await uploadSingleFile(file)
  }

  const handleChangeItemShareMode = async (item: ArchiveItem, nextMode: ShareMode) => {
    if (item.source !== 'archive' || item.ownerId !== user?.id) return
    await supabase
      .from('member_media_files')
      .update({
        is_private: nextMode === 'private',
        allow_download: nextMode === 'downloadable',
      })
      .eq('id', item.id)

    await loadAllMedia()
  }

  const handleDeleteItem = async (item: ArchiveItem) => {
    if (item.isProfilePicture) {
      alert('Profile pictures cannot be deleted. Only updating your profile picture replaces it.')
      return
    }
    if (!window.confirm(`Delete "${item.fileName}"?`)) return

    if (item.source === 'archive') {
      const res = await deleteMemberArchiveFile(item.id)
      if (!res.success) {
        alert(res.error || 'Could not delete file.')
        return
      }
    } else {
      await supabase.from('photo_gallery').delete().eq('id', item.id)
    }
    await loadAllMedia()
  }

  if (!user) return null

  const sortList = (list: ArchiveItem[]) => {
    const copy = [...list]
    if (sortBy === 'largest') {
      copy.sort((a, b) => Number(b.fileSizeBytes || 0) - Number(a.fileSizeBytes || 0))
    } else {
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return copy
  }

  const folderMap = new Map<number, { ownerId: number; ownerName: string; items: ArchiveItem[] }>()
  folderMap.set(user.id, { ownerId: user.id, ownerName: user.full_name, items: [] })

  for (const item of items) {
    if (!folderMap.has(item.ownerId)) {
      folderMap.set(item.ownerId, {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        items: [],
      })
    }
    folderMap.get(item.ownerId)!.items.push(item)
  }

  const folderList = Array.from(folderMap.values())
  const activeFolder = selectedFolderOwnerId ? folderMap.get(selectedFolderOwnerId) ?? null : null

  const myLargestFiles = [...items]
    .filter(f => f.ownerId === user.id && !f.isProfilePicture && f.source === 'archive')
    .sort((a, b) => Number(b.fileSizeBytes || 0) - Number(a.fileSizeBytes || 0))

  const isImageItem = (item: ArchiveItem) =>
    item.mimeType.startsWith('image/') ||
    item.folderCategory === 'gallery' ||
    item.fileUrl.startsWith('data:image/') ||
    /\.(jpeg|jpg|png|gif|webp)$/i.test(item.fileName)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Unified Upload & Storage Header */}
      <Card className="border-border/40 bg-card/70 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <ImageIcon className="h-5 w-5" />
              Photo Gallery &amp; Member Folders
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showLargestCleanup ? 'default' : 'outline'}
                onClick={() => setShowLargestCleanup(prev => !prev)}
                className={
                  showLargestCleanup
                    ? 'gold-gradient text-gold-foreground text-xs gap-1.5'
                    : 'text-xs gap-1.5 border-primary/40 text-primary'
                }
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {showLargestCleanup ? 'Hide Largest Files' : 'Largest Files Cleanup'}
              </Button>
              <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <HardDrive className="h-3.5 w-3.5" />
                Storage: {formatBytes(myUsage.usedBytes)} / {myUsage.quotaMb} MB
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Upload photos, videos, PDFs, or documents to your personal folder and choose whether each item is Private, Display Only, or Downloadable by members.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={descriptionInput}
              onChange={e => setDescriptionInput(e.target.value)}
              placeholder="Optional title / description for upload..."
              className="text-xs"
            />
            <select
              value={shareMode}
              onChange={e => setShareMode(e.target.value as ShareMode)}
              title="Choose Sharing & Download Permission"
              className="h-9 rounded-md border border-border/50 bg-background px-3 text-xs font-semibold"
            >
              <option value="downloadable">Share: Display &amp; Allow Download</option>
              <option value="view_only">Share: Display Only (No Download)</option>
              <option value="private">Private: Hidden from Other Members</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" onChange={handleFileUpload} className="hidden" />
            <Button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="gold-gradient text-gold-foreground font-semibold gap-2 text-xs"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : `Upload File / Photo to "${user.full_name}" Folder`}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => setShowCamera(true)}
              className="gap-1.5 text-xs border-primary/40 text-primary"
            >
              <Camera className="h-4 w-4" />
              Capture Photo
            </Button>
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
              <p className="text-xs text-muted-foreground">No deletable files in your archive.</p>
            ) : (
              myLargestFiles.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{item.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Size: <span className="font-bold text-primary">{formatBytes(item.fileSizeBytes)}</span> •{' '}
                      {formatFullDate(item.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteItem(item)}
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

      {/* Member Folders Grid or Selected Folder Contents */}
      {loading ? (
        <p className="py-8 text-center text-xs text-muted-foreground">Loading member folders...</p>
      ) : !activeFolder ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {folderList.map(folder => (
            <button
              key={folder.ownerId}
              type="button"
              onClick={() => setSelectedFolderOwnerId(folder.ownerId)}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/70 hover:border-primary/50 hover:bg-primary/5 p-4 text-left transition-all shadow-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{folder.ownerName}</p>
                <p className="text-xs text-muted-foreground">
                  {folder.items.length} item{folder.items.length === 1 ? '' : 's'}
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
                {activeFolder.ownerName}’s Gallery &amp; Files
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'newest' | 'largest')}
                  className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs font-semibold"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="largest">Sort: Largest Files First</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFolderOwnerId(null)}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Member Folders
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {activeFolder.items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No shared photos or files in this folder yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {sortList(activeFolder.items).map(item => {
                  const isOwner = item.ownerId === user.id
                  const canDownload = isOwner || (item.allowDownload && (ownerDownloadDefaults[item.ownerId] ?? true))
                  const canDelete = !item.isProfilePicture && (isOwner || userIsAdmin)
                  const currentItemMode: ShareMode = item.isPrivate
                    ? 'private'
                    : item.allowDownload
                    ? 'downloadable'
                    : 'view_only'

                  return (
                    <div
                      key={`${item.source}-${item.id}`}
                      className={`overflow-hidden rounded-xl border border-border/30 bg-card/85 flex flex-col justify-between ${
                        !canDownload ? 'select-none' : ''
                      }`}
                      onContextMenu={e => {
                        if (!canDownload) e.preventDefault()
                      }}
                    >
                      {isImageItem(item) ? (
                        <div className="relative bg-black/50">
                          <img
                            src={item.fileUrl}
                            draggable={canDownload}
                            className={`h-44 w-full object-cover ${!canDownload ? 'pointer-events-none select-none' : ''}`}
                            alt={item.fileName}
                          />
                          {item.isProfilePicture && (
                            <span className="absolute top-2 right-2 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-black">
                              Profile Picture
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-44 flex-col items-center justify-center gap-2 bg-muted/25 p-4 text-center">
                          <FileText className="h-10 w-10 text-primary" />
                          <p className="text-xs font-semibold text-foreground line-clamp-2">{item.fileName}</p>
                        </div>
                      )}

                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-foreground truncate">{item.fileName}</p>
                          {item.fileSizeBytes > 0 && (
                            <span className="shrink-0 text-[10px] font-semibold text-primary">
                              {formatBytes(item.fileSizeBytes)}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-muted-foreground">{formatFullDate(item.createdAt)}</p>

                        {/* Owner Per-Item Visibility / Download Controls */}
                        {isOwner && item.source === 'archive' && !item.isProfilePicture && (
                          <select
                            value={currentItemMode}
                            onChange={e => handleChangeItemShareMode(item, e.target.value as ShareMode)}
                            className="w-full h-7 rounded border border-border/50 bg-background px-2 text-[11px]"
                          >
                            <option value="downloadable">Display &amp; Allow Download</option>
                            <option value="view_only">Display Only (No Download)</option>
                            <option value="private">Private (Hidden)</option>
                          </select>
                        )}

                        {!isOwner && (
                          <div className="flex items-center gap-1 text-[10px]">
                            {canDownload ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <Globe className="h-3 w-3" /> Shared &amp; Downloadable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300">
                                <Eye className="h-3 w-3" /> Display Only
                              </span>
                            )}
                          </div>
                        )}

                        {isOwner && item.isPrivate && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                            <Lock className="h-3 w-3" /> Private to You
                          </span>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/20">
                          {canDownload ? (
                            <a
                              href={item.fileUrl}
                              download={item.fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Open / Download
                            </a>
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground">Download disabled</span>
                          )}

                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item)}
                              className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showCamera && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}


