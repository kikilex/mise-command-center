'use client'

import { useState, useEffect } from 'react'
import { X, Download, Copy, Check, ExternalLink } from 'lucide-react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
} from '@heroui/react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface FileViewerModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  fileUrl: string | null
  fileType: string | null
}

// Map file extensions to syntax highlighter languages
const getLanguage = (fileName: string, fileType: string | null): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const extensionMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'mjs': 'javascript',
    'cjs': 'javascript',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    
    // Data formats
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'csv': 'csv',
    
    // Markdown/Text
    'md': 'markdown',
    'mdx': 'mdx',
    'txt': 'text',
    
    // Programming languages
    'py': 'python',
    'rb': 'ruby',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'r': 'r',
    
    // Shell/Config
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'ps1': 'powershell',
    'bat': 'batch',
    'cmd': 'batch',
    
    // Config files
    'env': 'bash',
    'ini': 'ini',
    'conf': 'ini',
    'cfg': 'ini',
    
    // SQL
    'sql': 'sql',
    
    // Docker
    'dockerfile': 'docker',
    
    // GraphQL
    'graphql': 'graphql',
    'gql': 'graphql',
  }
  
  // Check for special filenames
  const lowerName = fileName.toLowerCase()
  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) return 'docker'
  if (lowerName === 'makefile') return 'makefile'
  if (lowerName === '.gitignore' || lowerName === '.dockerignore') return 'bash'
  
  return extensionMap[ext || ''] || 'text'
}

// Check if file is viewable as text
export const isViewableFile = (fileName: string, fileType: string | null): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  // Text-based file extensions
  const viewableExtensions = [
    'txt', 'md', 'mdx', 'json', 'xml', 'yaml', 'yml', 'toml', 'csv',
    'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
    'html', 'htm', 'css', 'scss', 'sass', 'less',
    'py', 'rb', 'php', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'swift', 'kt', 'scala', 'r',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    'env', 'ini', 'conf', 'cfg',
    'sql', 'graphql', 'gql',
    'dockerfile', 'makefile', 'gitignore', 'dockerignore',
    'log', 'diff', 'patch',
  ]
  
  // Check by extension
  if (ext && viewableExtensions.includes(ext)) return true
  
  // Check by MIME type
  if (fileType?.startsWith('text/')) return true
  if (fileType === 'application/json') return true
  if (fileType === 'application/xml') return true
  if (fileType === 'application/javascript') return true
  
  // Special filenames
  const lowerName = fileName.toLowerCase()
  if (['dockerfile', 'makefile', '.gitignore', '.dockerignore', '.env', '.env.local', '.env.example'].some(n => lowerName === n || lowerName.endsWith(n))) {
    return true
  }
  
  return false
}

export default function FileViewerModal({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  fileType,
}: FileViewerModalProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { resolvedTheme } = useTheme()
  
  const language = getLanguage(fileName, fileType)
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    if (isOpen && fileUrl) {
      loadFileContent()
    }
    return () => {
      setContent('')
      setError(null)
      setLoading(true)
    }
  }, [isOpen, fileUrl])

  async function loadFileContent() {
    if (!fileUrl) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(fileUrl)
      
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status}`)
      }
      
      const text = await response.text()
      
      // Check if file is too large (> 1MB of text)
      if (text.length > 1024 * 1024) {
        setError('File is too large to display. Please download it instead.')
        return
      }
      
      setContent(text)
    } catch (err) {
      console.error('Load file error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load file content')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      showSuccessToast('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      showErrorToast(err, 'Failed to copy')
    }
  }

  function handleDownload() {
    if (fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  const lineCount = content.split('\n').length

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="full"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[95vh] sm:max-h-[90vh] m-2 sm:m-4",
        header: "border-b border-slate-200 dark:border-slate-700",
        body: "p-0",
        footer: "border-t border-slate-200 dark:border-slate-700",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 px-4 py-3">
          {/* File info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-lg">📄</span>
            <span className="font-medium truncate text-sm sm:text-base">{fileName}</span>
            {!loading && !error && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                {lineCount} lines • {language}
              </span>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="flat"
              onPress={handleCopy}
              isDisabled={loading || !!error}
              startContent={copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              className="hidden sm:flex"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={handleDownload}
              startContent={<Download className="w-4 h-4" />}
              className="hidden sm:flex"
            >
              Download
            </Button>
            {/* Mobile-only icon buttons */}
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              onPress={handleCopy}
              isDisabled={loading || !!error}
              className="sm:hidden"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              onPress={handleDownload}
              className="sm:hidden"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              onPress={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </ModalHeader>
        
        <ModalBody className="overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size="lg" />
              <span className="ml-3 text-slate-500">Loading file...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
              <Button color="primary" onPress={handleDownload} startContent={<Download className="w-4 h-4" />}>
                Download Instead
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Mobile line count info */}
              <div className="sm:hidden bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                {lineCount} lines • {language}
              </div>
              
              <SyntaxHighlighter
                language={language}
                style={isDark ? oneDark : oneLight}
                showLineNumbers
                wrapLines
                wrapLongLines
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  borderRadius: 0,
                  minHeight: '300px',
                }}
                lineNumberStyle={{
                  minWidth: '3em',
                  paddingRight: '1em',
                  color: isDark ? '#666' : '#999',
                  userSelect: 'none',
                }}
              >
                {content}
              </SyntaxHighlighter>
            </div>
          )}
        </ModalBody>
        
        {/* Mobile footer with full buttons */}
        <ModalFooter className="sm:hidden flex gap-2">
          <Button
            variant="flat"
            onPress={handleCopy}
            isDisabled={loading || !!error}
            startContent={copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            className="flex-1"
          >
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button
            color="primary"
            onPress={handleDownload}
            startContent={<Download className="w-4 h-4" />}
            className="flex-1"
          >
            Download
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
