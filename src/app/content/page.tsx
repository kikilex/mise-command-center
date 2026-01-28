'use client'

import { useState, useEffect } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Textarea,
  useDisclosure,
  Avatar,
  ButtonGroup
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useBusiness } from '@/lib/business-context'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

type ViewMode = 'board' | 'list'

interface ContentItem {
  id: string
  title: string
  type: string
  status: string
  script: string | null
  hook: string | null
  source: string | null
  actor_prompt: string | null
  voice: string | null
  review_notes: string | null
  platforms: string[]
  business_id: string
  created_at: string
  created_by: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const pipelineStages = [
  { key: 'idea', label: 'Ideas', color: 'bg-slate-200', textColor: 'text-slate-700' },
  { key: 'script', label: 'Script', color: 'bg-blue-200', textColor: 'text-blue-700' },
  { key: 'review', label: 'Review', color: 'bg-amber-200', textColor: 'text-amber-700' },
  { key: 'approved', label: 'Approved', color: 'bg-emerald-200', textColor: 'text-emerald-700' },
  { key: 'voiceover', label: 'Voiceover', color: 'bg-purple-200', textColor: 'text-purple-700' },
  { key: 'video', label: 'Video', color: 'bg-pink-200', textColor: 'text-pink-700' },
  { key: 'scheduled', label: 'Scheduled', color: 'bg-cyan-200', textColor: 'text-cyan-700' },
  { key: 'posted', label: 'Posted', color: 'bg-green-200', textColor: 'text-green-700' },
]

const contentTypes = [
  { key: 'testimony', label: 'Testimony' },
  { key: 'educational', label: 'Educational' },
  { key: 'promotional', label: 'Promotional' },
  { key: 'other', label: 'Other' },
]

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list') // Default to list for mobile-first
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    title: '',
    type: 'testimony',
    status: 'idea',
    script: '',
    hook: '',
    source: '',
    actor_prompt: '',
    voice: '',
  })
  
  const { selectedBusinessId, selectedBusiness, businesses } = useBusiness()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    loadData()
  }, [selectedBusinessId])

  async function loadUser() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        return
      }
      
      if (authUser) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          if (profileError) {
            console.error('Profile fetch error:', profileError)
          }
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
          })
        } catch (err) {
          console.error('Failed to fetch profile:', err)
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0],
          })
        }
      }
    } catch (error) {
      console.error('Load user error:', error)
      showErrorToast(error, 'Failed to load user data')
    }
  }

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    
    try {
      if (!selectedBusinessId) {
        // No business selected - show empty state or all content
        setContent([])
        setLoading(false)
        return
      }

      // Get content items for selected business
      const { data: contentData, error: contentError } = await supabase
        .from('content_items')
        .select('*')
        .eq('business_id', selectedBusinessId)
        .order('created_at', { ascending: false })
      
      if (contentError) {
        throw contentError
      }
      
      setContent(contentData || [])
    } catch (error) {
      console.error('Load data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!user) {
      showErrorToast(null, 'Please sign in to manage content')
      return
    }
    
    if (!selectedBusinessId) {
      showErrorToast(null, 'Please select a business first')
      return
    }
    
    if (!formData.title.trim()) {
      showErrorToast(null, 'Please enter a title')
      return
    }
    
    setSubmitting(true)
    
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('content_items')
          .update({
            title: formData.title,
            type: formData.type,
            status: formData.status,
            script: formData.script || null,
            hook: formData.hook || null,
            source: formData.source || null,
            actor_prompt: formData.actor_prompt || null,
            voice: formData.voice || null,
          })
          .eq('id', editingItem.id)
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Content updated successfully')
        loadData()
        handleClose()
      } else {
        const { error } = await supabase
          .from('content_items')
          .insert({
            title: formData.title,
            type: formData.type,
            status: formData.status,
            script: formData.script || null,
            hook: formData.hook || null,
            source: formData.source || null,
            actor_prompt: formData.actor_prompt || null,
            voice: formData.voice || null,
            business_id: selectedBusinessId,
            created_by: user.id,
          })
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Content created successfully')
        loadData()
        handleClose()
      }
    } catch (error) {
      console.error('Submit content error:', error)
      showErrorToast(error, editingItem ? 'Failed to update content' : 'Failed to create content')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStatusChange(itemId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ status: newStatus })
        .eq('id', itemId)
      
      if (error) {
        throw error
      }
      
      const stage = pipelineStages.find(s => s.key === newStatus)
      showSuccessToast(`Moved to ${stage?.label || newStatus}`)
      loadData()
    } catch (error) {
      console.error('Status change error:', error)
      showErrorToast(error, 'Failed to update status')
    }
  }

  async function handleDelete(itemId: string) {
    try {
      const { error } = await supabase
        .from('content_items')
        .delete()
        .eq('id', itemId)
      
      if (error) {
        throw error
      }
      
      showSuccessToast('Content deleted')
      loadData()
    } catch (error) {
      console.error('Delete content error:', error)
      showErrorToast(error, 'Failed to delete content')
    }
  }

  function handleEdit(item: ContentItem) {
    setEditingItem(item)
    setFormData({
      title: item.title,
      type: item.type,
      status: item.status,
      script: item.script || '',
      hook: item.hook || '',
      source: item.source || '',
      actor_prompt: item.actor_prompt || '',
      voice: item.voice || '',
    })
    onOpen()
  }

  function handleClose() {
    setEditingItem(null)
    setFormData({
      title: '',
      type: 'testimony',
      status: 'idea',
      script: '',
      hook: '',
      source: '',
      actor_prompt: '',
      voice: '',
    })
    onClose()
  }

  function handleNew() {
    if (!selectedBusinessId) {
      showErrorToast(null, 'Please select a business first')
      return
    }
    setEditingItem(null)
    setFormData({
      title: '',
      type: 'testimony',
      status: 'idea',
      script: '',
      hook: '',
      source: '',
      actor_prompt: '',
      voice: '',
    })
    onOpen()
  }

  const getItemsByStatus = (status: string) => content.filter(c => c.status === status)

  // Calculate total content count
  const totalContent = content.length

  const toggleStageCollapse = (stageKey: string) => {
    setCollapsedStages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stageKey)) {
        newSet.delete(stageKey)
      } else {
        newSet.add(stageKey)
      }
      return newSet
    })
  }

  // Content card component - reused in both views
  const ContentCard = ({ item, compact = false }: { item: ContentItem; compact?: boolean }) => (
    <Card className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow">
      <CardBody className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" className="text-xs capitalize">
              {item.type}
            </Chip>
            {compact && (
              <Chip 
                size="sm" 
                variant="flat" 
                className={`text-xs ${pipelineStages.find(s => s.key === item.status)?.textColor}`}
                style={{ 
                  backgroundColor: pipelineStages.find(s => s.key === item.status)?.color.replace('bg-', '').includes('slate') 
                    ? '#e2e8f0' 
                    : undefined 
                }}
              >
                {pipelineStages.find(s => s.key === item.status)?.label}
              </Chip>
            )}
          </div>
          <button 
            onClick={() => handleEdit(item)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✏️
          </button>
        </div>
        <h4 className="font-medium text-slate-800 text-sm mb-2">{item.title}</h4>
        {item.hook && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">"{item.hook}"</p>
        )}
        <div className="flex gap-1 mt-2">
          {item.status === 'script' && (
            <Button 
              size="sm" 
              color="warning" 
              variant="flat"
              className="flex-1 text-xs"
              onPress={() => handleStatusChange(item.id, 'review')}
            >
              Send for Review
            </Button>
          )}
          {item.status === 'review' && (
            <Button 
              size="sm" 
              color="success" 
              variant="flat"
              className="flex-1 text-xs"
              onPress={() => handleStatusChange(item.id, 'approved')}
            >
              ✓ Approve
            </Button>
          )}
          {item.status !== 'script' && item.status !== 'review' && (
            <Select
              size="sm"
              selectedKeys={[item.status]}
              className="w-full"
              onChange={(e) => handleStatusChange(item.id, e.target.value)}
            >
              {pipelineStages.map(s => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>
          )}
        </div>
      </CardBody>
    </Card>
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        user={user} 
        actions={
          <Button 
            color="primary" 
            size="sm" 
            onPress={handleNew}
            isDisabled={!selectedBusinessId}
          >
            + New Content
          </Button>
        }
      />

      <main className="p-4 sm:p-6">
        {/* Header with business context */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-800">Content Pipeline</h1>
                {selectedBusiness && (
                  <Chip 
                    size="sm" 
                    variant="flat"
                    style={{ backgroundColor: `${selectedBusiness.color}20`, color: selectedBusiness.color }}
                  >
                    {selectedBusiness.name}
                  </Chip>
                )}
              </div>
              {selectedBusinessId && (
                <p className="text-slate-500 text-sm">{totalContent} items in pipeline</p>
              )}
            </div>
            
            {/* View Toggle */}
            {selectedBusinessId && (
              <ButtonGroup size="sm" variant="flat">
                <Button
                  className={viewMode === 'list' ? 'bg-primary-100 text-primary-700' : ''}
                  onPress={() => setViewMode('list')}
                >
                  <span className="mr-1">☰</span> List
                </Button>
                <Button
                  className={viewMode === 'board' ? 'bg-primary-100 text-primary-700' : ''}
                  onPress={() => setViewMode('board')}
                >
                  <span className="mr-1">▦</span> Board
                </Button>
              </ButtonGroup>
            )}
          </div>
        </div>

        {/* No business selected state */}
        {!selectedBusinessId && (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Select a Business</h3>
              <p className="text-slate-500 mb-4">
                Content is organized by business. Use the business selector in the navbar to choose a business.
              </p>
              {businesses.length === 0 && (
                <p className="text-sm text-slate-400">
                  No businesses found. Create one in the Business Hub first.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        {/* Error State */}
        {loadError && !loading && selectedBusinessId && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadData} />
          </div>
        )}
        
        {/* Pipeline View */}
        {selectedBusinessId && !loadError && (
          loading ? (
            <div className="text-center py-12 text-slate-500">Loading content pipeline...</div>
          ) : (
            <div className="max-w-7xl mx-auto">
              {/* List View - Mobile Friendly */}
              {viewMode === 'list' && (
                <div className="space-y-4">
                  {pipelineStages.map(stage => {
                    const stageItems = getItemsByStatus(stage.key)
                    const isCollapsed = collapsedStages.has(stage.key)
                    
                    return (
                      <div key={stage.key} className="rounded-xl overflow-hidden border border-slate-200">
                        {/* Stage Header - Clickable to collapse */}
                        <button
                          onClick={() => toggleStageCollapse(stage.key)}
                          className={`w-full px-4 py-3 ${stage.color} flex items-center justify-between`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-lg transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                              ▶
                            </span>
                            <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
                          </div>
                          <Chip size="sm" variant="flat" className={stage.textColor}>
                            {stageItems.length}
                          </Chip>
                        </button>
                        
                        {/* Stage Content - Collapsible */}
                        {!isCollapsed && (
                          <div className="bg-slate-50 p-3 space-y-3">
                            {stageItems.length > 0 ? (
                              stageItems.map(item => (
                                <ContentCard key={item.id} item={item} compact={false} />
                              ))
                            ) : (
                              <div className="text-center py-6 text-slate-400 text-sm">
                                No items in this stage
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Board View - Kanban Style */}
              {viewMode === 'board' && (
                <div className="flex gap-4 overflow-x-auto pb-4">
                  {pipelineStages.map(stage => (
                    <div key={stage.key} className="flex-shrink-0 w-72">
                      <div className={`rounded-t-xl px-4 py-2 ${stage.color}`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
                          <Chip size="sm" variant="flat" className={stage.textColor}>
                            {getItemsByStatus(stage.key).length}
                          </Chip>
                        </div>
                      </div>
                      <div className="bg-slate-100/50 rounded-b-xl p-2 min-h-[400px] space-y-2">
                        {getItemsByStatus(stage.key).map(item => (
                          <ContentCard key={item.id} item={item} compact={true} />
                        ))}
                        {getItemsByStatus(stage.key).length === 0 && (
                          <div className="text-center py-8 text-slate-400 text-sm">
                            No items
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span>{editingItem ? 'Edit Content' : 'New Content'}</span>
              {selectedBusiness && (
                <Chip 
                  size="sm" 
                  variant="flat"
                  style={{ backgroundColor: `${selectedBusiness.color}20`, color: selectedBusiness.color }}
                >
                  {selectedBusiness.name}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                placeholder="Ex-Satanist's Powerful Testimony"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                isRequired
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Type"
                  selectedKeys={[formData.type]}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  {contentTypes.map(t => (
                    <SelectItem key={t.key}>{t.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Status"
                  selectedKeys={[formData.status]}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {pipelineStages.map(s => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Input
                label="Hook"
                placeholder="Opening line to grab attention"
                value={formData.hook}
                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
              />
              <Textarea
                label="Script"
                placeholder="Full script content..."
                value={formData.script}
                onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                minRows={4}
              />
              <Input
                label="Source"
                placeholder="Where did this story come from?"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
              <Textarea
                label="Actor Prompt"
                placeholder="AI image generation prompt for the actor..."
                value={formData.actor_prompt}
                onChange={(e) => setFormData({ ...formData, actor_prompt: e.target.value })}
                minRows={2}
              />
              <Input
                label="Voice"
                placeholder="Which voice to use for narration"
                value={formData.voice}
                onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            {editingItem && (
              <Button 
                color="danger" 
                variant="flat" 
                onPress={() => { handleDelete(editingItem.id); handleClose(); }}
                className="mr-auto"
              >
                Delete
              </Button>
            )}
            <Button variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleSubmit}
              isDisabled={!formData.title.trim()}
              isLoading={submitting}
            >
              {editingItem ? 'Save Changes' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
