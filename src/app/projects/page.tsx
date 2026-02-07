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
  Progress,
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
import { useSpace } from '@/lib/space-context'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import { 
  Target, Rocket, Megaphone, Folder, Calendar, Plus,
  LayoutGrid, List, Eye, Pencil, Trash2
} from 'lucide-react'

// Main export with Suspense wrapper
export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <ProjectsPageContent />
    </Suspense>
  )
}

type ViewMode = 'board' | 'list'

const VIEW_STORAGE_KEY = 'mise-projects-view'

interface FieldDefinition {
  name: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'url'
  label: string
  required?: boolean
  options?: string[]
}

interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  icon: string
  business_id: string | null
  fields: FieldDefinition[]
  created_at: string
}

interface Project {
  id: string
  name: string
  description: string | null
  template_id: string | null
  business_id: string | null
  status: 'active' | 'completed' | 'archived' | 'on_hold'
  custom_fields: Record<string, any>
  created_by: string
  created_at: string
  template?: ProjectTemplate
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const statusOptions = [
  { key: 'active', label: 'Active', color: 'success' },
  { key: 'on_hold', label: 'On Hold', color: 'warning' },
  { key: 'completed', label: 'Completed', color: 'primary' },
  { key: 'archived', label: 'Archived', color: 'default' },
]

// Map template names to Lucide icons
const templateIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'goal': Target,
  'feature': Rocket,
  'campaign': Megaphone,
  'simple': Folder,
}

function getTemplateIcon(templateName?: string | null) {
  if (!templateName) return Folder
  return templateIconMap[templateName.toLowerCase()] || Folder
}

function ProjectsPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'created_at',
    direction: 'descending',
  })
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    template_id: '',
    custom_fields: {} as Record<string, any>,
  })
  
  const { selectedSpaceId: selectedBusinessId, selectedSpace: selectedBusiness } = useSpace()
  const supabase = createClient()
  const router = useRouter()

  // Load view preference
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY)
    if (saved === 'board' || saved === 'list') {
      setViewMode(saved)
    }
  }, [])

  function handleViewChange(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
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
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
        })
      }
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    
    try {
      // Load templates (global + business-specific)
      let templatesQuery = supabase
        .from('project_templates')
        .select('*')
        .order('name')
      
      if (selectedBusinessId) {
        templatesQuery = templatesQuery.or(`business_id.is.null,business_id.eq.${selectedBusinessId}`)
      } else {
        templatesQuery = templatesQuery.is('business_id', null)
      }
      
      const { data: templatesData, error: templatesError } = await templatesQuery
      
      if (templatesError) throw templatesError
      setTemplates(templatesData || [])
      
      // Load projects
      let projectsQuery = supabase
        .from('projects')
        .select('*, template:project_templates(*)')
        .order('created_at', { ascending: false })
      
      if (selectedBusinessId) {
        projectsQuery = projectsQuery.eq('business_id', selectedBusinessId)
      } else {
        projectsQuery = projectsQuery.is('business_id', null)
      }
      
      const { data: projectsData, error: projectsError } = await projectsQuery
      
      if (projectsError) throw projectsError
      setProjects(projectsData || [])
      
    } catch (error) {
      console.error('Load data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!user) {
      showErrorToast(null, 'Please sign in')
      return
    }
    
    if (!formData.name.trim()) {
      showErrorToast(null, 'Please enter a project name')
      return
    }
    
    setSubmitting(true)
    
    try {
      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            template_id: formData.template_id || null,
            custom_fields: formData.custom_fields,
          })
          .eq('id', editingProject.id)
        
        if (error) throw error
        
        showSuccessToast('Project updated')
      } else {
        const { error } = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            template_id: formData.template_id || null,
            business_id: selectedBusinessId || null,
            custom_fields: formData.custom_fields,
            created_by: user.id,
          })
        
        if (error) throw error
        
        showSuccessToast('Project created')
      }
      
      loadData()
      handleClose()
    } catch (error) {
      console.error('Submit error:', error)
      showErrorToast(error, editingProject ? 'Failed to update' : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(projectId: string) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
      
      if (error) throw error
      
      showSuccessToast('Project deleted')
      loadData()
    } catch (error) {
      showErrorToast(error, 'Failed to delete')
    }
  }

  async function handleStatusChange(projectId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId)
      
      if (error) throw error
      
      showSuccessToast('Status updated')
      loadData()
    } catch (error) {
      showErrorToast(error, 'Failed to update status')
    }
  }

  function handleEdit(project: Project) {
    setEditingProject(project)
    const template = templates.find(t => t.id === project.template_id) || null
    setSelectedTemplate(template)
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      template_id: project.template_id || '',
      custom_fields: project.custom_fields || {},
    })
    onOpen()
  }

  function handleClose() {
    setEditingProject(null)
    setSelectedTemplate(null)
    setFormData({
      name: '',
      description: '',
      status: 'active',
      template_id: '',
      custom_fields: {},
    })
    onClose()
  }

  function handleNew() {
    setEditingProject(null)
    setSelectedTemplate(null)
    setFormData({
      name: '',
      description: '',
      status: 'active',
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

  // Render a dynamic field based on its type
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

  // Filter projects
  const filteredProjects = statusFilter === 'all' 
    ? projects 
    : projects.filter(p => p.status === statusFilter)

  // Sort projects for list view
  const sortedProjects = useMemo(() => {
    if (!sortDescriptor.column) return filteredProjects
    
    return [...filteredProjects].sort((a, b) => {
      let first: any
      let second: any
      
      switch (sortDescriptor.column) {
        case 'name':
          first = a.name.toLowerCase()
          second = b.name.toLowerCase()
          break
        case 'status':
          first = a.status
          second = b.status
          break
        case 'created_at':
          first = new Date(a.created_at).getTime()
          second = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }
      
      const cmp = first < second ? -1 : first > second ? 1 : 0
      return sortDescriptor.direction === 'descending' ? -cmp : cmp
    })
  }, [filteredProjects, sortDescriptor])

  // Get progress for goal-type projects
  const getProgress = (project: Project) => {
    return project.custom_fields?.progress || 0
  }

  // Render Board View - Cards
  const renderBoardView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedProjects.map(project => {
        const IconComponent = getTemplateIcon(project.template?.name)
        return (
          <Card 
            key={project.id} 
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow cursor-pointer"
            isPressable
            onPress={() => router.push(`/projects/${project.id}`)}
          >
            <CardBody className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{project.name}</h3>
                    {project.template && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{project.template.name}</span>
                    )}
                  </div>
                </div>
                <Chip 
                  size="sm" 
                  color={statusOptions.find(s => s.key === project.status)?.color as any}
                  variant="flat"
                >
                  {statusOptions.find(s => s.key === project.status)?.label}
                </Chip>
              </div>
              
              {project.description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{project.description}</p>
              )}
              
              {/* Progress bar for goals */}
              {project.custom_fields?.progress !== undefined && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{getProgress(project)}%</span>
                  </div>
                  <Progress 
                    value={getProgress(project)} 
                    size="sm"
                    color={getProgress(project) >= 100 ? 'success' : 'primary'}
                  />
                </div>
              )}
              
              {/* Custom fields preview */}
              <div className="flex flex-wrap gap-2">
                {project.custom_fields?.target_date && (
                  <Chip size="sm" variant="flat" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(project.custom_fields.target_date).toLocaleDateString()}
                  </Chip>
                )}
              </div>
              
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                {new Date(project.created_at).toLocaleDateString()}
              </div>
            </CardBody>
          </Card>
        )
      })}
    </div>
  )

  // Render List View - Table like Content
  const renderListView = () => (
    <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <CardBody className="p-0">
        <Table
          aria-label="Projects table"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          classNames={{
            wrapper: "min-h-[400px]",
          }}
        >
          <TableHeader>
            <TableColumn key="name" allowsSorting>Name</TableColumn>
            <TableColumn key="status" allowsSorting width={140}>Status</TableColumn>
            <TableColumn key="template" width={120}>Template</TableColumn>
            <TableColumn key="description" width={200}>Description</TableColumn>
            <TableColumn key="created_at" allowsSorting width={120}>Created</TableColumn>
            <TableColumn key="actions" width={150}>Actions</TableColumn>
          </TableHeader>
          <TableBody items={sortedProjects} emptyContent="No projects to display">
            {(project) => (
              <TableRow
                key={project.id}
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const IconComponent = getTemplateIcon(project.template?.name)
                      return <IconComponent className="w-4 h-4 text-slate-400" />
                    })()}
                    <span className="font-medium truncate max-w-[250px]">{project.name}</span>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    size="sm"
                    selectedKeys={[project.status]}
                    className="w-full"
                    onChange={(e) => handleStatusChange(project.id, e.target.value)}
                    aria-label="Change status"
                  >
                    {statusOptions.map(s => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  {project.template?.name ? (
                    <Chip size="sm" variant="flat" className="capitalize">
                      {project.template.name}
                    </Chip>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {project.description ? (
                    <span className="text-sm text-slate-600 dark:text-slate-400 truncate block max-w-[180px]">
                      {project.description}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      isIconOnly
                      onPress={() => router.push(`/projects/${project.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      isIconOnly
                      onPress={() => handleEdit(project)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      isIconOnly
                      onPress={() => handleDelete(project.id)}
                    >
                      <Trash2 className="w-4 h-4" />
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
        {/* View Tabs and Controls - matching Content page layout */}
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

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              color="primary"
              onPress={handleNew}
              startContent={<Plus className="w-4 h-4" />}
            >
              New Project
            </Button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          <Button 
            size="sm" 
            variant={statusFilter === 'all' ? 'solid' : 'flat'}
            color="primary"
            onPress={() => setStatusFilter('all')}
          >
            All ({projects.length})
          </Button>
          {statusOptions.map(status => (
            <Button
              key={status.key}
              size="sm"
              variant={statusFilter === status.key ? 'solid' : 'flat'}
              color={status.color as any}
              onPress={() => setStatusFilter(status.key)}
            >
              {status.label} ({projects.filter(p => p.status === status.key).length})
            </Button>
          ))}
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadData} />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardBody className="text-center py-12">
              <Folder className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">No Projects Yet</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Create your first project to start organizing your work.
              </p>
              <Button color="primary" onPress={handleNew} startContent={<Plus className="w-4 h-4" />}>
                Create Project
              </Button>
            </CardBody>
          </Card>
        ) : (
          viewMode === 'board' ? renderBoardView() : renderListView()
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span>{editingProject ? 'Edit Project' : 'New Project'}</span>
              {selectedTemplate && (
                <Chip size="sm" variant="flat">
                  {selectedTemplate.name}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Template Picker (only for new projects) */}
              {!editingProject && (
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Project Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {templates.map(template => {
                      const IconComponent = getTemplateIcon(template.name)
                      return (
                        <Card
                          key={template.id}
                          isPressable
                          className={`cursor-pointer transition-all ${
                            formData.template_id === template.id 
                              ? 'ring-2 ring-primary bg-primary-50 dark:bg-primary-900/20' 
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                          onPress={() => handleTemplateChange(template.id)}
                        >
                          <CardBody className="p-3 text-center">
                            <IconComponent className="w-6 h-6 mx-auto mb-1 text-slate-600 dark:text-slate-400" />
                            <div className="text-sm font-medium">{template.name}</div>
                          </CardBody>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
              
              <Input
                label="Project Name"
                placeholder="Enter project name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                isRequired
              />
              
              <Textarea
                label="Description"
                placeholder="Brief description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                minRows={2}
              />
              
              <Select
                label="Status"
                selectedKeys={[formData.status]}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {statusOptions.map(s => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
              
              {/* Dynamic Fields from Template */}
              {selectedTemplate && selectedTemplate.fields.length > 0 && (
                <div className="border-t pt-4 mt-2">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    {selectedTemplate.name} Fields
                  </h4>
                  <div className="flex flex-col gap-4">
                    {selectedTemplate.fields.map(field => renderField(field))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            {editingProject && (
              <Button 
                color="danger" 
                variant="flat" 
                onPress={() => { handleDelete(editingProject.id); handleClose(); }}
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
              isDisabled={!formData.name.trim()}
              isLoading={submitting}
            >
              {editingProject ? 'Save Changes' : 'Create Project'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
