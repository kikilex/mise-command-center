'use client'

import { useState, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button, Textarea } from '@heroui/react'

interface TaskCommentInputProps {
  onSend: (message: string) => Promise<void>
  isLoading?: boolean
}

export default function TaskCommentInput({
  onSend,
  isLoading = false,
}: TaskCommentInputProps) {
  const [message, setMessage] = useState('')

  const handleSend = async () => {
    if (!message.trim() || isLoading) return
    const currentMessage = message.trim()
    setMessage('')
    try {
      await onSend(currentMessage)
    } catch (error) {
      // Restore message if send fails
      setMessage(currentMessage)
      console.error('Failed to send comment:', error)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
      <Textarea
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown as any}
        minRows={1}
        maxRows={4}
        variant="flat"
        classNames={{
          input: "text-sm py-2",
          inputWrapper: "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border-none",
        }}
        isDisabled={isLoading}
      />
      <Button
        isIconOnly
        color="primary"
        radius="full"
        onPress={handleSend}
        isLoading={isLoading}
        isDisabled={!message.trim()}
        size="sm"
        className="mb-1"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  )
}
