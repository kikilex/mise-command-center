'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import { Button } from '@heroui/react'
import { Bold, Italic, Underline as UnderlineIcon, Highlighter, List, ListOrdered, Heading2 } from 'lucide-react'
import { useEffect } from 'react'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  minHeight?: string
  editable?: boolean
}

export default function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = 'Start writing...', 
  minHeight = '150px',
  editable = true 
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Underline,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none`,
        style: `min-height: ${minHeight}`,
      },
    },
  })

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!editor) return null

  return (
    <div className="border border-default-200 rounded-lg overflow-hidden bg-default-50 dark:bg-default-100">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-0.5 p-1.5 border-b border-default-200 bg-default-100 dark:bg-default-50 flex-wrap">
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('bold') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('italic') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('underline') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <UnderlineIcon className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('highlight') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleHighlight().run()}
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-5 bg-default-300 mx-1" />
          
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('heading', { level: 2 }) ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('bulletList') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant={editor.isActive('orderedList') ? 'solid' : 'light'}
            onPress={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Editor Content */}
      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
