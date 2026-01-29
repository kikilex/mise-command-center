'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Button, 
  Card, 
  CardBody,
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
  Tabs,
  Tab,
  Spinner,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import ContentDetailPanel from '@/components/ContentDetailPanel'
import { useBusiness } from '@/lib/business-context'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import { 
  Heart, 
  BookOpen, 
  ShoppingBag, 
  Zap, 
  FileText, 
  Plus, 
  ChevronRight, 
  Edit,
  Video,
  LayoutGrid,
  List,
  Mic,
  Calendar,
  Search,
  Filter,
  GripVertical,
} from 'lucide-react'
import PromptsSection from '@/components/PromptsSection'

// Main export with Suspense wrapper
export default function ContentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <ContentPageContent />
    </Suspense>
  )
}

type ViewMode = 'board' | 'list'

const VIEW_STORAGE_KEY = 'mise-content-view'

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
  { key: 'idea', label: 'Ideas', color: 'default', bgColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-700 dark:text-slate-300' },
  { key: 'script', label: 'Script', color: 'primary', bgColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-700 dark:text-blue-300' },
  { key: 'review', label: 'Review', color: 'warning', bgColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-700 dark:text-amber-300' },
  { key: 'approved', label: 'Approved', color: 'success', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', textColor: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'voiceover', label: 'Voiceover', color: 'secondary', bgColor: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-700 dark:text-purple-300' },
  { key: 'video', label: 'Video', color: 'danger', bgColor: 'bg-pink-100 dark:bg-pink-900/30', textColor: 'text-pink-700 dark:text-pink-300' },
  { key: 'scheduled', label: 'Scheduled', color: 'primary', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30', textColor: 'text-cyan-700 dark:text-cyan-300' },
  { key: 'posted', label: 'Posted', color: 'success', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-300' },
]

// Map template names to Lucide icons
const contentIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'prayer': Heart,
  'testimony': BookOpen,
  'educational': BookOpen,
  'promotional': ShoppingBag,
  'short form': Zap,
}

function getContentIcon(templateName?: string | null, type?: string | null) {
  if (templateName) {
    return contentIconMap[templateName.toLowerCase()] || FileText
  }
  if (type) {
    return contentIconMap[type.toLowerCase()] || FileText
  }
  return FileText
}

function ContentPageContent() {
  const [content, setContent] = useState<ContentItem[]>([])
  const [templates, setTemplates] = useState<ContentTemplate[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string>('all')
  
  // Detail panel state
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    status: 'idea',
    template_id: '',
    custom_fields: {} as Record<string, any>,
  })
  
  const { selectedBusinessId, selectedBusiness, businesses } = useBusiness()
  const supabase = createClient()
  const router = useRouter()

  // Load saved view from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    if (savedView && ['board', 'list'].includes(savedView)) {
      setViewMode(savedView)
    }
  }, [])

  // Save view to localStorage when changed
  const handleViewChange = (view: ViewMode) => {
    setViewMode(view)
    localStorage.setItem(VIEW_STORAGE_KEY, view)
  }

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
      const customFields = formData.custom_fields || {}
      
      if (editingItem) {
        const { error } = await supabase
          .from('content_items')
          .update({
            title: formData.title,
            status: formData.status,
            template_id: formData.template_id || null,
            custom_fields: customFields,
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
    setIsPanelOpen(false)
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

  function handleViewDetails(item: ContentItem) {
    setSelectedItem(item)
    setIsPanelOpen(true)
  }

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
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">{field.label}</span>
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

  // Filter content based on search and stage filter
  const filteredContent = useMemo(() => {
    let filtered = content

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.hook?.toLowerCase().includes(query) ||
        item.script?.toLowerCase().includes(query) ||
        item.template?.name?.toLowerCase().includes(query)
      )
    }

    if (filterStage !== 'all') {
      filtered = filtered.filter(item => item.status === filterStage)
    }

    return filtered
  }, [content, searchQuery, filterStage])

  const getItemsByStatus = (status: string) => filteredContent.filter(c => c.status === status)

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
  const ContentCard = ({ item, compact = false }: { item: ContentItem; compact?: boolean }) => {
    const IconComponent = getContentIcon(item.template?.name, item.type)
    const stage = pipelineStages.find(s => s.key === item.status)
    const hook = item.hook || item.custom_fields?.hook
    const voice = item.voice || item.custom_fields?.voice
    
    return (
      <Card 
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
        isPressable
        onPress={() => handleViewDetails(item)}
      >
        <CardBody className={compact ? "p-3" : "p-4"}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-lg ${stage?.bgColor || 'bg-slate-100'} flex items-center justify-center flex-shrink-0`}>
              <IconComponent className={`w-5 h-5 ${stage?.textColor || 'text-slate-600'}`} />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className={`font-semibold text-slate-900 dark:text-slate-100 ${compact ? 'text-sm' : ''} truncate`}>
                  {item.title}
                </h3>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {item.template?.name && (
                  <Chip size="sm" variant="flat" className="text-xs">
                    {item.template.name}
                  </Chip>
                )}
                {voice && (
                  <Chip size="sm" variant="flat" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    <Mic className="w-3 h-3 mr-1" />
                    {voice}
                  </Chip>
                )}
              </div>
              
              {hook && !compact && (
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 italic mb-2">
                  "{hook}"
                </p>
              )}
              
              {/* Quick Actions */}
              <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                {item.status === 'script' && (
                  <Button 
                    size="sm" 
                    color="warning" 
                    variant="flat"
                    className="text-xs"
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
                    className="text-xs"
                    onPress={() => handleStatusChange(item.id, 'approved')}
                  >
                    Approve
                  </Button>
                )}
                {!['script', 'review'].includes(item.status) && (
                  <Select
                    size="sm"
                    selectedKeys={[item.status]}
                    className="w-32"
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    aria-label="Change status"
                  >
                    {pipelineStages.map(s => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    )
  }

  // Render Board View (Kanban Style - Stacked Grid)
  const renderBoardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {pipelineStages.map(stage => {
        const stageItems = getItemsByStatus(stage.key)
        return (
          <div key={stage.key} className="w-full">
            <div className={`rounded-t-xl px-4 py-3 ${stage.bgColor}`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
                <Chip size="sm" variant="flat" className={stage.textColor}>
                  {stageItems.length}
                </Chip>
              </div>
            </div>
            <div className="bg-slate-100/80 dark:bg-slate-800/50 rounded-b-xl p-2 min-h-[200px] space-y-2 border border-t-0 border-slate-200/50 dark:border-slate-700/50">
              {stageItems.map(item => (
                <ContentCard key={item.id} item={item} compact={true} />
              ))}
              {stageItems.length === 0 && (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                  No items
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  // Render List View
  const renderListView = () => (
    <div className="space-y-3">
      {pipelineStages.map(stage => {
        const stageItems = getItemsByStatus(stage.key)
        const isCollapsed = collapsedStages.has(stage.key)
        
        if (filterStage !== 'all' && filterStage !== stage.key) return null
        
        return (
          <div key={stage.key} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <button
              onClick={() => toggleStageCollapse(stage.key)}
              className={`w-full px-4 py-3 ${stage.bgColor} flex items-center justify-between hover:opacity-90 transition-opacity`}
            >
              <div className="flex items-center gap-3">
                <ChevronRight className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'} ${stage.textColor}`} />
                <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
              </div>
              <Chip size="sm" variant="flat" className={stage.textColor}>
                {stageItems.length}
              </Chip>
            </button>
            
            {!isCollapsed && (
              <div className="p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                {stageItems.length > 0 ? (
                  stageItems.map(item => (
                    <ContentCard key={item.id} item={item} compact={false} />
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm">
                    No items in this stage
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Content Pipeline</h1>
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
              <p className="text-slate-500 dark:text-slate-400 text-sm">{totalContent} items in pipeline</p>
            )}
          </div>
          
          <Button 
            color="primary" 
            onPress={handleNew}
            isDisabled={!selectedBusinessId}
            startContent={<Plus className="w-4 h-4" />}
            className="font-semibold"
          >
            New Content
          </Button>
        </div>

        {/* Controls Bar */}
        {selectedBusinessId && (
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                startContent={<Search className="w-4 h-4 text-slate-400" />}
                classNames={{
                  input: "bg-transparent",
                  inputWrapper: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                }}
              />
            </div>
            
            {/* Stage Filter (for list view) */}
            {viewMode === 'list' && (
              <Select
                placeholder="Filter by stage"
                selectedKeys={[filterStage]}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-40"
                startContent={<Filter className="w-4 h-4" />}
              >
                <SelectItem key="all">All Stages</SelectItem>
                {pipelineStages.map(s => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
            )}
            
            {/* View Toggle */}
            <Tabs 
              selectedKey={viewMode} 
              onSelectionChange={(key) => handleViewChange(key as ViewMode)}
              color="primary"
              variant="solid"
              size="md"
            >
              <Tab key="board" title={
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              } />
              <Tab key="list" title={
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                </div>
              } />
            </Tabs>
          </div>
        )}

        {/* No business selected state */}
        {!selectedBusinessId && (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardBody className="text-center py-12">
              <Video className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Select a Business</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Content is organized by business. Use the business selector in the navbar to choose a business.
              </p>
              {businesses.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-slate-500">
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
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
              <span className="ml-3 text-slate-500 dark:text-slate-400">Loading content pipeline...</span>
            </div>
          ) : filteredContent.length === 0 && searchQuery ? (
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <CardBody className="text-center py-12">
                <Search className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">No Results</h3>
                <p className="text-slate-500 dark:text-slate-400">
                  No content found matching "{searchQuery}"
                </p>
                <Button 
                  variant="flat" 
                  className="mt-4"
                  onPress={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
              </CardBody>
            </Card>
          ) : content.length === 0 ? (
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <CardBody className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">No Content Yet</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  Start building your content pipeline
                </p>
                <Button color="primary" onPress={handleNew}>
                  Create First Content
                </Button>
              </CardBody>
            </Card>
          ) : (
            viewMode === 'board' ? renderBoardView() : renderListView()
          )
        )}
      </main>

      {/* Detail Panel */}
      <ContentDetailPanel
        item={selectedItem}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false)
          setSelectedItem(null)
        }}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

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
                  {selectedTemplate.name}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Template Picker */}
              {templates.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Content Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {templates.map(template => {
                      const IconComponent = getContentIcon(template.name)
                      return (
                        <Card
                          key={template.id}
                          isPressable
                          className={`cursor-pointer transition-all border ${
                            formData.template_id === template.id 
                              ? 'ring-2 ring-primary bg-primary-50 dark:bg-primary-900/20 border-primary' 
                              : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                          onPress={() => handleTemplateChange(template.id)}
                        >
                          <CardBody className="p-3 text-center">
                            <IconComponent className="w-6 h-6 mx-auto mb-1 text-slate-600 dark:text-slate-400" />
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{template.name}</div>
                          </CardBody>
                        </Card>
                      )
                    })}
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
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
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
              
              {/* Prompts Section - only show when editing existing content with a script */}
              {editingItem && (formData.custom_fields.script || editingItem.script) && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                  <PromptsSection
                    contentId={editingItem.id}
                    script={formData.custom_fields.script || editingItem.script || ''}
                    actorPromptBase={formData.custom_fields.actor_prompt || editingItem.actor_prompt || ''}
                  />
                </div>
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
