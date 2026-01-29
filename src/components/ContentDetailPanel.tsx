'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import {
  X,
  ExternalLink,
  Edit,
  ChevronDown,
  ChevronRight,
  Video,
  Mic,
  FileText,
  Tag,
  Calendar,
  User,
  Trash2,
  Copy,
  Check,
} from 'lucide-react'
import {
  Button,
  Chip,
  Divider,
  Select,
  SelectItem,
  Spinner,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
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
  template?: ContentTemplate
}

interface ContentDetailPanelProps {
  item: ContentItem | null
  isOpen: boolean
  onClose: () => void
  onStatusChange: (itemId: string, newStatus: string) => void
  onDelete: (itemId: string) => void
  onEdit: (item: ContentItem) => void
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

export default function ContentDetailPanel({
  item,
  isOpen,
  onClose,
  onStatusChange,
  onDelete,
  onEdit,
}: ContentDetailPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['script']))
  const [copied, setCopied] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const router = useRouter()

  // Reset expanded sections when item changes
  useEffect(() => {
    if (item) {
      const sections = new Set(['script'])
      if (item.hook || item.custom_fields?.hook) sections.add('hook')
      setExpandedSections(sections)
    }
  }, [item?.id])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const handleCopyScript = async () => {
    const script = item?.script || item?.custom_fields?.script
    if (script) {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      showSuccessToast('Script copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenFullPage = () => {
    if (item) {
      router.push(`/content/${item.id}`)
      onClose()
    }
  }

  if (!item) return null

  const script = item.script || item.custom_fields?.script || ''
  const hook = item.hook || item.custom_fields?.hook || ''
  const actorPrompt = item.actor_prompt || item.custom_fields?.actor_prompt || ''
  const reviewNotes = item.review_notes || item.custom_fields?.review_notes || ''
  const voice = item.voice || item.custom_fields?.voice || ''
  const source = item.source || item.custom_fields?.source || ''

  const currentStage = pipelineStages.find(s => s.key === item.status)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[600px] lg:w-[700px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Chip
                  size="sm"
                  color={currentStage?.color as any || 'default'}
                  variant="flat"
                >
                  {currentStage?.label || item.status}
                </Chip>
                {item.template?.name && (
                  <Chip size="sm" variant="dot">
                    {item.template.name}
                  </Chip>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {item.title}
              </h2>
            </div>
            <Button
              isIconOnly
              variant="light"
              onPress={onClose}
              className="flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <Select
              size="sm"
              selectedKeys={[item.status]}
              className="w-36"
              onChange={(e) => onStatusChange(item.id, e.target.value)}
              label="Status"
              labelPlacement="outside-left"
              classNames={{
                base: "items-center",
                label: "text-xs",
              }}
            >
              {pipelineStages.map(s => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>

            <div className="flex-1" />

            <Button
              size="sm"
              variant="flat"
              startContent={<Edit className="w-4 h-4" />}
              onPress={() => onEdit(item)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="flat"
              color="primary"
              startContent={<ExternalLink className="w-4 h-4" />}
              onPress={handleOpenFullPage}
            >
              Full Page
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-140px)] px-6 py-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {voice && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
                  <Mic className="w-3.5 h-3.5" />
                  Voice
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{voice}</p>
              </div>
            )}
            {item.platforms && item.platforms.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
                  <Video className="w-3.5 h-3.5" />
                  Platforms
                </div>
                <div className="flex gap-1 flex-wrap">
                  {item.platforms.map((p, i) => (
                    <Chip key={i} size="sm" variant="flat">{p}</Chip>
                  ))}
                </div>
              </div>
            )}
            {source && (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 col-span-2">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  Source
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{source}</p>
              </div>
            )}
          </div>

          {/* Collapsible Sections */}
          <div className="space-y-4">
            {/* Hook Section */}
            {hook && (
              <CollapsibleSection
                title="Hook"
                icon={<FileText className="w-4 h-4" />}
                isExpanded={expandedSections.has('hook')}
                onToggle={() => toggleSection('hook')}
              >
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 italic">"{hook}"</p>
                </div>
              </CollapsibleSection>
            )}

            {/* Script Section */}
            {script && (
              <CollapsibleSection
                title="Script"
                icon={<FileText className="w-4 h-4" />}
                isExpanded={expandedSections.has('script')}
                onToggle={() => toggleSection('script')}
                actions={
                  <Button
                    size="sm"
                    variant="flat"
                    isIconOnly
                    onPress={handleCopyScript}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                }
              >
                <div className="prose prose-slate dark:prose-invert max-w-none prose-sm
                  prose-p:my-2 prose-headings:my-3
                  prose-code:bg-slate-200 prose-code:text-slate-800 dark:prose-code:bg-slate-800 dark:prose-code:text-slate-200 prose-code:px-1 prose-code:rounded
                ">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
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
                            customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.8rem' }}
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
              </CollapsibleSection>
            )}

            {/* Actor Prompt Section */}
            {actorPrompt && (
              <CollapsibleSection
                title="Actor Prompt"
                icon={<User className="w-4 h-4" />}
                isExpanded={expandedSections.has('actor_prompt')}
                onToggle={() => toggleSection('actor_prompt')}
              >
                <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{actorPrompt}</p>
                </div>
              </CollapsibleSection>
            )}

            {/* Review Notes Section */}
            {reviewNotes && (
              <CollapsibleSection
                title="Review Notes"
                icon={<FileText className="w-4 h-4" />}
                isExpanded={expandedSections.has('review_notes')}
                onToggle={() => toggleSection('review_notes')}
              >
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{reviewNotes}</p>
                </div>
              </CollapsibleSection>
            )}

            {/* Custom Fields */}
            {item.custom_fields && Object.keys(item.custom_fields).filter(k => 
              !['script', 'hook', 'actor_prompt', 'review_notes', 'voice', 'source'].includes(k)
            ).length > 0 && (
              <CollapsibleSection
                title="Additional Fields"
                icon={<Tag className="w-4 h-4" />}
                isExpanded={expandedSections.has('custom_fields')}
                onToggle={() => toggleSection('custom_fields')}
              >
                <div className="space-y-2">
                  {Object.entries(item.custom_fields)
                    .filter(([k]) => !['script', 'hook', 'actor_prompt', 'review_notes', 'voice', 'source'].includes(k))
                    .map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span className="text-sm text-slate-500 dark:text-slate-400 capitalize min-w-[100px]">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-slate-800 dark:text-slate-200">
                          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                        </span>
                      </div>
                    ))}
                </div>
              </CollapsibleSection>
            )}
          </div>

          <Divider className="my-6" />

          {/* Footer Metadata */}
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              Created {new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </div>

          {/* Delete Button */}
          <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              color="danger"
              variant="flat"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={() => {
                onDelete(item.id)
                onClose()
              }}
              className="w-full"
            >
              Delete Content
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  actions,
  children,
}: {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900">
          {children}
        </div>
      )}
    </div>
  )
}
