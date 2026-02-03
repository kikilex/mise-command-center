'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Button, 
  Input, 
  Textarea, 
  Card, 
  CardBody, 
  Avatar, 
  Select, 
  SelectItem,
  Spinner
} from '@heroui/react'
import { toast } from 'react-hot-toast'
import Navbar from '@/components/Navbar'

interface Profile {
  id: string
  email: string
  name: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  timezone: string
  status: string
  status_message: string | null
  phone: string | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          timezone: profile.timezone,
          status: profile.status,
          status_message: profile.status_message,
          phone: profile.phone,
        })
        .eq('id', profile.id)

      if (error) throw error
      toast.success('Profile updated')
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: publicUrl })
      toast.success('Avatar updated')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Failed to upload avatar')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Profile not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar user={profile} />
      
      <main className="max-w-3xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
        
        <Card>
          <CardBody className="gap-6 p-8">
            <div className="flex flex-col items-center gap-4 mb-4">
              <Avatar 
                src={profile.avatar_url || undefined} 
                name={profile.display_name || profile.name}
                className="w-32 h-32 text-4xl"
              />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
              <Button 
                size="sm" 
                variant="flat" 
                onPress={() => fileInputRef.current?.click()}
                isLoading={uploading}
              >
                Change Photo
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Full Name" 
                value={profile.name} 
                isDisabled 
              />
              <Input 
                label="Email" 
                value={profile.email} 
                isDisabled 
              />
              <Input 
                label="Display Name" 
                value={profile.display_name || ''} 
                onChange={(e) => setProfile({...profile, display_name: e.target.value})}
                placeholder="How you want to be called"
              />
              <Input 
                label="Phone" 
                value={profile.phone || ''} 
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
                placeholder="+1 xxx xxx xxxx"
              />
            </div>

            <Textarea 
              label="Bio" 
              value={profile.bio || ''} 
              onChange={(e) => setProfile({...profile, bio: e.target.value})}
              placeholder="Tell us about yourself..."
              minRows={3}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select 
                label="Timezone" 
                selectedKeys={[profile.timezone]}
                onSelectionChange={(keys) => setProfile({...profile, timezone: Array.from(keys)[0] as string})}
              >
                <SelectItem key="America/New_York">America/New_York</SelectItem>
                <SelectItem key="UTC">UTC</SelectItem>
                {/* Add more timezones */}
              </Select>

              <Select 
                label="Status" 
                selectedKeys={[profile.status]}
                onSelectionChange={(keys) => setProfile({...profile, status: Array.from(keys)[0] as string})}
              >
                <SelectItem key="active">Active</SelectItem>
                <SelectItem key="away">Away</SelectItem>
                <SelectItem key="busy">Busy</SelectItem>
                <SelectItem key="offline">Offline</SelectItem>
              </Select>
            </div>

            <Input 
              label="Status Message" 
              value={profile.status_message || ''} 
              onChange={(e) => setProfile({...profile, status_message: e.target.value})}
              placeholder="What are you working on?"
            />

            <div className="flex justify-end mt-4">
              <Button 
                color="primary" 
                size="lg" 
                onPress={handleSave}
                isLoading={saving}
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
