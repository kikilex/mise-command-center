'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Textarea,
  Spinner,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Sparkles, Plus, Trash2, RefreshCw, ChevronUp, ChevronDown, Copy } from '@/lib/icons'

interface ContentPrompt {
  id: string
  content_id: string
  scene_number: number
  text: string
  duration_seconds: number
  actor_prompt: string | null
  image_url: string | null
  image_status: 'pending' | 'generating' | 'generated' | 'failed'
  notes: string | null
}

interface PromptsSectionProps {
  contentId: string
  script: string
  actorPromptBase?: string
  onPromptsChange?: (prompts: ContentPrompt[]) => void
}

export default function PromptsSection({ 
  contentId, 
  script, 
  actorPromptBase,
  onPromptsChange 
}: PromptsSectionProps) {
  const [prompts, setPrompts] = useState<ContentPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [splitting, setSplitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadPrompts()
  }, [contentId])

  async function loadPrompts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('content_prompts')
        .select('*')
        .eq('content_id', contentId)
        .order('scene_number')

      if (error) throw error
      setPrompts(data || [])
      onPromptsChange?.(data || [])
    } catch (error) {
      console.error('Load prompts error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSplitWithAI() {
    if (!script?.trim()) {
      showErrorToast(null, 'No script to split')
      return
    }

    setSplitting(true)
    try {
      const response = await fetch('/api/content/split-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId,
          script,
          actor_prompt_base: actorPromptBase,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to split prompts')
      }

      showSuccessToast(`Split into ${data.count} prompts`)
      loadPrompts()
    } catch (error) {
      console.error('Split error:', error)
      showErrorToast(error, 'Failed to split script')
    } finally {
      setSplitting(false)
    }
  }

  async function handleUpdatePrompt(prompt: ContentPrompt) {
    try {
      const { error } = await supabase
        .from('content_prompts')
        .update({
          text: prompt.text,
          duration_seconds: prompt.duration_seconds,
          actor_prompt: prompt.actor_prompt,
          notes: prompt.notes,
        })
        .eq('id', prompt.id)

      if (error) throw error
      showSuccessToast('Prompt updated')
      setEditingId(null)
      loadPrompts()
    } catch (error) {
      showErrorToast(error, 'Failed to update prompt')
    }
  }

  async function handleDeletePrompt(promptId: string) {
    try {
      const { error } = await supabase
        .from('content_prompts')
        .delete()
        .eq('id', promptId)

      if (error) throw error
      showSuccessToast('Prompt deleted')
      loadPrompts()
    } catch (error) {
      showErrorToast(error, 'Failed to delete prompt')
    }
  }

  async function handleAddPrompt() {
    const newSceneNumber = prompts.length > 0 
      ? Math.max(...prompts.map(p => p.scene_number)) + 1 
      : 1

    try {
      const { error } = await supabase
        .from('content_prompts')
        .insert({
          content_id: contentId,
          scene_number: newSceneNumber,
          text: 'New prompt text...',
          duration_seconds: 3,
          actor_prompt: actorPromptBase || null,
        })

      if (error) throw error
      showSuccessToast('Prompt added')
      loadPrompts()
    } catch (error) {
      showErrorToast(error, 'Failed to add prompt')
    }
  }

  async function handleReorder(promptId: string, direction: 'up' | 'down') {
    const index = prompts.findIndex(p => p.id === promptId)
    if (index === -1) return
    
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= prompts.length) return

    const current = prompts[index]
    const swap = prompts[swapIndex]

    try {
      await supabase
        .from('content_prompts')
        .update({ scene_number: swap.scene_number })
        .eq('id', current.id)

      await supabase
        .from('content_prompts')
        .update({ scene_number: current.scene_number })
        .eq('id', swap.id)

      loadPrompts()
    } catch (error) {
      showErrorToast(error, 'Failed to reorder')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated': return 'success'
      case 'generating': return 'warning'
      case 'failed': return 'danger'
      default: return 'default'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
        <span className="ml-2 text-slate-500">Loading prompts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">
          Prompts ({prompts.length})
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            onPress={handleAddPrompt}
            startContent={<Plus className="w-4 h-4" />}
          >
            Add
          </Button>
          <Button
            size="sm"
            color="secondary"
            onPress={handleSplitWithAI}
            isLoading={splitting}
            startContent={!splitting && <Sparkles className="w-4 h-4" />}
          >
            {splitting ? 'Splitting...' : 'AI Split'}
          </Button>
          {prompts.length > 0 && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                const allPrompts = prompts
                  .sort((a, b) => a.scene_number - b.scene_number)
                  .map(p => p.actor_prompt || p.text)
                  .join('\n\n')
                navigator.clipboard.writeText(allPrompts)
                showSuccessToast('All prompts copied!')
              }}
              startContent={<Copy className="w-4 h-4" />}
            >
              Copy All
            </Button>
          )}
        </div>
      </div>

      {/* Prompts List */}
      {prompts.length === 0 ? (
        <Card className="bg-slate-50">
          <CardBody className="text-center py-8">
            <p className="text-slate-500 mb-4">No prompts yet</p>
            <Button
              color="primary"
              onPress={handleSplitWithAI}
              isLoading={splitting}
              startContent={!splitting && <Sparkles className="w-4 h-4" />}
            >
              Split Script with AI
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt, index) => (
            <Card key={prompt.id} className="bg-white border border-slate-200">
              <CardBody className="p-4">
                <div className="flex items-start gap-3">
                  {/* Scene Number & Reorder */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleReorder(prompt.id, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary-700">
                        {prompt.scene_number}
                      </span>
                    </div>
                    <button
                      onClick={() => handleReorder(prompt.id, 'down')}
                      disabled={index === prompts.length - 1}
                      className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    {editingId === prompt.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={prompt.text}
                          onChange={(e) => setPrompts(prev => 
                            prev.map(p => p.id === prompt.id ? { ...p, text: e.target.value } : p)
                          )}
                          minRows={2}
                          label="Prompt Text"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="number"
                            value={prompt.duration_seconds.toString()}
                            onChange={(e) => setPrompts(prev => 
                              prev.map(p => p.id === prompt.id ? { ...p, duration_seconds: parseInt(e.target.value) || 3 } : p)
                            )}
                            label="Duration (sec)"
                          />
                          <Input
                            value={prompt.actor_prompt || ''}
                            onChange={(e) => setPrompts(prev => 
                              prev.map(p => p.id === prompt.id ? { ...p, actor_prompt: e.target.value } : p)
                            )}
                            label="Actor Prompt Override"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" onPress={() => handleUpdatePrompt(prompt)}>
                            Save
                          </Button>
                          <Button size="sm" variant="flat" onPress={() => {
                            setEditingId(null)
                            loadPrompts()
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-800 font-medium mb-1">"{prompt.text}"</p>
                        {prompt.actor_prompt && (
                          <p className="text-slate-600 text-sm mb-2 whitespace-pre-wrap">{prompt.actor_prompt}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Chip size="sm" variant="flat">
                            {prompt.duration_seconds}s
                          </Chip>
                          <Chip size="sm" variant="flat" color={getStatusColor(prompt.image_status)}>
                            {prompt.image_status}
                          </Chip>
                          {prompt.image_url && (
                            <a 
                              href={prompt.image_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary-600 hover:underline"
                            >
                              View Image
                            </a>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== prompt.id && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        isIconOnly
                        variant="flat"
                        onPress={() => setEditingId(prompt.id)}
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        isIconOnly
                        variant="flat"
                        color="danger"
                        onPress={() => handleDeletePrompt(prompt.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
