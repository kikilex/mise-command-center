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
  Avatar
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/UserMenu'
import toast from 'react-hot-toast'

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
  const [businessId, setBusinessId] = useState<string | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
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
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    
    // Get user
    const { data: { user: authUser } } = await supabase.auth.getUser()
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

    // Get default business
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .limit(1)
    
    if (businesses && businesses.length > 0) {
      setBusinessId(businesses[0].id)
      
      // Get content items
      const { data: contentData } = await supabase
        .from('content_items')
        .select('*')
        .eq('business_id', businesses[0].id)
        .order('created_at', { ascending: false })
      
      if (contentData) setContent(contentData)
    }
    
    setLoading(false)
  }

  async function handleSubmit() {
    if (!user || !businessId) return
    
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
      
      if (!error) {
        toast.success('Content updated')
        loadData()
        handleClose()
      } else {
        toast.error('Failed to update content')
      }
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
          business_id: businessId,
          created_by: user.id,
        })
      
      if (!error) {
        toast.success('Content created')
        loadData()
        handleClose()
      } else {
        toast.error('Failed to create content')
      }
    }
  }

  async function handleStatusChange(itemId: string, newStatus: string) {
    const { error } = await supabase
      .from('content_items')
      .update({ status: newStatus })
      .eq('id', itemId)
    
    if (!error) {
      const stage = pipelineStages.find(s => s.key === newStatus)
      toast.success(`Moved to ${stage?.label || newStatus}`)
      loadData()
    }
  }

  async function handleDelete(itemId: string) {
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', itemId)
    
    if (!error) {
      toast.success('Content deleted')
      loadData()
    } else {
      toast.error('Failed to delete content')
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise</span>
              </a>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Content Pipeline</h1>
            <div className="flex items-center gap-2">
              <Button color="primary" size="sm" onPress={handleNew}>+ New Content</Button>
              {user && <UserMenu user={user} />}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading content pipeline...</div>
        ) : (
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
                    <Card key={item.id} className="bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow">
                      <CardBody className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <Chip size="sm" variant="flat" className="text-xs capitalize">
                            {item.type}
                          </Chip>
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
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingItem ? 'Edit Content' : 'New Content'}
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
            >
              {editingItem ? 'Save Changes' : 'Create'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
