'use client'

import { useState } from 'react'
import { Card, CardBody, Input, Button, ScrollShadow, Avatar } from '@heroui/react'
import { Send, Bot } from 'lucide-react'

export default function AgentChat() {
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState([
    { role: 'agent', name: 'Ax', content: 'Hey Boss, ready to build the empire?' },
    { role: 'agent', name: 'Tony', content: 'Quit talkin\' and let\'s move some weight.' }
  ])

  return (
    <Card className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Chat History */}
        <ScrollShadow className="flex-1 p-4 space-y-4">
          {chat.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <Avatar 
                size="sm"
                name={msg.name}
                className={msg.role === 'agent' ? 'bg-violet-600' : 'bg-blue-600'}
              />
              <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
              }`}>
                <p className="font-bold text-[10px] mb-1 opacity-70 uppercase">{msg.name}</p>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
        </ScrollShadow>

        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <Input 
            placeholder="Talk to your agents..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && message && (setChat([...chat, { role: 'user', name: 'Alex', content: message }]), setMessage(''))}
            classNames={{
              inputWrapper: "bg-slate-50 dark:bg-slate-800 border-none"
            }}
          />
          <Button isIconOnly color="primary" radius="full">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
