import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import { Image, Camera, Upload, Sparkles } from 'lucide-react'

export default function GalleryTab() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [showCamera, setShowCamera] = useState(false)

  useEffect(() => { loadGallery() }, [])

  const loadGallery = async () => {
    const { data } = await supabase.from('photo_gallery').select('*')
    if (data) setPhotos(data)
  }

  const handleUpload = async () => {
    if (!user || !url) return
    await supabase.from('photo_gallery').insert([{ alumni_id: user.id, image_url: url, description: desc }])
    setUrl(''); setDesc(''); loadGallery()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { const data = await readFileAsDataURL(file); setUrl(data) }
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Image className="h-5 w-5" />
            Add Photo to Gallery
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="Image URL or Data String" />
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Photo Description" />
          </div>
          <div className="flex gap-2">
            <input type="file" accept="image/*" id="gallery-file" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" size="sm" onClick={() => document.getElementById('gallery-file')?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              Select Image
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCamera(true)}>
              <Camera className="h-4 w-4 mr-1" />
              Capture Photo
            </Button>
          </div>
          <Button onClick={handleUpload} className="gold-gradient text-gold-foreground w-full">
            <Sparkles className="h-4 w-4 mr-2" />
            Upload Photo
          </Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {photos.map(img => (
          <div key={img.id} className="overflow-hidden rounded-xl border border-border/30 bg-card/60 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5">
            <img src={img.image_url} className="w-full object-cover" alt={img.description || ''} />
          </div>
        ))}
      </div>
      {showCamera && <CameraModal onCapture={data => { setUrl(data); setShowCamera(false) }} onClose={() => setShowCamera(false)} />}
    </div>
  )
}
