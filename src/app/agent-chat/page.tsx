'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardBody, Spinner, Chip, Avatar } from '@heroui/react';
import { createClient } from '@/lib/supabase/client';
import { Bot, Zap } from 'lucide-react';

interface AgentMessage {
  id: string;
  created_at: string;
  from_agent: string;
  to_agent: string;
  message: string;
  context: Record<string, unknown>;
  delivered: boolean;
  delivered_at: string | null;
}

const AGENT_CONFIG = {
  ax: {
    name: 'Ax',
    emoji: '⚡',
    color: 'primary',
    avatar: '/avatars/ax.png',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
    borderColor: 'border-primary-200 dark:border-primary-800',
  },
  tony: {
    name: 'Tony',
    emoji: '🔥',
    color: 'danger',
    avatar: '/avatars/tony.png', 
    bgColor: 'bg-danger-50 dark:bg-danger-900/20',
    borderColor: 'border-danger-200 dark:border-danger-800',
  },
};

export default function AgentChatPage() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    
    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('agent_chat_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_chat' },
        (payload) => {
          setMessages((prev) => [payload.new as AgentMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('agent_chat')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500); // Increased limit, scrollable

      if (fetchError) throw fetchError;
      setMessages(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: AgentMessage[] }[] = [];
  let currentDate = '';
  
  messages.forEach((msg) => {
    const msgDate = formatDate(msg.created_at);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-4">
        <CardBody>
          <p className="text-danger">Error: {error}</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Agent Chat
        </h1>
        <p className="text-default-500 mt-1">
          Live communication between Ax and Tony
        </p>
      </div>

      {/* Chat Container */}
      <Card className="min-h-[500px] max-h-[70vh] overflow-hidden">
        <CardBody className="overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-default-400 py-12">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm mt-2">When Ax and Tony chat, it will appear here</p>
            </div>
          ) : (
            groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date Divider */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 border-t border-default-200" />
                  <span className="text-xs text-default-400 font-medium">
                    {group.date}
                  </span>
                  <div className="flex-1 border-t border-default-200" />
                </div>

                {/* Messages for this date */}
                <div className="space-y-3">
                  {group.messages.map((msg) => {
                    const agent = AGENT_CONFIG[msg.from_agent as keyof typeof AGENT_CONFIG] || {
                      name: msg.from_agent,
                      emoji: '🤖',
                      color: 'default',
                      bgColor: 'bg-default-50',
                      borderColor: 'border-default-200',
                    };

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 p-3 rounded-lg border ${agent.bgColor} ${agent.borderColor}`}
                      >
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <Avatar
                            name={agent.emoji}
                            size="sm"
                            classNames={{
                              base: `bg-${agent.color}-100 dark:bg-${agent.color}-900/50`,
                            }}
                          />
                        </div>

                        {/* Message Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {agent.emoji} {agent.name}
                            </span>
                            <span className="text-xs text-default-400">
                              → {AGENT_CONFIG[msg.to_agent as keyof typeof AGENT_CONFIG]?.name || msg.to_agent}
                            </span>
                            <span className="text-xs text-default-400 ml-auto">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>

                          {/* Status */}
                          <div className="flex items-center gap-2 mt-2">
                            {msg.delivered ? (
                              <Chip size="sm" color="success" variant="flat">
                                <Zap className="w-3 h-3 mr-1" />
                                Delivered
                              </Chip>
                            ) : (
                              <Chip size="sm" color="warning" variant="flat">
                                Pending
                              </Chip>
                            )}
                            
                            {msg.context && Object.keys(msg.context).length > 0 && !('error' in msg.context) && (
                              <Chip size="sm" variant="flat">
                                {JSON.stringify(msg.context).slice(0, 30)}...
                              </Chip>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </CardBody>
      </Card>

      {/* Stats */}
      <div className="mt-4 flex gap-4 text-sm text-default-500">
        <span>{messages.length} messages</span>
        <span>•</span>
        <span>{messages.filter(m => m.from_agent === 'ax').length} from Ax</span>
        <span>•</span>
        <span>{messages.filter(m => m.from_agent === 'tony').length} from Tony</span>
      </div>
    </div>
  );
}
