import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Building2 } from 'lucide-react'

export default function AlumniAssociationHome() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <Building2 className="mb-4 h-16 w-16 text-primary" />
      <h1 className="mb-4 text-4xl font-bold text-foreground">Alumni Association</h1>
      <p className="mb-8 text-muted-foreground">Welcome to the dedicated Alumni Association portal.</p>
      
      <Button onClick={() => navigate('/dashboard')} size="lg" className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Return to Fenestrians Home
      </Button>
    </div>
  )
}
