import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import CameraModal from '@/components/shared/CameraModal'
import { readFileAsDataURL } from '@/lib/helpers'
import { User, Camera, Upload, MapPin, Heart, Shield, EyeOff, Save } from 'lucide-react'

export default function ProfileTab() {
  const { user } = useAuth()
  const [nickname, setNickname] = useState('')
  const [blood, setBlood] = useState('')
  const [status, setStatus] = useState('Employed')
  const [pic, setPic] = useState('')
  const [permAddr, setPermAddr] = useState('')
  const [permGeo, setPermGeo] = useState('')
  const [currAddr, setCurrAddr] = useState('')
  const [currGeo, setCurrGeo] = useState('')
  const [marital, setMarital] = useState('Single')
  const [wedding, setWedding] = useState('')
  const [divorce, setDivorce] = useState('')
  const [spouseName, setSpouseName] = useState('')
  const [spouseDob, setSpouseDob] = useState('')
  const [spouseDetails, setSpouseDetails] = useState('')
  const [diary, setDiary] = useState('')
  const [hidePeers, setHidePeers] = useState(false)
  const [hideAdmin, setHideAdmin] = useState(false)
  const [phoneCC, setPhoneCC] = useState('+91')
  const [phoneNum, setPhoneNum] = useState('')
  const [waCC, setWaCC] = useState('+91')
  const [waNum, setWaNum] = useState('')
  const [showCamera, setShowCamera] = useState(false)

  useEffect(() => {
    if (user) hydrate(user)
  }, [user])

  const hydrate = (d: any) => {
    setNickname(d.class_nickname || '')
    setBlood(d.blood_group || '')
    setStatus(d.current_status || 'Employed')
    setPic(d.profile_picture_url || '')
    setPermAddr(d.permanent_address || '')
    setPermGeo(d.permanent_geo_location || '')
    setCurrAddr(d.current_address || '')
    setCurrGeo(d.current_geo_location || '')
    setMarital(d.marital_status || 'Single')
    setWedding(d.wedding_date || '')
    setDivorce(d.divorce_date || '')
    setSpouseName(d.spouse_name || '')
    setSpouseDob(d.spouse_dob || '')
    setSpouseDetails(d.spouse_details || '')
    setDiary(d.diary_logs || '')
    setHidePeers(d.hide_from_peers || false)
    setHideAdmin(d.hide_from_admin || false)

    const cRaw = d.contact_number || ''
    const cParts = cRaw.split(' ')
    if (cParts.length > 1 && cParts[0].startsWith('+')) {
      setPhoneCC(cParts[0])
      setPhoneNum(cParts.slice(1).join(' '))
    } else {
      setPhoneCC('+91')
      setPhoneNum(cRaw)
    }

    const waRaw = d.whatsapp_number || ''
    const waParts = waRaw.split(' ')
    if (waParts.length > 1 && waParts[0].startsWith('+')) {
      setWaCC(waParts[0])
      setWaNum(waParts.slice(1).join(' '))
    } else {
      setWaCC('+91')
      setWaNum(waRaw)
    }
  }

  const handleSave = async () => {
    if (!user) return
    const finalWA = waNum ? `${waCC} ${waNum}` : ''
    const finalPh = phoneNum ? `${phoneCC} ${phoneNum}` : ''

    await supabase.from('alumni').update({
      class_nickname: nickname,
      whatsapp_number: finalWA,
      contact_number: finalPh,
      blood_group: blood,
      current_status: status,
      profile_picture_url: pic,
      permanent_address: permAddr,
      permanent_geo_location: permGeo,
      current_address: currAddr,
      current_geo_location: currGeo,
      marital_status: marital,
      wedding_date: wedding || null,
      divorce_date: divorce || null,
      spouse_name: spouseName,
      spouse_dob: spouseDob || null,
      spouse_details: spouseDetails,
      diary_logs: diary,
      hide_from_peers: hidePeers,
      hide_from_admin: hideAdmin,
    }).eq('id', user.id)
    alert('Profile Updated')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const data = await readFileAsDataURL(file)
      setPic(data)
    }
  }

  if (!user) return null

  return (
    <Card className="mx-auto max-w-2xl border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <User className="h-5 w-5" />
          Update Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nickname</Label><Input value={nickname} onChange={e => setNickname(e.target.value)} className="mt-1" /></div>
          <div><Label>Blood Group</Label><Input value={blood} onChange={e => setBlood(e.target.value)} className="mt-1" /></div>
          <div>
            <Label>Contact Number</Label>
            <div className="mt-1 flex gap-1">
              <Input className="w-1/4 text-center" value={phoneCC} onChange={e => setPhoneCC(e.target.value)} />
              <Input className="w-3/4" value={phoneNum} onChange={e => setPhoneNum(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>WhatsApp Number</Label>
            <div className="mt-1 flex gap-1">
              <Input className="w-1/4 text-center" value={waCC} onChange={e => setWaCC(e.target.value)} />
              <Input className="w-3/4" value={waNum} onChange={e => setWaNum(e.target.value)} />
            </div>
          </div>
          <div className="col-span-2">
            <Label>Current Career Status</Label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="Noble Services">Noble Services</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Business">Business</option>
              <option value="Self-Employed">Self-Employed</option>
              <option value="Employed">Employed</option>
            </select>
          </div>
        </div>

        <div>
          <Label>Profile Photo</Label>
          <Input value={pic} onChange={e => setPic(e.target.value)} className="mt-1" placeholder="URL or Data String" />
          <div className="mt-1.5 flex gap-2">
            <input type="file" accept="image/*" id="profile-pic-file" className="hidden" onChange={handleFileUpload} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5 border-primary/30 hover:shadow-primary/5" onClick={() => document.getElementById('profile-pic-file')?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload Image
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5 border-primary/30 hover:shadow-primary/5" onClick={() => setShowCamera(true)}>
              <Camera className="h-3.5 w-3.5" />
              Use Camera
            </Button>
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Permanent Address
          </Label>
          <Textarea value={permAddr} onChange={e => setPermAddr(e.target.value)} className="mt-1 h-12" />
        </div>
        <div><Label>Permanent Google Map Link</Label><Input value={permGeo} onChange={e => setPermGeo(e.target.value)} className="mt-1" placeholder="https://maps.google.com/..." /></div>
        <div>
          <Label className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Current Address
          </Label>
          <Textarea value={currAddr} onChange={e => setCurrAddr(e.target.value)} className="mt-1 h-12" />
        </div>
        <div><Label>Current Google Map Link</Label><Input value={currGeo} onChange={e => setCurrGeo(e.target.value)} className="mt-1" placeholder="https://maps.google.com/..." /></div>

        <hr className="border-border/30" />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-primary" />
              Marital Status
            </Label>
            <select value={marital} onChange={e => setMarital(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
            </select>
          </div>
          {marital !== 'Single' && <div><Label>Wedding Date</Label><Input type="date" value={wedding} onChange={e => setWedding(e.target.value)} className="mt-1" /></div>}
          {marital === 'Divorced' && <div><Label>Divorce Date</Label><Input type="date" value={divorce} onChange={e => setDivorce(e.target.value)} className="mt-1" /></div>}
        </div>

        {marital === 'Married' && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="space-y-2 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Spouse Name</Label><Input value={spouseName} onChange={e => setSpouseName(e.target.value)} className="mt-1" /></div>
                <div><Label>Spouse DOB</Label><Input type="date" value={spouseDob} onChange={e => setSpouseDob(e.target.value)} className="mt-1" /></div>
              </div>
              <div><Label>Spouse Details</Label><Input value={spouseDetails} onChange={e => setSpouseDetails(e.target.value)} className="mt-1" /></div>
            </CardContent>
          </Card>
        )}

        <div><Label>Personal Timeline / Notes</Label><Textarea value={diary} onChange={e => setDiary(e.target.value)} className="mt-1 h-24 font-mono text-xs" placeholder="Add important life events here..." /></div>

        <hr className="border-border/30" />
        <h3 className="flex items-center gap-2 font-bold text-primary">
          <Shield className="h-4 w-4" />
          Privacy Settings
        </h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hidePeers} onCheckedChange={v => setHidePeers(!!v)} />
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            Hide my profile from classmates
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={hideAdmin} onCheckedChange={v => setHideAdmin(!!v)} />
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            Hide my profile from Admin
          </label>
        </div>

        <Button onClick={handleSave} className="w-full gold-gradient text-gold-foreground gap-2">
          <Save className="h-4 w-4" />
          Save Profile Settings
        </Button>
      </CardContent>

      {showCamera && <CameraModal onCapture={data => { setPic(data); setShowCamera(false) }} onClose={() => setShowCamera(false)} />}
    </Card>
  )
}
