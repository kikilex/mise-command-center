'use client'

import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Skeleton,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  useDisclosure,
  Avatar,
  Divider,
  ScrollShadow,
} from "@heroui/react";
import { useState, useEffect, useMemo } from "react";
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import { 
  Brain, 
  Zap, 
  CheckCircle2, 
  Plus, 
  Activity,
  Bot,
  ArrowRight,
  MessageCircle,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

interface Space {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  space_id: string | null
  due_date: string | null
}

interface InboxItem {
  id: string
  content: string
  item_type: 'thought' | 'message'
  from_agent: string | null
  to_recipient: string | null
  thread_id: string | null
  subject: string | null
  tags: string[] | null
  status: 'pending' | 'processing' | 'processed'
  created_at: string
}

interface MessageThread {
  recipient: string
  lastMessage: InboxItem
  messageCount: number
  threadId: string | null
}

interface AIAgent {
  id: string
  name: string
  slug: string
  is_active: boolean
  role: string
}

const priorityOptions = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
]

export default function Home() {
  const [user, setUser] = useState<UserData | null>(null);
  const [todaysTasks, setTodaysTasks] = useState<Task[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [messages, setMessages] = useState<InboxItem[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brainDump, setBrainDump] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewingDump, setViewingDump] = useState<InboxItem | null>(null);
  const [editingDump, setEditingDump] = useState<InboxItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const { isOpen: isViewOpen, onOpen: onViewOpen, onClose: onViewClose } = useDisclosure();
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    space_id: '',
  });
  
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Not authenticated');
      
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single();
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: profile?.name || authUser.email?.split('@')[0],
        avatar_url: profile?.avatar_url,
        role: profile?.role || 'member'
      });

      const [spacesRes, tasksRes, completedRes, inboxRes, messagesRes, agentsRes] = await Promise.all([
        supabase.from('spaces').select('id, name, color'),
        supabase.from('tasks')
          .select('*')
          .neq('status', 'done')
          .order('priority', { ascending: false }),
        supabase.from('tasks')
          .select('*')
          .eq('status', 'done')
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase.from('inbox')
          .select('*')
          .eq('item_type', 'thought')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('inbox')
          .select('*')
          .eq('item_type', 'message')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true })
      ]);

      setSpaces(spacesRes.data || []);
      setTodaysTasks(tasksRes.data || []);
      setCompletedTasks(completedRes.data || []);
      setInboxItems(inboxRes.data || []);
      setMessages(messagesRes.data || []);
      setAgents(agentsRes.data || []);

    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskDone(taskId: string) {
    try {
      const task = todaysTasks.find(t => t.id === taskId);
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) throw error;
      setTodaysTasks(prev => prev.filter(t => t.id !== taskId));
      if (task) setCompletedTasks(prev => [{ ...task, status: 'done' }, ...prev].slice(0, 5));
      showSuccessToast('Task completed!');
    } catch (error) {
      showErrorToast(error, 'Failed to update task');
    }
  }

  async function revertTask(taskId: string) {
    try {
      const task = completedTasks.find(t => t.id === taskId);
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'todo', updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
      setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
      if (task) setTodaysTasks(prev => [{ ...task, status: 'todo' }, ...prev]);
      showSuccessToast('Task reopened');
    } catch (error) {
      showErrorToast(error, 'Failed to revert task');
    }
  }

  async function handleAddTag(itemId: string, tag: string) {
    if (!tag.trim()) return;
    const item = inboxItems.find(i => i.id === itemId);
    const currentTags = item?.tags || [];
    if (currentTags.includes(tag.trim())) return;
    const newTags = [...currentTags, tag.trim()];
    try {
      const { error } = await supabase
        .from('inbox')
        .update({ tags: newTags })
        .eq('id', itemId);
      if (error) throw error;
      setInboxItems(prev => prev.map(i => i.id === itemId ? { ...i, tags: newTags } : i));
    } catch (error) {
      showErrorToast(error, 'Failed to add tag');
    }
  }

  async function handleRemoveTag(itemId: string, tag: string) {
    const item = inboxItems.find(i => i.id === itemId);
    const newTags = (item?.tags || []).filter(t => t !== tag);
    try {
      const { error } = await supabase
        .from('inbox')
        .update({ tags: newTags })
        .eq('id', itemId);
      if (error) throw error;
      setInboxItems(prev => prev.map(i => i.id === itemId ? { ...i, tags: newTags } : i));
    } catch (error) {
      showErrorToast(error, 'Failed to remove tag');
    }
  }

  // Group messages into threads
  const messageThreads = useMemo<MessageThread[]>(() => {
    const threadMap = new Map<string, { messages: InboxItem[], recipient: string }>();
    messages.forEach(msg => {
      const key = msg.thread_id || msg.to_recipient || msg.from_agent || 'unknown';
      const recipient = msg.to_recipient || msg.from_agent || 'unknown';
      if (!threadMap.has(key)) {
        threadMap.set(key, { messages: [], recipient });
      }
      threadMap.get(key)!.messages.push(msg);
    });
    return Array.from(threadMap.entries()).map(([key, val]) => ({
      recipient: val.recipient,
      lastMessage: val.messages[0],
      messageCount: val.messages.length,
      threadId: val.messages[0].thread_id,
    })).slice(0, 5);
  }, [messages]);

  async function handleDeleteDump(id: string) {
    try {
      const { error } = await supabase.from('inbox').delete().eq('id', id);
      if (error) throw error;
      setInboxItems(prev => prev.filter(i => i.id !== id));
      showSuccessToast('Removed');
    } catch (error) {
      showErrorToast(error, 'Failed to delete');
    }
  }

  async function handleEditDump(item: InboxItem) {
    setEditingDump(item);
    setEditContent(item.content);
  }

  async function handleSaveEdit() {
    if (!editingDump || !editContent.trim()) return;
    try {
      const { error } = await supabase
        .from('inbox')
        .update({ content: editContent.trim() })
        .eq('id', editingDump.id);
      if (error) throw error;
      setInboxItems(prev => prev.map(i => i.id === editingDump.id ? { ...i, content: editContent.trim() } : i));
      setEditingDump(null);
      setEditContent('');
      showSuccessToast('Updated');
    } catch (error) {
      showErrorToast(error, 'Failed to update');
    }
  }

  async function handleBrainDump() {
    if (!brainDump.trim() || !user) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('inbox')
        .insert({
          user_id: user.id,
          content: brainDump.trim(),
          item_type: 'thought',
          status: 'pending'
        })
        .select()
        .single();
      if (error) throw error;
      setInboxItems([data, ...inboxItems]);
      setBrainDump('');
      showSuccessToast('Thought captured');
    } catch (error) {
      showErrorToast(error, 'Failed to capture thought');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOrganize() {
    if (inboxItems.length === 0 || !user) return;
    setSubmitting(true);
    try {
      const content = `Please organize my brain dump:\n${inboxItems.map(i => `- ${i.content}`).join('\n')}`;
      const { error: msgError } = await supabase.from('inbox').insert({
        user_id: user.id,
        content,
        item_type: 'message',
        to_recipient: 'ax',
        status: 'pending'
      });
      if (msgError) throw msgError;

      const ids = inboxItems.map(i => i.id);
      await supabase.from('inbox').update({ status: 'processing' }).in('id', ids);

      setInboxItems([]);
      showSuccessToast('Ax is organizing your thoughts');
    } catch (error) {
      showErrorToast(error, 'Failed to start organization');
    } finally {
      setSubmitting(false);
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  if (loadError && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <ErrorFallback error={loadError} resetError={loadData} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-8">
            {/* 🧠 Brain Dump System */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                      <Brain className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Brain Dump</h2>
                      <p className="text-xs text-slate-500">{inboxItems.length} pending thought{inboxItems.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {inboxItems.length > 0 && (
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat" 
                      onPress={handleOrganize}
                      isLoading={submitting}
                      endContent={<ArrowRight className="w-4 h-4" />}
                    >
                      Ask Ax to Organize
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-6">
                <div className="flex items-end gap-2 mb-6">
                  <Textarea 
                    placeholder="What's on your mind? Hit enter to capture..."
                    value={brainDump}
                    onChange={(e) => setBrainDump(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleBrainDump();
                      }
                    }}
                    minRows={1}
                    maxRows={6}
                    className="flex-1"
                    classNames={{
                      inputWrapper: "bg-slate-100 dark:bg-slate-800 border-none shadow-none"
                    }}
                  />
                  <Button isIconOnly color="primary" className="h-10 w-10 min-w-10 mb-0.5" radius="full" onPress={handleBrainDump} isLoading={submitting}>
                    <Plus className="w-5 h-5" />
                  </Button>
                </div>

                {inboxItems.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                    <p className="text-sm text-slate-400">No pending thoughts. Dump away.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {inboxItems.map((item) => (
                      <div key={item.id} className="group">
                        {editingDump?.id === item.id ? (
                          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                              size="sm"
                              autoFocus
                              className="flex-1"
                            />
                            <Button isIconOnly size="sm" color="primary" variant="flat" onPress={handleSaveEdit}>
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button isIconOnly size="sm" variant="light" onPress={() => setEditingDump(null)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                            onClick={() => { setViewingDump(item); onViewOpen(); }}
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-2" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 break-words">{item.content}</p>
                              {item.tags && item.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.tags.map(tag => (
                                    <Chip key={tag} size="sm" variant="flat" color="secondary" className="h-5 text-[10px]">{tag}</Chip>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                              <Button 
                                isIconOnly size="sm" variant="light" 
                                className="w-7 h-7 min-w-7"
                                onPress={() => handleEditDump(item)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              </Button>
                              <Button 
                                isIconOnly size="sm" variant="light" color="danger"
                                className="w-7 h-7 min-w-7"
                                onPress={() => handleDeleteDump(item.id)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <span className="text-[10px] text-slate-400 flex-shrink-0 group-hover:hidden mt-1">
                              {new Date(item.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {/* Brain Dump View Modal */}
            <Modal isOpen={isViewOpen} onClose={onViewClose} size="md">
              <ModalContent>
                <ModalHeader className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-violet-500" />
                  Thought
                </ModalHeader>
                <ModalBody className="pb-6">
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">{viewingDump?.content}</p>
                  
                  {/* Tags */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(viewingDump?.tags || []).map(tag => (
                        <Chip 
                          key={tag} 
                          size="sm" 
                          variant="flat" 
                          color="secondary" 
                          onClose={() => viewingDump && handleRemoveTag(viewingDump.id, tag)}
                        >
                          {tag}
                        </Chip>
                      ))}
                      {(!viewingDump?.tags || viewingDump.tags.length === 0) && (
                        <span className="text-xs text-slate-400">No tags yet</span>
                      )}
                    </div>
                    <Input
                      size="sm"
                      placeholder="Add a tag and press Enter..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && viewingDump) {
                          handleAddTag(viewingDump.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                      classNames={{ inputWrapper: "bg-slate-50 dark:bg-slate-800 border-none shadow-none h-9" }}
                    />
                  </div>

                  <p className="text-xs text-slate-400 mt-3">
                    {viewingDump && new Date(viewingDump.created_at).toLocaleString()}
                  </p>
                </ModalBody>
              </ModalContent>
            </Modal>

            {/* ✅ What's Next */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="px-6 py-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">What's Next</h2>
                    <p className="text-xs text-slate-500">Top 3 priorities</p>
                  </div>
                </div>
                <Button variant="light" color="primary" onPress={() => router.push('/tasks')}>View All</Button>
              </CardHeader>
              <CardBody className="p-4">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl w-full" />)}
                  </div>
                ) : todaysTasks.length === 0 && completedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-500">The hit list is empty.</p>
                  </div>
                ) : (
                  <>
                    {/* Active tasks - max 3 */}
                    <div className="space-y-2">
                      {todaysTasks.slice(0, 3).map((task) => (
                        <div 
                          key={task.id}
                          onClick={() => router.push(`/tasks?openTask=${task.id}`)}
                          className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)} shadow-lg shadow-current/20`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px] uppercase font-bold tracking-tight">
                                {spaces.find(s => s.id === task.space_id)?.name || 'General'}
                              </Chip>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleTaskDone(task.id); }}
                            className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center group-hover:border-emerald-500 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/20 transition-all"
                          >
                            <CheckCircle2 className="w-5 h-5 text-transparent group-hover:text-emerald-500" />
                          </button>
                        </div>
                      ))}
                      {todaysTasks.length === 0 && (
                        <div className="text-center py-6">
                          <p className="text-sm text-slate-400">All caught up 🎉</p>
                        </div>
                      )}
                    </div>

                    {/* Completed tasks */}
                    {completedTasks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Completed</p>
                        <div className="space-y-1">
                          {completedTasks.slice(0, 3).map(task => (
                            <div 
                              key={task.id} 
                              className="group/done flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                              onClick={() => revertTask(task.id)}
                              title="Click to reopen"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 group-hover/done:text-orange-400 transition-colors" />
                              <span className="text-sm text-slate-400 line-through truncate group-hover/done:text-slate-600 dark:group-hover/done:text-slate-300 transition-colors">{task.title}</span>
                              <span className="text-[10px] text-transparent group-hover/done:text-orange-400 ml-auto transition-colors">undo</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="w-full lg:w-96 space-y-8">
            {/* Messages - Thread List (iOS Style) */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Messages</span>
                  </div>
                  <Button size="sm" variant="light" radius="full" onPress={() => router.push('/inbox')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {messageThreads.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">No conversations yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {messageThreads.map((thread, idx) => {
                      const isAI = ['ax', 'tony'].includes(thread.recipient.toLowerCase())
                      return (
                        <div 
                          key={idx} 
                          onClick={() => router.push(`/inbox?thread=${thread.recipient}`)}
                          className="flex items-center gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <div className="relative">
                            <Avatar 
                              size="sm" 
                              name={thread.recipient}
                              className={isAI ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}
                            />
                            {isAI && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                                <Bot className="w-3 h-3 text-violet-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 capitalize">
                                {thread.recipient}
                              </span>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {new Date(thread.lastMessage.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{thread.lastMessage.content}</p>
                          </div>
                          {thread.messageCount > 1 && (
                            <Chip size="sm" variant="flat" className="h-5 min-w-5 text-[10px]">{thread.messageCount}</Chip>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardBody>
            </Card>

            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">
                <Bot className="w-4 h-4" /> Agent Status
              </h2>
              {agents.map((agent) => (
                <Card 
                  key={agent.id} 
                  isPressable 
                  onPress={() => router.push('/ai')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                >
                  <div className={`h-1 w-full ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar name={agent.name} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{agent.name}</p>
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">{agent.role.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <Chip size="sm" variant="dot" color={agent.is_active ? 'success' : 'default'} className="h-6">
                        {agent.is_active ? 'Online' : 'Offline'}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
