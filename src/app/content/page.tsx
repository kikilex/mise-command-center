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
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  SortDescriptor,
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
  Video,
  LayoutGrid,
  List,
  Mic,
  Search,
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
  { key: 'idea', label: 'Ideas' },
  { key: 'script', label: 'Script' },
  { key: 'review', label: 'Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'voiceover', label: 'Voiceover' },
  { key: 'video', label: 'Video' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'posted', label: 'Posted' },
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
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStage, setFilterStage] = useState<string>('all')
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'created_at',
    direction: 'descending',
  })
  
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

  // Sorted content for list view
  const sortedContent = useMemo(() => {
    const sorted = [...filteredContent]
    
    if (sortDescriptor.column) {
      sorted.sort((a, b) => {
        let aValue: any = a[sortDescriptor.column as keyof ContentItem]
        let bValue: any = b[sortDescriptor.column as keyof ContentItem]
        
        // Handle null/undefined values
        if (aValue == null) aValue = ''
        if (bValue == null) bValue = ''
        
        let cmp = 0
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          cmp = aValue.localeCompare(bValue)
        } else {
          cmp = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        }
        
        return sortDescriptor.direction === 'descending' ? -cmp : cmp
      })
    }
    
    return sorted
  }, [filteredContent, sortDescriptor])

  const getItemsByStatus = (status: string) => filteredContent.filter(c => c.status === status)

  // Group tasks by status for Kanban view
  const contentByStatus = useMemo(() => {
    const grouped: Record<string, ContentItem[]> = {}
    pipelineStages.forEach(s => {
      grouped[s.key] = filteredContent.filter(c => c.status === s.key)
    })
    return grouped
  }, [filteredContent])

  // Content card component - simplified like Tasks
  const ContentCard = ({ item }: { item: ContentItem }) => {
    const voice = item.voice || item.custom_fields?.voice
    
    return (
      <Card 
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        isPressable
        onPress={() => handleViewDetails(item)}
      >
        <CardBody className="p-3">
          <div className="flex items-start gap-3">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate mb-2">
                {item.title}
              </h3>
              
              <div className="flex items-center gap-2 flex-wrap">
                {item.template?.name && (
                  <Chip size="sm" variant="flat" className="text-xs capitalize">
                    {item.template.name}
                  </Chip>
                )}
                {voice && (
                  <Chip size="sm" variant="flat" className="text-xs">
                    <Mic className="w-3 h-3 mr-1" />
                    {voice}
                  </Chip>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    )
  }

  // Render Board View (Kanban Style - matching Tasks)
  const renderBoardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {pipelineStages.map(stage => (
        <div key={stage.key} className="w-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {stage.label}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({contentByStatus[stage.key]?.length || 0})
              </span>
            </div>
          </div>
          <div className="space-y-2 min-h-[150px] bg-slate-100/80 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200/50 dark:border-slate-700/50">
            {contentByStatus[stage.key]?.map(item => (
              <ContentCard key={item.id} item={item} />
            ))}
            {contentByStatus[stage.key]?.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // Render List View - Table like Tasks
  const renderListView = () => (
    <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <CardBody className="p-0">
        <Table
          aria-label="Content table"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          classNames={{
            wrapper: "min-h-[400px]",
          }}
        >
          <TableHeader>
            <TableColumn key="title" allowsSorting>Title</TableColumn>
            <TableColumn key="status" allowsSorting width={140}>Status</TableColumn>
            <TableColumn key="template" width={120}>Template</TableColumn>
            <TableColumn key="voice" width={100}>Voice</TableColumn>
            <TableColumn key="platforms" width={120}>Platforms</TableColumn>
            <TableColumn key="created_at" allowsSorting width={120}>Created</TableColumn>
            <TableColumn key="actions" width={150}>Actions</TableColumn>
          </TableHeader>
          <TableBody items={sortedContent} emptyContent="No content to display">
            {(item) => (
              <TableRow 
                key={item.id} 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                onClick={() => handleViewDetails(item)}
              >
                <TableCell>
                  <span className="font-medium truncate max-w-[300px]">{item.title}</span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    size="sm"
                    selectedKeys={[item.status]}
                    className="w-full"
                    onChange={(e) => handleStatusChange(item.id, e.target.value)}
                    aria-label="Change status"
                  >
                    {pipelineStages.map(s => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  {item.template?.name ? (
                    <Chip size="sm" variant="flat" className="capitalize">
                      {item.template.name}
                    </Chip>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.voice || item.custom_fields?.voice ? (
                    <span className="text-sm">{item.voice || item.custom_fields?.voice}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.platforms?.length > 0 ? (
                    <span className="text-sm">{item.platforms.join(', ')}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      onPress={() => handleEdit(item)}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      color="danger"
                      onPress={() => handleDelete(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* View Tabs and Controls - matching Tasks page layout */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          {/* Left side: View toggle */}
          <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Tabs 
              selectedKey={viewMode} 
              onSelectionChange={(key) => handleViewChange(key as ViewMode)}
              color="primary"
              variant="solid"
              size="md"
              classNames={{
                tabList: "flex-nowrap",
                tab: "whitespace-nowrap",
              }}
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
          
          <Button 
            color="success" 
            onPress={handleNew}
            isDisabled={!selectedBusinessId}
            className="font-semibold flex-shrink-0"
          >
            + New Content
          </Button>
        </div>

        {/* Filter chips - like Tasks page */}
        {selectedBusinessId && (
          <div className="flex gap-2 flex-wrap mb-6">
            <Button 
              size="sm" 
              variant={filterStage === 'all' ? 'solid' : 'flat'}
              color={filterStage === 'all' ? 'success' : 'default'}
              onPress={() => setFilterStage('all')}
            >
              All ({content.length})
            </Button>
            {pipelineStages.map(stage => (
              <Button
                key={stage.key}
                size="sm"
                variant={filterStage === stage.key ? 'solid' : 'flat'}
                color={filterStage === stage.key ? 'success' : 'default'}
                onPress={() => setFilterStage(stage.key)}
              >
                {stage.label} ({content.filter(c => c.status === stage.key).length})
              </Button>
            ))}
          </div>
        )}

        {/* Search */}
        {selectedBusinessId && (
          <div className="mb-6">
            <Input
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search className="w-4 h-4 text-slate-400" />}
              classNames={{
                input: "bg-transparent",
                inputWrapper: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
              }}
              className="max-w-md"
            />
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
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading content...</div>
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
                <Button color="success" onPress={handleNew}>
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
