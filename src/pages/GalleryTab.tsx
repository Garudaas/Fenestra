import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  uploadMemberArchiveFile,
  deleteMemberArchiveFile,
  getUserStorageUsage,
  formatBytes,
} from '@/lib/fenestriansCore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import {
  Image,
  Camera,
  Upload,
  Sparkles,
  FolderOpen,
  ArrowLeft,
  Trash2,
  Download,
  Lock,
  HardDrive,
} from 'lucide-react'

interface GalleryItem {
  id: number
  source: 'archive' | 'legacy'
  ownerId: number
  ownerName: string
  imageUrl: string
  description: string
  isPrivate: boolean
  isProfilePicture: boolean
  fileSizeBytes: number
  createdAt: string
}

export default function GalleryTab() {
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [ownerPermissions, setOwnerPermissions] = useState<Record<number, boolean>>({})
  const [selectedFolderOwnerId, setSelectedFolderOwnerId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'largest'>('newest')
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isPrivateUpload, setIsPrivateUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [storageInfo, setStorageInfo] = useState({ usedBytes: 0, quotaMb: 100 })

  const userIsAdmin = Boolean(isAdmin || user?.is_admin)

  useEffect(() => {
    if (user) loadGallery()
  }, [user])

  const loadGallery = async () => {
    if (!user) return

    const [membersRes, archiveRes, legacyRes, usage] = await Promise.all([
      supabase
        .from('alumni')
        .select('id, full_name, allow_media_download, default_media_private')
        .eq('is_placeholder', false),
      supabase
        .from('member_media_files')
        .select('*')
        .eq('folder_category', 'gallery')
        .order('created_at', { ascending: false }),
      supabase.from('photo_gallery').select('*'),
      getUserStorageUsage(user.id),
    ])

    const nameMap: Record<number, string> = {}
    const permMap: Record<number, boolean> = {}

    for (const m of membersRes.data ?? []) {
      nameMap[m.id] = m.full_name
      permMap[m.id] = m.allow_media_download ?? true
      if (m.id === user.id) {
        setIsPrivateUpload(m.default_media_private ?? false)
      }
    }
    setOwnerPermissions(permMap)
    setStorageInfo({ usedBytes: usage.usedBytes, quotaMb: usage.quotaMb })

    const combined: GalleryItem[] = []
    const archiveUrls = new Set<string>()

    for (const row of archiveRes.data ?? []) {
      if (row.owner_id !== user.id && row.is_private) continue
      archiveUrls.add(row.file_url)
      combined.push({
        id: row.id,
        source: 'archive',
        ownerId: row.owner_id,
        ownerName: row.owner_name || nameMap[row.owner_id] || 'Member',
        imageUrl: row.file_url,
        description: row.file_name,
        isPrivate: Boolean(row.is_private),
        isProfilePicture: Boolean(row.is_profile_picture),
        fileSizeBytes: Number(row.file_size_bytes || 0),
        createdAt: row.created_at,
      })
    }

    for (const row of legacyRes.data ?? []) {
      if (archiveUrls.has(row.image_url)) continue
      combined.push({
        id: row.id,
        source: 'legacy',
        ownerId: row.alumni_id,
        ownerName: nameMap[row.alumni_id] || 'Member',
        imageUrl: row.image_url,
        description: row.description || 'Shared Photo',
        isPrivate: false,
        isProfilePicture: (row.description || '').includes('Profile Picture Copy'),
        fileSizeBytes: 0,
        createdAt: row.created_at || new Date().toISOString(),
      })
    }

    setItems(combined)
  }

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',')
    const mimeMatch = arr[0].match(/:(.*?);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    const bstr = atob(arr[1] || '')
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new File([u8arr], filename, { type: mime })
  }

  const handleUpload = async () => {
    if (!user || (!url && !selectedFile)) return

    setUploading(true)
    try {
      let fileToUpload = selectedFile
      if (!fileToUpload && url.startsWith('data:')) {
        const cleanName = (desc.trim() || `photo_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_') + '.jpg'
        fileToUpload = dataUrlToFile(url, cleanName)
      }

      if (fileToUpload) {
        const res = await uploadMemberArchiveFile({
          ownerId: user.id,
          ownerName: user.full_name,
          folderCategory: 'gallery',
          file: fileToUpload,
          isPrivate: isPrivateUpload,
          isProfilePicture: false,
        })
        if (!res.success) {
          alert(res.error || 'Upload failed.')
          setUploading(false)
          return
        }
      } else {
        const { usedBytes, quotaBytes, quotaMb } = await getUserStorageUsage(user.id)
        if (usedBytes >= quotaBytes) {
          alert(
            `Storage space exceeded (${formatBytes(usedBytes)} used of ${quotaMb} MB limit). Further media/file sharing is not allowed.`
          )
          setUploading(false)
          return
        }

        await supabase.from('member_media_files').insert([
          {
            owner_id: user.id,
            owner_name: user.full_name,
            folder_category: 'gallery',
            file_name: desc.trim() || 'Shared Photo Link',
            file_url: url.trim(),
            storage_path: `external_${user.id}_${Date.now()}`,
            mime_type: 'image/jpeg',
            file_size_bytes: 1024,
            is_private: isPrivateUpload,
            is_profile_picture: false,
          },
        ])
      }

      setUrl('')
      setDesc('')
      setSelectedFile(null)
      await loadGallery()
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const data = await readFileAsDataURL(file)
      setUrl(data)
    }
  }

  const handleDeleteItem = async (item: GalleryItem) => {
    if (item.isProfilePicture) {
      alert('Profile pictures cannot be deleted. Only the member can update their profile picture.')
      return
    }
    if (!window.confirm('Delete this media item?')) return

    if (item.source === 'archive') {
      const res = await deleteMemberArchiveFile(item.id)
      if (!res.success) {
        alert(res.error || 'Could not delete item.')
        return
      }
    } else {
      await supabase.from('photo_gallery').delete().eq('id', item.id)
    }
    await loadGallery()
  }

  if (!user) return null

  const sortPhotosList = (list: GalleryItem[]) => {
    const copy = [...list]
    if (sortBy === 'largest') {
      copy.sort((a, b) => Number(b.fileSizeBytes || 0) - Number(a.fileSizeBytes || 0))
    } else {
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return copy
  }

  const folderMap = new Map<number, { ownerId: number; ownerName: string; photos: GalleryItem[] }>()
  folderMap.set(user.id, { ownerId: user.id, ownerName: user.full_name, photos: [] })

  for (const item of items) {
    if (!folderMap.has(item.ownerId)) {
      folderMap.set(item.ownerId, {
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        photos: [],
      })
    }
    folderMap.get(item.ownerId)!.photos.push(item)
  }

  const folders = Array.from(folderMap.values())
  const activeFolder = selectedFolderOwnerId ? folderMap.get(selectedFolderOwnerId) ?? null : null

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Image className="h-5 w-5" />
              Photo Gallery &amp; Member Media Archives
            </CardTitle>
            <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <HardDrive className="h-3.5 w-3.5" />
              {formatBytes(storageInfo.usedBytes)} / {storageInfo.quotaMb} MB
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={url}
              onChange={e => {
                setUrl(e.target.value)
                setSelectedFile(null)
              }}
              placeholder="Image URL or select/capture below"
            />
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Photo / Media Description" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*,video/*" id="gallery-file" className="hidden" onChange={handleFileSelect} />
            <Button
              variant="outline"
              size="sm"
              title="Select Media File"
              onClick={() => document.getElementById('gallery-file')?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Select Media
            </Button>
            <Button
              variant="outline"
              size="sm"
              title="Capture Photo with Camera"
              onClick={() => setShowCamera(true)}
            >
              <Camera className="h-4 w-4 mr-1" />
              Capture Photo
            </Button>

            <label className="ml-auto flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivateUpload}
                onChange={e => setIsPrivateUpload(e.target.checked)}
                className="h-4 w-4 accent-amber-500"
              />
              <span>Keep private (do not share with others)</span>
            </label>
          </div>
          <Button
            onClick={handleUpload}
            disabled={uploading}
            title="Upload to Your Gallery Folder"
            className="gold-gradient text-gold-foreground w-full"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : `Save to "${user.full_name}" Gallery Folder`}
          </Button>
        </CardContent>
      </Card>

      {!activeFolder ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {folders.map(folder => (
            <button
              key={folder.ownerId}
              type="button"
              title={`Open ${folder.ownerName}'s Gallery Folder`}
              onClick={() => setSelectedFolderOwnerId(folder.ownerId)}
              className="flex flex-col items-start gap-2 rounded-xl border border-border/40 bg-card/70 hover:border-primary/50 hover:bg-primary/5 p-4 text-left transition-all shadow-sm"
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {folder.photos.length} item{folder.photos.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground truncate w-full">{folder.ownerName}</p>
            </button>
          ))}
        </div>
      ) : (
        <Card className="border-border/40 bg-card/70">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base text-primary">
                <FolderOpen className="h-5 w-5" />
                {activeFolder.ownerName}’s Gallery Folder
              </CardTitle>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as 'newest' | 'largest')}
                  title="Sort Gallery Media"
                  className="h-8 rounded-md border border-border/50 bg-background px-2.5 text-xs font-semibold"
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="largest">Sort: Largest Files First</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  title="Back to All Member Folders"
                  onClick={() => setSelectedFolderOwnerId(null)}
                  className="gap-1.5 text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Folders
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeFolder.photos.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No media in this folder yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {sortPhotosList(activeFolder.photos).map(img => {
                  const canDownload =
                    img.ownerId === user.id || (ownerPermissions[img.ownerId] ?? true)
                  const canDelete =
                    !img.isProfilePicture && (img.ownerId === user.id || userIsAdmin)

                  return (
                    <div
                      key={`${img.source}-${img.id}`}
                      className={`overflow-hidden rounded-xl border border-border/30 bg-card/80 flex flex-col justify-between ${
                        !canDownload ? 'select-none' : ''
                      }`}
                      onContextMenu={e => {
                        if (!canDownload) e.preventDefault()
                      }}
                    >
                      <div className="relative bg-black/50">
                        <img
                          src={img.imageUrl}
                          draggable={canDownload}
                          className={`h-48 w-full object-cover ${!canDownload ? 'pointer-events-none select-none' : ''}`}
                          alt={img.description}
                        />
                        {img.isPrivate && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                            <Lock className="h-2.5 w-2.5" />
                            Private
                          </span>
                        )}
                        {img.isProfilePicture && (
                          <span className="absolute top-2 right-2 rounded bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-black">
                            Profile Copy
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-foreground truncate">{img.description}</p>
                          {img.fileSizeBytes > 0 && (
                            <span className="shrink-0 text-[10px] font-semibold text-primary">
                              {formatBytes(img.fileSizeBytes)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {canDownload ? (
                            <a
                              href={img.imageUrl}
                              download={img.description}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Save Media"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                            >
                              <Download className="h-3 w-3" />
                              Save
                            </a>
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground">View only</span>
                          )}

                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Delete Media"
                              onClick={() => handleDeleteItem(img)}
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
          onCapture={data => {
            setUrl(data)
            setSelectedFile(null)
            setShowCamera(false)
          }}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
