'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { BookOpen, Search, Calendar, ArrowLeft, List, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import {
  Card,
  CardBody,
  Chip,
  Input,
  Spinner,
  Divider,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast } from '@/lib/errors'

interface JournalEntry {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

interface TOCItem {
  id: string
  text: string
  level: number
}

export default function JournalView() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // TOC state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadJournalEntries()
  }, [])

  // Scroll listener for floating button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = window.document.documentElement.scrollHeight
      const clientHeight = window.innerHeight
      
      setShowScrollButton(scrollTop > 300)
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100)
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll()
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [selectedEntry])

  async function loadJournalEntries() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, created_at, updated_at')
        .ilike('title', 'Ax Journal%')
        .order('created_at', { ascending: false })

      if (error) throw error
      setEntries(data || [])
    } catch (error) {
      console.error('Load journal entries error:', error)
      showErrorToast(error, 'Failed to load journal entries')
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries
    return entries.filter(entry => 
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [entries, searchQuery])

  // Extract date from title (e.g., "Ax Journal - 2025-01-29" -> "January 29, 2025")
  const formatEntryDate = (title: string) => {
    const dateMatch = title.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      const date = new Date(dateMatch[1])
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return title.replace('Ax Journal - ', '').replace('Ax Journal', 'Untitled')
  }

  // Get content preview
  const getPreview = (content: string) => {
    const stripped = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
    return stripped.length > 120 ? stripped.slice(0, 120) + '...' : stripped
  }

  // Extract TOC from markdown headings
  const tableOfContents = useMemo((): TOCItem[] => {
    if (!selectedEntry?.content) return []
    
    const headings: TOCItem[] = []
    const lines = selectedEntry.content.split('\n')
    
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        headings.push({ id, text, level })
      }
    })
    
    return headings
  }, [selectedEntry?.content])

  // Group TOC items
  const groupedTOC = useMemo(() => {
    const result: { title: TOCItem | null; sections: { parent: TOCItem; children: TOCItem[] }[] } = {
      title: null,
      sections: []
    }
    
    let currentH2: TOCItem | null = null
    let currentH3s: TOCItem[] = []

    tableOfContents.forEach((item) => {
      if (item.level === 1) {
        result.title = item
      } else if (item.level === 2) {
        if (currentH2) {
          result.sections.push({ parent: currentH2, children: currentH3s })
        }
        currentH2 = item
        currentH3s = []
      } else if (item.level === 3) {
        if (currentH2) {
          currentH3s.push(item)
        }
      }
    })

    if (currentH2) {
      result.sections.push({ parent: currentH2, children: currentH3s })
    }

    return result
  }, [tableOfContents])

  const collapsibleSectionIds = useMemo(() => {
    return groupedTOC.sections
      .filter(section => section.children.length > 0)
      .map(section => section.parent.id)
  }, [groupedTOC])

  const allCollapsed = useMemo(() => {
    if (collapsibleSectionIds.length === 0) return false
    return collapsibleSectionIds.every(id => collapsedSections.has(id))
  }, [collapsibleSectionIds, collapsedSections])

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const toggleAllSections = () => {
    if (allCollapsed) {
      setCollapsedSections(new Set())
    } else {
      setCollapsedSections(new Set(collapsibleSectionIds))
    }
  }

  const handleScrollButton = () => {
    if (isAtBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: window.document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  }

  // Render entry list
  const renderEntryList = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-8 h-8 text-violet-600 dark:text-violet-400" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Journal</h1>
        <Chip size="sm" variant="flat">{entries.length}</Chip>
      </div>

      {/* Search */}
      <Input
        placeholder="Search journal entries..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        startContent={<Search className="w-4 h-4 text-slate-400" />}
        className="max-w-md"
        isClearable
        onClear={() => setSearchQuery('')}
      />

      {/* Entry List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardBody className="text-center py-16">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              {searchQuery ? 'No journal entries match your search' : 'No journal entries yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {searchQuery ? 'Try adjusting your search' : 'Journal entries will appear here when created'}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => (
            <Card
              key={entry.id}
              isPressable
              onPress={() => setSelectedEntry(entry)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
            >
              <CardBody className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                    {formatEntryDate(entry.title)}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">
                  {getPreview(entry.content)}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  // Render selected entry
  const renderSelectedEntry = () => (
    <div>
      {/* Back button */}
      <button
        onClick={() => setSelectedEntry(null)}
        className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Journal</span>
      </button>

      {/* Entry Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BookOpen className="w-6 h-6 text-violet-500" />
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
            {formatEntryDate(selectedEntry!.title)}
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Updated {new Date(selectedEntry!.updated_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      </div>

      <Divider className="mb-8" />

      {/* Layout with TOC sidebar */}
      <div className="flex gap-8">
        {/* Table of Contents - Desktop Sidebar */}
        {tableOfContents.length > 2 && (
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Contents
                </h4>
                {collapsibleSectionIds.length > 0 && (
                  <button
                    onClick={toggleAllSections}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                    title={allCollapsed ? 'Expand all' : 'Collapse all'}
                  >
                    {allCollapsed ? (
                      <ChevronsUpDown className="w-4 h-4" />
                    ) : (
                      <ChevronsDownUp className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              <nav className="space-y-1">
                {groupedTOC.title && (
                  <a
                    href={`#${groupedTOC.title.id}`}
                    className="block text-sm py-1 text-slate-800 dark:text-slate-100 font-semibold hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-2"
                  >
                    {groupedTOC.title.text}
                  </a>
                )}
                
                {groupedTOC.sections.map((section) => (
                  <div key={section.parent.id}>
                    <div className="flex items-center">
                      {section.children.length > 0 && (
                        <button
                          onClick={() => toggleSection(section.parent.id)}
                          className="p-0.5 -ml-1 mr-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label={collapsedSections.has(section.parent.id) ? 'Expand section' : 'Collapse section'}
                        >
                          {collapsedSections.has(section.parent.id) ? (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      )}
                      <a
                        href={`#${section.parent.id}`}
                        className={`flex-1 text-sm py-1 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium ${
                          section.children.length === 0 ? 'ml-4' : ''
                        }`}
                      >
                        {section.parent.text}
                      </a>
                    </div>
                    
                    {section.children.length > 0 && !collapsedSections.has(section.parent.id) && (
                      <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1 space-y-0.5">
                        {section.children.map((child) => (
                          <a
                            key={child.id}
                            href={`#${child.id}`}
                            className="block text-xs py-0.5 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                          >
                            {child.text}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <article className="flex-1 min-w-0">
          <div className="prose prose-slate dark:prose-invert max-w-none
            prose-headings:scroll-mt-8
            prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-8
            prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
            prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
            prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
            prose-ul:my-4 prose-ol:my-4
            prose-li:my-1
            prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
            prose-code:bg-slate-200 prose-code:text-slate-800 dark:prose-code:bg-slate-800 dark:prose-code:text-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-pre:p-0 prose-pre:bg-transparent prose-pre:rounded-lg prose-pre:overflow-hidden
            prose-blockquote:border-l-violet-500 prose-blockquote:bg-violet-50 dark:prose-blockquote:bg-violet-900/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
            prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-700
            prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:p-2 prose-th:border prose-th:border-slate-200 dark:prose-th:border-slate-700
            prose-td:p-2 prose-td:border prose-td:border-slate-200 dark:prose-td:border-slate-700
            prose-img:rounded-lg prose-img:shadow-md
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => {
                  const text = String(children)
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  return <h1 id={id}>{children}</h1>
                },
                h2: ({ children }) => {
                  const text = String(children)
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  return <h2 id={id}>{children}</h2>
                },
                h3: ({ children }) => {
                  const text = String(children)
                  const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  return <h3 id={id}>{children}</h3>
                },
                code: ({ className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const codeString = String(children).replace(/\n$/, '')
                  const isInline = !match && !codeString.includes('\n')
                  
                  if (isInline) {
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
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
                        lineHeight: '1.5',
                        borderRadius: '0.5rem',
                      }}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  )
                },
              }}
            >
              {selectedEntry!.content}
            </ReactMarkdown>
          </div>
        </article>
      </div>

      {/* Floating Scroll Button */}
      {showScrollButton && (
        <button
          onClick={handleScrollButton}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          aria-label={isAtBottom ? 'Scroll to top' : 'Scroll to bottom'}
        >
          {isAtBottom ? (
            <ArrowUp className="w-5 h-5" />
          ) : (
            <ArrowDown className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  )

  return selectedEntry ? renderSelectedEntry() : renderEntryList()
}
