'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import IconPicker from './IconPicker'

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  icon: string | null
  color: string | null
  space_id: string
}

interface EditProjectModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#84cc16', // Lime
]

const STATUS_OPTIONS = [
  { key: 'active', label: 'Active' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export default function EditProjectModal({ project, isOpen, onClose, onSuccess }: EditProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('active')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [icon, setIcon] = useState('FolderKanban')
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (project && isOpen) {
      setName(project.name || '')
      setDescription(project.description || '')
      setStatus(project.status || 'active')
      setColor(project.color || COLOR_OPTIONS[0])
      setIcon(project.icon || 'FolderKanban')
    }
  }, [project, isOpen])

  async function handleSubmit() {
    if (!project || !name.trim()) {
      showErrorToast(new Error('Project name is required'), 'Validation Error')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          status,
          color,
          icon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', project.id)

      if (error) throw error

      showSuccessToast('Project updated successfully')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Update project error:', error)
      showErrorToast(error, 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Edit Project</h2>
          <p className="text-sm font-normal text-default-500">
            Update project settings
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-shrink-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block px-1">Icon</label>
                <IconPicker value={icon} onChange={setIcon} />
              </div>
              <div className="flex-1">
                <Input
                  label="Project Name"
                  placeholder="e.g., Website Redesign"
                  value={name}
                  onValueChange={setName}
                  isRequired
                  variant="bordered"
                />
              </div>
            </div>

            <Textarea
              label="Description"
              placeholder="What is this project about?"
              value={description}
              onValueChange={setDescription}
              variant="bordered"
              minRows={2}
            />

            <Select
              label="Status"
              selectedKeys={[status]}
              onChange={(e) => setStatus(e.target.value)}
              variant="bordered"
            >
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>

            <div>
              <label className="text-sm font-medium text-default-700 mb-2 block">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c 
                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSubmit} 
            isLoading={saving}
            isDisabled={!name.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
