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
import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import { 
  Brain, 
  Send, 
  Zap, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Activity,
  Bot,
  User,
  ArrowRight,
  MessageCircle,
} from 'lucide-react'

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
  status: 'pending' | 'processing' | 'processed'
  created_at: string
}

interface AIAgent {
  id: string
  name: string
  slug: string
  is_active: boolean
  role: string
}

type FilterType = 'all' | 'personal' | 'business'

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
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [brainDump, setBrainDump] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    space_id: '',
  });
  
  const supabase = createClient();

  // Get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    
    try {
      // Get user
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

      // Load spaces, tasks, inbox, agents
      const [spacesRes, tasksRes, inboxRes, agentsRes] = await Promise.all([
        supabase.from('spaces').select('id, name, color'),
        supabase.from('tasks')
          .select('*')
          .neq('status', 'done')
          .order('priority', { ascending: false }),
        supabase.from('inbox')
          .select('*')
          .eq('item_type', 'thought')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true })
      ]);

      setSpaces(spacesRes.data || []);
      setTodaysTasks(tasksRes.data || []);
      setInboxItems(inboxRes.data || []);
      setAgents(agentsRes.data || []);

    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Brain Dump Logic
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
      // 1. Create organize request message for Ax
      const content = `Please organize my brain dump:\n${inboxItems.map(i => `- ${i.content}`).join('\n')}`;
      
      const { error: msgError } = await supabase.from('inbox').insert({
        user_id: user.id,
        content,
        item_type: 'message',
        to_recipient: 'ax',
        status: 'pending'
      });
      if (msgError) throw msgError;

      // 2. Mark items as processing
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

  // Toggle task completion
  async function toggleTaskDone(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (error) throw error;

      // Remove from list
      setTodaysTasks(prev => prev.filter(t => t.id !== taskId));
      showSuccessToast('Task completed!');
    } catch (error) {
      console.error('Toggle task error:', error);
      showErrorToast(error, 'Failed to update task');
    }
  }

  // Quick add task
  async function handleQuickAdd() {
    if (!user) {
      showErrorToast(null, 'Please sign in to add tasks');
      return;
    }

    if (!formData.title.trim()) {
      showErrorToast(null, 'Please enter a task title');
      return;
    }

    setSubmitting(true);

    try {
      const todayStr = getTodayString();
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title,
          description: formData.description || null,
          priority: formData.priority,
          business_id: formData.business_id || null,
          status: 'todo',
          due_date: `${todayStr}T12:00:00`,
          created_by: user.id,
        });

      if (error) throw error;

      showSuccessToast('Task added!');
      handleCloseModal();
      loadData();
    } catch (error) {
      console.error('Add task error:', error);
      showErrorToast(error, 'Failed to add task');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCloseModal() {
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      business_id: '',
    });
    onClose();
  }

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  // Get context badge for a task
  const getContextBadge = (task: Task) => {
    if (task.business && task.business_id) {
      return (
        <Chip 
          size="sm" 
          variant="flat"
          style={{ 
            backgroundColor: `${task.business.color}20`,
            color: task.business.color,
            borderColor: task.business.color,
          }}
          className="border"
        >
          🏢 {task.business.name}
        </Chip>
      );
    }
    return (
      <Chip 
        size="sm" 
        variant="flat"
        className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
      >
        👤 Personal
      </Chip>
    );
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
          {/* LEFT COLUMN: Brain Dump + What's Next */}
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
                      <p className="text-xs text-slate-500">{inboxItems.length} pending thoughts</p>
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
                <div className="flex gap-2 mb-6">
                  <Input 
                    placeholder="What's on your mind? Hit enter to capture..."
                    value={brainDump}
                    onChange={(e) => setBrainDump(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBrainDump()}
                    className="flex-1"
                    classNames={{
                      inputWrapper: "bg-slate-100 dark:bg-slate-800 border-none h-12"
                    }}
                  />
                  <Button 
                    isIconOnly 
                    color="primary" 
                    className="h-12 w-12"
                    onPress={handleBrainDump}
                    isLoading={submitting}
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">Recent thoughts</p>
                  {inboxItems.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-400 italic">No pending thoughts. Capturing is key.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {inboxItems.slice(0, 6).map((item) => (
                        <div key={item.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-1 italic">"{item.content}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* ✅ What's Next (High Priority Tasks) */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="px-6 py-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">What's Next</h2>
                    <p className="text-xs text-slate-500">Highest priority hits</p>
                  </div>
                </div>
                <Button variant="light" color="primary" onPress={() => router.push('/tasks')}>View All</Button>
              </CardHeader>
              <CardBody className="p-4 space-y-2">
                {loading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl w-full" />)
                ) : todaysTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-500">The hit list is empty. Go find some work.</p>
                  </div>
                ) : (
                  todaysTasks.slice(0, 5).map((task) => (
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
                  ))
                )}
              </CardBody>
            </Card>
          </div>

          {/* RIGHT COLUMN: Messages + Agent Status */}
          <div className="w-full lg:w-96 space-y-8">
            {/* 📥 Messages Widget */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Intel
                  </h2>
                  <Button size="sm" variant="light" onPress={() => router.push('/inbox')}>Open Inbox</Button>
                </div>
              </CardHeader>
              <CardBody className="px-4 pb-4">
                <div className="space-y-4">
                  <p className="text-center py-12 text-slate-400 text-sm italic border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                    No new intel. Keep it that way.
                  </p>
                </div>
              </CardBody>
            </Card>

            {/* 🤖 Agent Status Cards */}
            <div className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">
                <Bot className="w-4 h-4" /> Agent Status
              </h2>
              <div className="grid grid-cols-1 gap-4">
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
                          <Avatar 
                            name={agent.name} 
                            size="sm" 
                            className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black" 
                          />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{agent.name}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">{agent.role.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Chip 
                            size="sm" 
                            variant="dot" 
                            color={agent.is_active ? 'success' : 'default'}
                            className="h-6"
                          >
                            {agent.is_active ? 'Online' : 'Offline'}
                          </Chip>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

      {/* Floating Quick Add Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          color="primary"
          size="lg"
          className="rounded-full w-14 h-14 min-w-[56px] min-h-[56px] shadow-lg"
          isIconOnly
          onPress={onOpen}
          aria-label="Add task"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>

      {/* Quick Add Modal */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} size="lg">
        <ModalContent>
          <ModalHeader className="text-lg font-semibold">
            Quick Add Task
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="What needs to be done?"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                autoFocus
                isRequired
              />
              <Textarea
                label="Description (optional)"
                placeholder="Add details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                minRows={2}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Priority"
                  selectedKeys={[formData.priority]}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {priorityOptions.map(p => (
                    <SelectItem key={p.key}>{p.label}</SelectItem>
                  ))}
                </Select>
                <Select
                  label="Context"
                  selectedKeys={formData.business_id ? [formData.business_id] : []}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  placeholder="Personal"
                >
                  {businesses.map(biz => (
                    <SelectItem key={biz.id}>🏢 {biz.name}</SelectItem>
                  ))}
                </Select>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Task will be due today
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleCloseModal}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleQuickAdd}
              isDisabled={!formData.title.trim()}
              isLoading={submitting}
            >
              Add Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
