'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Avatar,
  Switch,
  Select,
  SelectItem,
} from '@heroui/react'
import { Upload, X, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import ImageCropper from '@/components/ImageCropper'

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  system_prompt: string
  capabilities?: string[]
  settings: any
  is_active: boolean
  avatar_url?: string
}

interface EditAgentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  agent: AIAgent | null
}

const MODEL_OPTIONS = [
  { key: 'claude-opus-4', label: 'Claude Opus 4' },
  { key: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
  { key: 'gemini-2.5', label: 'Gemini 2.5' },
  { key: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
  { key: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
]

const CAPABILITY_OPTIONS = [
  'orchestration',
  'task_management',
  'content_review',
  'agent_spawning',
  'coding',
  'debugging',
  'research',
  'implementation',
  'writing',
  'analysis',
  'design',
  'communication',
]

export default function EditAgentModal({ isOpen, onClose, onSuccess, agent }: EditAgentModalProps) {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Form state
  const [formData, setFormData] = useState<Partial<AIAgent>>({
    name: '',
    slug: '',
    role: '',
    model: '',
    system_prompt: '',
    capabilities: [],
    settings: {},
    is_active: true,
    avatar_url: '',
  })

  // Initialize form when agent changes
  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        slug: agent.slug,
        role: agent.role,
        model: agent.model,
        system_prompt: agent.system_prompt || '',
        capabilities: agent.capabilities || [],
        settings: agent.settings || {},
        is_active: agent.is_active,
        avatar_url: agent.avatar_url || '',
      })
    }
  }, [agent])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !agent) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Create object URL for the cropper
    const imageUrl = URL.createObjectURL(file)
    setSelectedImage(imageUrl)
    setCropperOpen(true)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!agent) return

    setUploading(true)
    try {
      const fileName = `agent-${agent.id}-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update local state
      setFormData({ ...formData, avatar_url: publicUrl })

      // Immediately sync avatar to both tables for consistency
      await Promise.all([
        supabase.from('ai_agents').update({ avatar_url: publicUrl }).eq('id', agent.id),
        supabase.from('users').update({ avatar_url: publicUrl }).eq('slug', agent.slug),
      ])

      toast.success('Avatar updated everywhere')
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast.error('Failed to upload avatar')
    } finally {
      setUploading(false)
      // Clean up object URL
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage)
        setSelectedImage(null)
      }
    }
  }

  const handleSave = async () => {
    if (!agent) return
    setSaving(true)
    try {
      // Update ai_agents table
      const { error } = await supabase
        .from('ai_agents')
        .update({
          name: formData.name,
          role: formData.role,
          model: formData.model,
          system_prompt: formData.system_prompt,
          capabilities: formData.capabilities,
          settings: formData.settings,
          is_active: formData.is_active,
          avatar_url: formData.avatar_url,
        })
        .eq('id', agent.id)

      if (error) throw error

      // ALSO update the users table (sync avatar across platform)
      // Find user by slug (agents have matching slug in users table)
      if (formData.avatar_url) {
        const { error: userError } = await supabase
          .from('users')
          .update({ 
            avatar_url: formData.avatar_url,
            name: formData.name, // Keep name in sync too
          })
          .eq('slug', agent.slug)
        
        if (userError) {
          console.error('Error syncing to users table:', userError)
          // Don't fail the whole save, just log it
        }
      }

      toast.success('Agent profile updated')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error saving agent:', error)
      toast.error(error?.message || 'Failed to save agent profile')
    } finally {
      setSaving(false)
    }
  }

  const toggleCapability = (capability: string) => {
    const current = formData.capabilities || []
    const updated = current.includes(capability)
      ? current.filter(c => c !== capability)
      : [...current, capability]
    setFormData({ ...formData, capabilities: updated })
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Edit Agent Profile</h2>
          <p className="text-sm text-default-500">Update AI agent details and configuration</p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <Avatar 
                src={formData.avatar_url || undefined} 
                name={formData.name}
                className="w-24 h-24 text-2xl"
              />
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <Button 
                size="sm" 
                variant="flat" 
                startContent={<Upload className="w-4 h-4" />}
                onPress={() => fileInputRef.current?.click()}
                isLoading={uploading}
              >
                Change Avatar
              </Button>
            </div>

            {/* Image Cropper Modal */}
            {selectedImage && (
              <ImageCropper
                isOpen={cropperOpen}
                onClose={() => {
                  setCropperOpen(false)
                  if (selectedImage) {
                    URL.revokeObjectURL(selectedImage)
                    setSelectedImage(null)
                  }
                }}
                imageSrc={selectedImage}
                onCropComplete={handleCroppedImage}
                aspectRatio={1}
                cropShape="round"
              />
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Agent Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Ax, Tony"
              />
              <Input
                label="Role/Title"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g., umbrella_ceo, coder"
              />
            </div>

            {/* Model Selection */}
            <Select
              label="Model"
              selectedKeys={formData.model ? [formData.model] : []}
              onSelectionChange={(keys) => setFormData({ ...formData, model: Array.from(keys)[0] as string })}
            >
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.key}>{model.label}</SelectItem>
              ))}
            </Select>

            {/* System Prompt */}
            <Textarea
              label="System Prompt"
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              placeholder="Define the agent's personality and instructions..."
              minRows={4}
            />

            {/* Capabilities */}
            <div>
              <label className="text-sm font-medium text-default-700 mb-2 block">
                Capabilities
              </label>
              <div className="flex flex-wrap gap-2">
                {CAPABILITY_OPTIONS.map((cap) => (
                  <Button
                    key={cap}
                    size="sm"
                    color={formData.capabilities?.includes(cap) ? 'primary' : 'default'}
                    variant={formData.capabilities?.includes(cap) ? 'solid' : 'flat'}
                    onPress={() => toggleCapability(cap)}
                    className="cursor-pointer"
                  >
                    {cap.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Active Status</p>
                <p className="text-sm text-default-500">Whether this agent is available for tasks</p>
              </div>
              <Switch
                isSelected={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
              />
            </div>

            {/* Settings (JSON) - Optional */}
            <div>
              <label className="text-sm font-medium text-default-700 mb-2 block">
                Advanced Settings (JSON)
              </label>
              <Textarea
                value={JSON.stringify(formData.settings || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setFormData({ ...formData, settings: parsed })
                  } catch {
                    // Keep as string if invalid JSON
                  }
                }}
                placeholder='{"working_hours": "00:00-23:59", "autonomy_level": "high"}'
                minRows={3}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSave}
            isLoading={saving}
            startContent={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}