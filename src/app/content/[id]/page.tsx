'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  Edit,
  List,
  Share2,
  Check,
  Trash2,
  Video,
  Mic,
  FileText,
  Tag,
  Calendar,
  User,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  Button,
  Chip,
  Spinner,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Input,
  Textarea,
  useDisclosure,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface ContentTemplate {
  id: string
  name: string
  description: string | null
  icon: string
  business_id: string | null
  fields: any[]
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
  updated_at?: string
  template?: ContentTemplate
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

interface TOCItem {
  id: string
  text: string
  level: number
}

const pipelineStages = [
  { key: 'idea', label: 'Ideas', color: 'default' },
  { key: 'script', label: 'Script', color: 'primary' },
  { key: 'review', label: 'Review', color: 'warning' },
  { key: 'approved', label: 'Approved', color: 'success' },
  { key: 'voiceover', label: 'Voiceover', color: 'secondary' },
  { key: 'video', label: 'Video', color: 'danger' },
  { key: 'scheduled', label: 'Scheduled', color: 'primary' },
  { key: 'posted', label: 'Posted', color: 'success' },
]

export default function ContentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [content, setContent] = useState<ContentItem | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTOC, setShowTOC] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  
  // Edit modal state
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    status: 'idea',
    script: '',
    hook: '',
    actor_prompt: '',
    review_notes: '',
    voice: '',
    source: '',
  })
  
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadUser()
    loadContent()
  }, [id])

  // Scroll listener for floating button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight
      const clientHeight = window.innerHeight
      
      setShowScrollButton(scrollTop > 300)
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100)
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [content])

  const handleScrollButton = () => {
    if (isAtBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  }

  async function loadUser() {
    try {
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
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  async function loadContent() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('content_items')
        .select('*, template:content_templates(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      setContent(data)
      
      // Initialize form data
      setFormData({
        title: data.title || '',
        status: data.status || 'idea',
        script: data.script || data.custom_fields?.script || '',
        hook: data.hook || data.custom_fields?.hook || '',
        actor_prompt: data.actor_prompt || data.custom_fields?.actor_prompt || '',
        review_notes: data.review_notes || data.custom_fields?.review_notes || '',
        voice: data.voice || data.custom_fields?.voice || '',
        source: data.source || data.custom_fields?.source || '',
      })
    } catch (error) {
      console.error('Load content error:', error)
      showErrorToast(error, 'Failed to load content')
      router.push('/content')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!content) return
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('content_items')
        .update({
          title: formData.title,
          status: formData.status,
          script: formData.script || null,
          hook: formData.hook || null,
          actor_prompt: formData.actor_prompt || null,
          review_notes: formData.review_notes || null,
          voice: formData.voice || null,
          source: formData.source || null,
          custom_fields: {
            ...content.custom_fields,
            script: formData.script,
            hook: formData.hook,
            actor_prompt: formData.actor_prompt,
            review_notes: formData.review_notes,
            voice: formData.voice,
            source: formData.source,
          },
        })
        .eq('id', content.id)

      if (error) throw error
      
      showSuccessToast('Content updated successfully')
      loadContent()
      onEditClose()
    } catch (error) {
      console.error('Save content error:', error)
      showErrorToast(error, 'Failed to update content')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!content) return
    
    try {
      const { error } = await supabase
        .from('content_items')
        .update({ status: newStatus })
        .eq('id', content.id)

      if (error) throw error
      
      const stage = pipelineStages.find(s => s.key === newStatus)
      showSuccessToast(`Moved to ${stage?.label || newStatus}`)
      loadContent()
    } catch (error) {
      console.error('Status change error:', error)
      showErrorToast(error, 'Failed to update status')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('content_items')
        .delete()
        .eq('id', id)

      if (error) throw error

      showSuccessToast('Content deleted')
      router.push('/content')
    } catch (error) {
      console.error('Delete content error:', error)
      showErrorToast(error, 'Failed to delete content')
    } finally {
      setDeleting(false)
      onDeleteClose()
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showSuccessToast('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showErrorToast(null, 'Failed to copy link')
    }
  }

  const handleCopyScript = async () => {
    const script = content?.script || content?.custom_fields?.script
    if (script) {
      await navigator.clipboard.writeText(script)
      showSuccessToast('Script copied to clipboard')
    }
  }

  // Extract TOC from script markdown
  const tableOfContents = useMemo((): TOCItem[] => {
    const script = content?.script || content?.custom_fields?.script
    if (!script) return []
    
    const headings: TOCItem[] = []
    const lines = script.split('\n')
    
    lines.forEach((line: string) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const tocId = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        headings.push({ id: tocId, text, level })
      }
    })
    
    return headings
  }, [content?.script, content?.custom_fields?.script])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!content) return null

  const script = content.script || content.custom_fields?.script || ''
  const hook = content.hook || content.custom_fields?.hook || ''
  const actorPrompt = content.actor_prompt || content.custom_fields?.actor_prompt || ''
  const reviewNotes = content.review_notes || content.custom_fields?.review_notes || ''
  const voice = content.voice || content.custom_fields?.voice || ''
  const source = content.source || content.custom_fields?.source || ''

  const currentStage = pipelineStages.find(s => s.key === content.status)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link href="/content">
            <Button variant="flat" startContent={<ArrowLeft className="w-4 h-4" />}>
              Back to Pipeline
            </Button>
          </Link>
          
          <div className="flex items-center gap-2 flex-wrap">
            {tableOfContents.length > 2 && (
              <Button
                variant="flat"
                startContent={<List className="w-4 h-4" />}
                onPress={() => setShowTOC(!showTOC)}
                className="sm:hidden"
              >
                TOC
              </Button>
            )}
            
            <Button
              variant="flat"
              startContent={copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              onPress={handleShare}
            >
              {copied ? 'Copied!' : 'Share'}
            </Button>
            <Button 
              color="primary" 
              startContent={<Edit className="w-4 h-4" />}
              onPress={onEditOpen}
            >
              Edit
            </Button>
            <Button
              variant="flat"
              color="danger"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={onDeleteOpen}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Content Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Chip
              color={currentStage?.color as any || 'default'}
              variant="flat"
              size="sm"
            >
              {currentStage?.label || content.status}
            </Chip>
            {content.template?.name && (
              <Chip variant="dot" size="sm">{content.template.name}</Chip>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4 leading-tight">
            {content.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Created {formatDate(content.created_at)}</span>
            {content.updated_at && content.updated_at !== content.created_at && (
              <span>• Updated {formatDate(content.updated_at)}</span>
            )}
          </div>

          {/* Status Selector */}
          <div className="mt-4">
            <Select
              size="sm"
              selectedKeys={[content.status]}
              className="w-40"
              onChange={(e) => handleStatusChange(e.target.value)}
              label="Pipeline Stage"
              labelPlacement="outside-left"
              classNames={{
                base: "items-center",
                label: "text-sm text-slate-600 dark:text-slate-400",
              }}
            >
              {pipelineStages.map(s => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <Divider className="mb-8" />

        {/* Layout with optional TOC sidebar */}
        <div className="flex gap-8">
          {/* Table of Contents - Desktop Sidebar */}
          {tableOfContents.length > 2 && (
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Script Outline
                </h4>
                <nav className="space-y-1">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-sm py-1 hover:text-violet-600 dark:hover:text-violet-400 transition-colors ${
                        item.level === 1 ? 'font-semibold text-slate-800 dark:text-slate-100' :
                        item.level === 2 ? 'ml-3 text-slate-600 dark:text-slate-300' :
                        'ml-6 text-xs text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Mobile TOC */}
          {showTOC && tableOfContents.length > 2 && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowTOC(false)}>
              <div 
                className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-slate-800 p-6 shadow-xl overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Script Outline
                </h4>
                <nav className="space-y-2">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setShowTOC(false)}
                      className={`block text-sm py-1 hover:text-violet-600 dark:hover:text-violet-400 ${
                        item.level === 1 ? 'font-semibold' :
                        item.level === 2 ? 'ml-3' : 'ml-6 text-xs'
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Main Content */}
          <article className="flex-1 min-w-0">
            {/* Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {voice && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-2">
                    <Mic className="w-4 h-4" />
                    Voice
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{voice}</p>
                </div>
              )}
              {content.platforms && content.platforms.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-2">
                    <Video className="w-4 h-4" />
                    Platforms
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {content.platforms.map((p, i) => (
                      <Chip key={i} size="sm" variant="flat">{p}</Chip>
                    ))}
                  </div>
                </div>
              )}
              {source && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-2">
                    <Tag className="w-4 h-4" />
                    Source / Reference
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{source}</p>
                </div>
              )}
            </div>

            {/* Hook */}
            {hook && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Hook
                </h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
                  <p className="text-lg text-slate-800 dark:text-slate-200 italic">"{hook}"</p>
                </div>
              </div>
            )}

            {/* Script */}
            {script && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Script
                  </h2>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Copy className="w-4 h-4" />}
                    onPress={handleCopyScript}
                  >
                    Copy
                  </Button>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <div className="prose prose-slate dark:prose-invert max-w-none
                    prose-headings:scroll-mt-8
                    prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-8
                    prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
                    prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
                    prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
                    prose-ul:my-4 prose-ol:my-4
                    prose-li:my-1
                    prose-code:bg-slate-200 prose-code:text-slate-800 dark:prose-code:bg-slate-700 dark:prose-code:text-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                    prose-pre:p-0 prose-pre:bg-transparent prose-pre:rounded-lg
                    prose-blockquote:border-l-violet-500 prose-blockquote:bg-violet-50 dark:prose-blockquote:bg-violet-900/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
                  ">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => {
                          const text = String(children)
                          const headingId = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          return <h1 id={headingId}>{children}</h1>
                        },
                        h2: ({ children }) => {
                          const text = String(children)
                          const headingId = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          return <h2 id={headingId}>{children}</h2>
                        },
                        h3: ({ children }) => {
                          const text = String(children)
                          const headingId = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          return <h3 id={headingId}>{children}</h3>
                        },
                        code: ({ className, children, ...props }) => {
                          const match = /language-(\w+)/.exec(className || '')
                          const codeString = String(children).replace(/\n$/, '')
                          const isInline = !match && !codeString.includes('\n')
                          
                          if (isInline) {
                            return <code className={className} {...props}>{children}</code>
                          }
                          
                          return (
                            <SyntaxHighlighter
                              style={isDark ? oneDark : oneLight}
                              language={match ? match[1] : 'text'}
                              PreTag="div"
                              customStyle={{
                                margin: 0,
                                padding: '1rem',
                                fontSize: '0.875rem',
                                borderRadius: '0.5rem',
                              }}
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          )
                        },
                      }}
                    >
                      {script}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Actor Prompt */}
            {actorPrompt && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Actor Prompt
                </h2>
                <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-xl p-6">
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{actorPrompt}</p>
                </div>
              </div>
            )}

            {/* Review Notes */}
            {reviewNotes && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Review Notes
                </h2>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{reviewNotes}</p>
                </div>
              </div>
            )}

            {/* Custom Fields */}
            {content.custom_fields && Object.keys(content.custom_fields).filter(k => 
              !['script', 'hook', 'actor_prompt', 'review_notes', 'voice', 'source'].includes(k)
            ).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Additional Details
                </h2>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
                  <div className="space-y-3">
                    {Object.entries(content.custom_fields)
                      .filter(([k]) => !['script', 'hook', 'actor_prompt', 'review_notes', 'voice', 'source'].includes(k))
                      .map(([key, value]) => (
                        <div key={key} className="flex items-start gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                          <span className="text-sm text-slate-500 dark:text-slate-400 capitalize min-w-[120px] font-medium">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-slate-800 dark:text-slate-200">
                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </article>
        </div>

        {/* Floating Scroll Button */}
        {showScrollButton && (
          <button
            onClick={handleScrollButton}
            className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg transition-all duration-200 hover:scale-110"
            aria-label={isAtBottom ? 'Scroll to top' : 'Scroll to bottom'}
          >
            {isAtBottom ? <ArrowUp className="w-5 h-5" /> : <ArrowDown className="w-5 h-5" />}
          </button>
        )}

        <Divider className="my-8" />

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>
            <p>Created {formatDate(content.created_at)}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/content" className="hover:text-violet-600 dark:hover:text-violet-400">
              ← Back to Pipeline
            </Link>
          </div>
        </footer>
      </main>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>Edit Content</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
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

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Voice"
                  placeholder="Voice/Narrator"
                  value={formData.voice}
                  onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
                />
                <Input
                  label="Source"
                  placeholder="Source/Reference"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                />
              </div>

              <Textarea
                label="Hook"
                placeholder="Opening line to grab attention..."
                value={formData.hook}
                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                minRows={2}
              />

              <Textarea
                label="Script"
                placeholder="Full script content (supports Markdown)..."
                value={formData.script}
                onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                minRows={10}
              />

              <Textarea
                label="Actor Prompt"
                placeholder="Instructions for the actor..."
                value={formData.actor_prompt}
                onChange={(e) => setFormData({ ...formData, actor_prompt: e.target.value })}
                minRows={3}
              />

              <Textarea
                label="Review Notes"
                placeholder="Notes from review..."
                value={formData.review_notes}
                onChange={(e) => setFormData({ ...formData, review_notes: e.target.value })}
                minRows={2}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onEditClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!formData.title.trim()}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Delete Content
          </ModalHeader>
          <ModalBody>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{content?.title}</strong>? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={deleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
