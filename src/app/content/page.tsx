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

interface FieldDefinition {
  name: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'url'
  label: string
  required?: boolean
  options?: string[]
}

interface ContentTemplate {
  id: string
  name: string
  description: string | null
  icon: string
  business_id: string | null
  fields: FieldDefinition[]
  created_at: string
}

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
  template_id: string | null
  custom_fields: Record<string, any>
  created_at: string
  created_by: string
  template?: ContentTemplate
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

export default function ContentPage() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    title: '',
    status: 'idea',
    template_id: '',
    custom_fields: {} as Record<string, any>,
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
        setContent([])
        setTemplates([])
        setLoading(false)
        return
      }

      // Load templates (global + business-specific)
      const { data: templatesData, error: templatesError } = await supabase
        .from('content_templates')
        .select('*')
        .or(`business_id.is.null,business_id.eq.${selectedBusinessId}`)
        .order('name')
      
      if (templatesError) {
        console.error('Templates error:', templatesError)
        // Don't fail completely if templates table doesn't exist yet
      } else {
        setTemplates(templatesData || [])
      }

      // Get content items for selected business
      const { data: contentData, error: contentError } = await supabase
        .from('content_items')
        .select('*, template:content_templates(*)')
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
      // Extract common fields from custom_fields for backward compatibility
      const customFields = formData.custom_fields || {}
      
      if (editingItem) {
        const { error } = await supabase
          .from('content_items')
          .update({
            title: formData.title,
            status: formData.status,
            template_id: formData.template_id || null,
            custom_fields: customFields,
            // Keep legacy fields updated for backward compat
            script: customFields.script || null,
            hook: customFields.hook || null,
            source: customFields.source || null,
            actor_prompt: customFields.actor_prompt || null,
            voice: customFields.voice || null,
            type: selectedTemplate?.name.toLowerCase() || editingItem.type,
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
            status: formData.status,
            template_id: formData.template_id || null,
            custom_fields: customFields,
            business_id: selectedBusinessId,
            created_by: user.id,
            // Legacy fields
            script: customFields.script || null,
            hook: customFields.hook || null,
            source: customFields.source || null,
            actor_prompt: customFields.actor_prompt || null,
            voice: customFields.voice || null,
            type: selectedTemplate?.name.toLowerCase() || 'other',
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
    const template = templates.find(t => t.id === item.template_id) || null
    setSelectedTemplate(template)
    
    // Merge legacy fields into custom_fields for editing
    const customFields = {
      ...item.custom_fields,
      script: item.custom_fields?.script || item.script || '',
      hook: item.custom_fields?.hook || item.hook || '',
      source: item.custom_fields?.source || item.source || '',
      actor_prompt: item.custom_fields?.actor_prompt || item.actor_prompt || '',
      voice: item.custom_fields?.voice || item.voice || '',
    }
    
    setFormData({
      title: item.title,
      status: item.status,
      template_id: item.template_id || '',
      custom_fields: customFields,
    })
    onOpen()
  }

  function handleClose() {
    setEditingItem(null)
    setSelectedTemplate(null)
    setFormData({
      title: '',
      status: 'idea',
      template_id: '',
      custom_fields: {},
    })
    onClose()
  }

  function handleNew() {
    if (!selectedBusinessId) {
      showErrorToast(null, 'Please select a business first')
      return
    }
    setEditingItem(null)
    setSelectedTemplate(null)
    setFormData({
      title: '',
      status: 'idea',
      template_id: '',
      custom_fields: {},
    })
    onOpen()
  }

  function handleTemplateChange(templateId: string) {
    const template = templates.find(t => t.id === templateId) || null
    setSelectedTemplate(template)
    setFormData(prev => ({
      ...prev,
      template_id: templateId,
      custom_fields: {},
    }))
  }

  function handleCustomFieldChange(fieldName: string, value: any) {
    setFormData(prev => ({
      ...prev,
      custom_fields: {
        ...prev.custom_fields,
        [fieldName]: value,
      },
    }))
  }

  // Render dynamic field
  function renderField(field: FieldDefinition) {
    const value = formData.custom_fields[field.name] || ''
    
    switch (field.type) {
      case 'text':
        return (
          <Input
            key={field.name}
            label={field.label}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            isRequired={field.required}
          />
        )
      
      case 'textarea':
        return (
          <Textarea
            key={field.name}
            label={field.label}
            placeholder={`Enter ${field.label.toLowerCase()}`}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            isRequired={field.required}
            minRows={3}
          />
        )
      
      case 'number':
        return (
          <Input
            key={field.name}
            type="number"
            label={field.label}
            placeholder="0"
            value={value?.toString() || ''}
            onChange={(e) => handleCustomFieldChange(field.name, parseFloat(e.target.value) || 0)}
            isRequired={field.required}
          />
        )
      
      case 'date':
        return (
          <Input
            key={field.name}
            type="date"
            label={field.label}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            isRequired={field.required}
          />
        )
      
      case 'select':
        return (
          <Select
            key={field.name}
            label={field.label}
            selectedKeys={value ? [value] : []}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            isRequired={field.required}
          >
            {(field.options || []).map(opt => (
              <SelectItem key={opt}>{opt}</SelectItem>
            ))}
          </Select>
        )
      
      case 'checkbox':
        return (
          <label key={field.name} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleCustomFieldChange(field.name, e.target.checked)}
              className="w-4 h-4 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">{field.label}</span>
          </label>
        )
      
      case 'url':
        return (
          <Input
            key={field.name}
            type="url"
            label={field.label}
            placeholder="https://..."
            value={value}
            onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
            isRequired={field.required}
          />
        )
      
      default:
        return null
    }
  }

  const getItemsByStatus = (status: string) => content.filter(c => c.status === status)

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

  // Content card component
  const ContentCard = ({ item, compact = false }: { item: ContentItem; compact?: boolean }) => (
    <Card className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow">
      <CardBody className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{item.template?.icon || '📄'}</span>
            <Chip size="sm" variant="flat" className="text-xs capitalize">
              {item.template?.name || item.type}
            </Chip>
            {compact && (
              <Chip 
                size="sm" 
                variant="flat" 
                className={`text-xs ${pipelineStages.find(s => s.key === item.status)?.textColor}`}
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
        {(item.custom_fields?.hook || item.hook) && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-2">"{item.custom_fields?.hook || item.hook}"</p>
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

              {/* Board View - Kanban Style (Stacked Grid) */}
              {viewMode === 'board' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pipelineStages.map(stage => (
                    <div key={stage.key} className="w-full">
                      <div className={`rounded-t-xl px-4 py-2 ${stage.color}`}>
                        <div className="flex items-center justify-between">
                          <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
                          <Chip size="sm" variant="flat" className={stage.textColor}>
                            {getItemsByStatus(stage.key).length}
                          </Chip>
                        </div>
                      </div>
                      <div className="bg-slate-100/50 rounded-b-xl p-2 min-h-[200px] space-y-2">
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
              {selectedTemplate && (
                <Chip size="sm" variant="flat">
                  {selectedTemplate.icon} {selectedTemplate.name}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Template Picker */}
              {templates.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Content Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {templates.map(template => (
                      <Card
                        key={template.id}
                        isPressable
                        className={`cursor-pointer transition-all ${
                          formData.template_id === template.id 
                            ? 'ring-2 ring-primary bg-primary-50' 
                            : 'hover:bg-slate-50'
                        }`}
                        onPress={() => handleTemplateChange(template.id)}
                      >
                        <CardBody className="p-3 text-center">
                          <div className="text-2xl mb-1">{template.icon}</div>
                          <div className="text-sm font-medium">{template.name}</div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              <Input
                label="Title"
                placeholder="Content title..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                isRequired
              />
              
              <Select
                label="Pipeline Stage"
                selectedKeys={[formData.status]}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {pipelineStages.map(s => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
              
              {/* Dynamic Fields from Template */}
              {selectedTemplate && selectedTemplate.fields.length > 0 && (
                <div className="border-t pt-4 mt-2">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">
                    {selectedTemplate.name} Details
                  </h4>
                  <div className="flex flex-col gap-4">
                    {selectedTemplate.fields.map(field => renderField(field))}
                  </div>
                </div>
              )}
              
              {/* Fallback fields if no template selected */}
              {!selectedTemplate && (
                <>
                  <Input
                    label="Hook"
                    placeholder="Opening line to grab attention"
                    value={formData.custom_fields.hook || ''}
                    onChange={(e) => handleCustomFieldChange('hook', e.target.value)}
                  />
                  <Textarea
                    label="Script"
                    placeholder="Full script content..."
                    value={formData.custom_fields.script || ''}
                    onChange={(e) => handleCustomFieldChange('script', e.target.value)}
                    minRows={4}
                  />
                </>
              )}
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
