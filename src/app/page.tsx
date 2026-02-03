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
  Clock,
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
  status: 'pending' | 'processing' | 'processed'
  created_at: string
}

interface AIAgent {
  id: string
  name: string
  slug: string
  is_active: boolean
  role: string
  last_action?: string
  last_action_at?: string
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

      const [spacesRes, tasksRes, inboxRes, messagesRes, agentsRes, logsRes] = await Promise.all([
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
        supabase.from('inbox')
          .select('*')
          .eq('item_type', 'message')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      setSpaces(spacesRes.data || []);
      setTodaysTasks(tasksRes.data || []);
      setInboxItems(inboxRes.data || []);
      setMessages(messagesRes.data || []);
      
      const enrichedAgents = (agentsRes.data || []).map(agent => {
        const lastLog = (logsRes.data || []).find(l => l.agent_name.toLowerCase() === agent.slug.toLowerCase());
        return {
          ...agent,
          last_action: lastLog?.action,
          last_action_at: lastLog?.created_at
        };
      });
      setAgents(enrichedAgents);

    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskDone(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'done' })
        .eq('id', taskId);

      if (error) throw error;
      setTodaysTasks(prev => prev.filter(t => t.id !== taskId));
      showSuccessToast('Task completed!');
    } catch (error) {
      showErrorToast(error, 'Failed to update task');
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

  const timeAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    return `${Math.floor(s/3600)}h ago`
  }

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
                      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-black uppercase tracking-tighter">Brain Dump</h2>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{inboxItems.length} pending hits</p>
                    </div>
                  </div>
                  {inboxItems.length > 0 && (
                    <Button 
                      size="sm" 
                      color="primary" 
                      variant="flat" 
                      onPress={handleOrganize}
                      isLoading={submitting}
                      className="font-bold uppercase text-[10px]"
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
                      inputWrapper: "bg-slate-100 dark:bg-slate-800 border-none h-12 shadow-none"
                    }}
                  />
                  <Button isIconOnly color="primary" className="h-12 w-12" onPress={handleBrainDump} isLoading={submitting}>
                    <Plus className="w-6 h-6" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Recent Intel</p>
                  {inboxItems.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400 italic">No pending thoughts.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {inboxItems.slice(0, 6).map((item) => (
                        <div key={item.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                          <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1 italic">"{item.content}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* ✅ What's Next */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="px-6 py-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold font-black uppercase tracking-tighter">What's Next</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Highest priority hits</p>
                  </div>
                </div>
                <Button size="sm" variant="light" color="primary" className="font-bold uppercase text-[10px]" onPress={() => router.push('/tasks')}>View All</Button>
              </CardHeader>
              <CardBody className="p-4 space-y-2">
                {loading ? (
                  [1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl w-full" />)
                ) : todaysTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-500">The hit list is empty.</p>
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

          <div className="w-full lg:w-96 space-y-8">
            {/* 📥 Messages Widget */}
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="px-6 pt-5 pb-2">
                <div className="flex items-center justify-between w-full">
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" /> Recent Intel
                  </h2>
                  <Button size="sm" variant="light" className="font-bold uppercase text-[10px]" onPress={() => router.push('/inbox')}>View All</Button>
                </div>
              </CardHeader>
              <CardBody className="px-4 pb-4">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center py-12 text-slate-400 text-sm italic border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
                      No new intel.
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        onClick={() => router.push('/inbox')}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-900 transition-all cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] font-black uppercase text-violet-500">{msg.from_agent || 'You'}</span>
                          <span className="text-[8px] text-slate-400 uppercase font-bold">{timeAgo(msg.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 leading-tight">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardBody>
            </Card>

            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 px-1 flex items-center gap-2">
                <Bot className="w-4 h-4" /> Agent Status
              </h2>
              {agents.map((agent) => (
                <Card 
                  key={agent.id} 
                  isPressable 
                  onPress={() => router.push('/ai')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden group"
                >
                  <div className={`h-1 w-full ${agent.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                  <CardBody className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar name={agent.name} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black" />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">{agent.name}</p>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">{agent.role.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                        <Chip size="sm" variant="dot" color={agent.is_active ? 'success' : 'default'} className="h-6 font-bold uppercase text-[9px]">
                          {agent.is_active ? 'Online' : 'Offline'}
                        </Chip>
                      </div>
                      {agent.last_action && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <p className="text-[9px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                            <Activity className="w-2.5 h-2.5" /> Recent action
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 italic font-medium">"{agent.last_action}"</p>
                          <p className="text-[8px] text-slate-400 uppercase mt-1">{timeAgo(agent.last_action_at || '')}</p>
                        </div>
                      )}
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
