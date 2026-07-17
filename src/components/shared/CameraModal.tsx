import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Camera, X } from 'lucide-react'

interface CameraModalProps {
  onCapture: (dataUrl: string) => void
  onClose: () => void
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err: any) {
      alert('Camera error: ' + err.message)
      onClose()
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg')
    stopCamera()
    onCapture(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <Card className="w-full max-w-sm space-y-3 border-border/40 bg-card/80 backdrop-blur-xl p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
          <Camera className="h-4 w-4" />
          Live Device Capture
        </h3>
        <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded bg-black object-cover" />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { stopCamera(); onClose() }}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button size="sm" className="gold-gradient text-gold-foreground gap-1.5" onClick={capture}>
            <Camera className="h-3.5 w-3.5" />
            Capture Photo
          </Button>
        </div>
      </Card>
    </div>
  )
}
