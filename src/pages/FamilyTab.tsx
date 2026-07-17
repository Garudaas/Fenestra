import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Heart, Plus, Pencil, Trash2, Lock, AlertTriangle, Users } from 'lucide-react'

export default function FamilyTab() {
  const { user } = useAuth()
  const [members, setMembers] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const [relationship, setRelationship] = useState('Child')
  const [customRel, setCustomRel] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('')
  const [dob, setDob] = useState('')
  const [bloodGroup, setBloodGroup] = useState('')
  const [edu, setEdu] = useState('Toddler')
  const [eduSpec, setEduSpec] = useState('')
  const [gradYear, setGradYear] = useState('')
  const [career, setCareer] = useState('')
  const [bio, setBio] = useState('')
  const [needsSupport, setNeedsSupport] = useState(false)
  const [supportDetails, setSupportDetails] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  useEffect(() => {
    loadFamily()
  }, [user])

  const loadFamily = async () => {
    if (!user) return
    const { data } = await supabase.from('family_members').select('*').eq('alumni_id', user.id)
    if (data) setMembers(data)
  }

  const resetForm = () => {
    setEditingId(null)
    setRelationship('Child')
    setCustomRel('')
    setName('')
    setGender('')
    setDob('')
    setBloodGroup('')
    setEdu('Toddler')
    setEduSpec('')
    setGradYear('')
    setCareer('')
    setBio('')
    setNeedsSupport(false)
    setSupportDetails('')
    setIsPrivate(false)
  }

  const handleSave = async () => {
    if (!user || !name) return
    const payload = {
      alumni_id: user.id,
      relationship: relationship === 'Other' ? customRel || 'Other' : relationship,
      name,
      dob: dob || null,
      blood_group: bloodGroup,
      is_private: isPrivate,
      needs_support: needsSupport,
      support_details: supportDetails,
    }

    if (editingId) {
      const { alumni_id, ...updatePayload } = payload
      await supabase.from('family_members').update(updatePayload).eq('id', editingId)
      alert('Updated successfully!')
    } else {
      await supabase.from('family_members').insert([payload])
    }
    resetForm()
    loadFamily()
  }

  const handleEdit = async (id: string) => {
    const { data } = await supabase.from('family_members').select('*').eq('id', id).single()
    if (!data) return
    setEditingId(id)
    setName(data.name || '')
    setRelationship(data.relationship || 'Child')
    setDob(data.dob || '')
    setBloodGroup(data.blood_group || '')
    setSupportDetails(data.support_details || '')
    setNeedsSupport(data.needs_support || false)
    setIsPrivate(data.is_private || false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this family member?')) return
    await supabase.from('family_members').delete().eq('id', id)
    loadFamily()
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card className="border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Heart className="h-5 w-5" />
            {editingId ? 'Edit' : 'Add'} Family Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Relationship *</Label>
              <select value={relationship} onChange={e => setRelationship(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="Child">Child</option>
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Other">Other Relation</option>
              </select>
            </div>
            <div><Label>Full Name *</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1" /></div>
          </div>

          {relationship === 'Other' && (
            <div>
              <Label className="text-primary">Specify Custom Relationship *</Label>
              <Input value={customRel} onChange={e => setCustomRel(e.target.value)} className="mt-1" placeholder="e.g., Father-in-law, Cousin" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div><Label>Gender</Label><Input value={gender} onChange={e => setGender(e.target.value)} className="mt-1" /></div>
            <div><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} className="mt-1" /></div>
            <div><Label>Blood Group</Label><Input value={bloodGroup} onChange={e => setBloodGroup(e.target.value)} className="mt-1" /></div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Education Level</Label>
              <select value={edu} onChange={e => setEdu(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="Toddler">Toddler</option>
                <option value="At School">At School</option>
                <option value="Graduate">Graduate</option>
                <option value="Post Graduate">Post Graduate</option>
                <option value="PhD">PhD</option>
                <option value="Diploma">Diploma</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div><Label>Education Details</Label><Input value={eduSpec} onChange={e => setEduSpec(e.target.value)} className="mt-1" /></div>
          </div>

          {relationship !== 'Child' && relationship !== 'Spouse' && (
            <div><Label>Graduation Year</Label><Input type="number" value={gradYear} onChange={e => setGradYear(e.target.value)} className="mt-1" /></div>
          )}

          <div><Label>Career Profile</Label><Textarea value={career} onChange={e => setCareer(e.target.value)} className="mt-1 h-12" /></div>
          <div><Label>Personal Notes</Label><Textarea value={bio} onChange={e => setBio(e.target.value)} className="mt-1 h-12" /></div>

          <hr className="border-border/30" />
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="space-y-2 p-3">
              <label className="flex items-center gap-2 font-bold text-destructive">
                <Checkbox checked={needsSupport} onCheckedChange={v => setNeedsSupport(!!v)} />
                <AlertTriangle className="h-4 w-4" />
                Highlight: This member needs assistance/support
              </label>
              <Input value={supportDetails} onChange={e => setSupportDetails(e.target.value)} placeholder="Describe the help needed..." />
            </CardContent>
          </Card>

          <label className="flex items-center gap-2 font-bold text-primary">
            <Checkbox checked={isPrivate} onCheckedChange={v => setIsPrivate(!!v)} />
            <Lock className="h-4 w-4" />
            Keep this family member's details private
          </label>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1 gold-gradient text-gold-foreground gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? 'Update' : 'Save'} Family Member
            </Button>
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      {members.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary/60 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Family Members
          </h3>
          {members.map(f => (
            <Card key={f.id} className="border-border/30 bg-muted/20 hover:border-primary/20 transition-colors">
              <CardContent className="flex items-center justify-between p-3">
                <span className="text-sm">
                  {f.name} ({f.relationship}) {f.is_private && <Lock className="inline h-3.5 w-3.5 text-primary" />}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary hover:bg-primary/10" onClick={() => handleEdit(f.id)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
