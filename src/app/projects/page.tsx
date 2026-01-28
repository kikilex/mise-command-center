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
  Progress,
  Tabs,
  Tab,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useBusiness } from '@/lib/business-context'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
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
      custom_fields: {}, // Reset custom fields when template changes
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

  // Filter projects
  const filteredProjects = statusFilter === 'all' 
    ? projects 
    : projects.filter(p => p.status === statusFilter)

  // Get progress for goal-type projects
  const getProgress = (project: Project) => {
    return project.custom_fields?.progress || 0
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        user={user} 
        actions={
          <Button 
            color="primary" 
            size="sm" 
            onPress={handleNew}
          >
            + New Project
          </Button>
        }
      />

      <main className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
                {selectedBusiness && (
                  <Chip 
                    size="sm" 
                    variant="flat"
                    style={{ backgroundColor: `${selectedBusiness.color}20`, color: selectedBusiness.color }}
                  >
                    {selectedBusiness.name}
                  </Chip>
                )}
                {!selectedBusinessId && (
                  <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600">
                    Personal
                  </Chip>
                )}
              </div>
              <p className="text-slate-500 text-sm">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Status Filter */}
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

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <div className="text-4xl mb-4">📁</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No Projects Yet</h3>
              <p className="text-slate-500 mb-4">
                Create your first project to start organizing your work.
              </p>
              <Button color="primary" onPress={handleNew}>
                Create Project
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(project => (
              <Card 
                key={project.id} 
                className="bg-white hover:shadow-md transition-shadow cursor-pointer"
                isPressable
                onPress={() => handleEdit(project)}
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{project.template?.icon || '📁'}</span>
                      <div>
                        <h3 className="font-semibold text-slate-800">{project.name}</h3>
                        {project.template && (
                          <span className="text-xs text-slate-500">{project.template.name}</span>
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
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{project.description}</p>
                  )}
                  
                  {/* Progress bar for goals */}
                  {project.custom_fields?.progress !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
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
                      <Chip size="sm" variant="flat" className="bg-blue-50 text-blue-600">
                        🎯 {new Date(project.custom_fields.target_date).toLocaleDateString()}
                      </Chip>
                    )}
                    {project.custom_fields?.status && (
                      <Chip size="sm" variant="flat" className="bg-violet-50 text-violet-600">
                        {project.custom_fields.status}
                      </Chip>
                    )}
                    {project.custom_fields?.priority && (
                      <Chip size="sm" variant="flat" className="bg-orange-50 text-orange-600">
                        {project.custom_fields.priority}
                      </Chip>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
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
                  {selectedTemplate.icon} {selectedTemplate.name}
                </Chip>
              )}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              {/* Template Picker (only for new projects) */}
              {!editingProject && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Project Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  <h4 className="text-sm font-medium text-slate-700 mb-3">
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
