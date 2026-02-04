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
  Clock,
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
  assignee_id?: string | null
  updated_at?: string
  created_at?: string
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
  subject: string | null
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
  last_action?: string
  last_action_at?: string
}

interface WorkLogEntry {
  agent_name: string
  action: string
  created_at: string
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
  
  // Task modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { isOpen: isTaskModalOpen, onOpen: onTaskModalOpen, onClose: onTaskModalClose } = useDisclosure();
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [taskEditData, setTaskEditData] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    due_date: '',
  });
  
  // Agent modal state
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const { isOpen: isAgentModalOpen, onOpen: onAgentModalOpen, onClose: onAgentModalClose } = useDisclosure();
  const [agentTasks, setAgentTasks] = useState<{upcoming: Task[], completed: Task[]}>({ upcoming: [], completed: [] });
  const [loadingAgentTasks, setLoadingAgentTasks] = useState(false);
  
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

      const [spacesRes, tasksRes, completedRes, inboxRes, messagesRes, agentsRes, workLogRes] = await Promise.all([
        supabase.from('spaces').select('id, name, color, space_members!inner(user_id)').eq('space_members.user_id', authUser.id),
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
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('ai_work_log').select('agent_name,action,created_at').order('created_at', { ascending: false }).limit(10)
      ]);

      // Merge latest work log action into agents
      const workLogs: WorkLogEntry[] = workLogRes.data || [];
      const agentsWithActions = (agentsRes.data || []).map((agent: AIAgent) => {
        const latestLog = workLogs.find(w => w.agent_name?.toLowerCase() === agent.slug?.toLowerCase() || w.agent_name?.toLowerCase() === agent.name?.toLowerCase());
        return {
          ...agent,
          last_action: latestLog?.action,
          last_action_at: latestLog?.created_at,
        };
      });

      setSpaces(spacesRes.data || []);
      setTodaysTasks(tasksRes.data || []);
      setCompletedTasks(completedRes.data || []);
      setInboxItems(inboxRes.data || []);
      setMessages(messagesRes.data || []);
      setAgents(agentsWithActions);

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
  // Messages WITH thread_id group together; messages WITHOUT get their own entry
  const messageThreads = useMemo<MessageThread[]>(() => {
    const threadMap = new Map<string, { messages: InboxItem[], recipient: string }>();
    messages.forEach(msg => {
      // Use thread_id if available, otherwise each message is its own "thread"
      const key = msg.thread_id || `standalone-${msg.id}`;
      const recipient = msg.to_recipient || msg.from_agent || 'unknown';
      if (!threadMap.has(key)) {
        threadMap.set(key, { messages: [], recipient });
      }
      threadMap.get(key)!.messages.push(msg);
    });
    return Array.from(threadMap.entries()).map(([key, val]) => {
      // Find subject from any message in the thread
      const subject = val.messages.find(m => m.subject)?.subject || null;
      return {
        recipient: val.recipient,
        subject,
        lastMessage: val.messages[0],
        messageCount: val.messages.length,
        threadId: val.messages[0].thread_id,
      };
    }).slice(0, 5);
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

  const timeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  // Task modal functions
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskEditData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || '',
    });
    setIsEditingTask(false);
    onTaskModalOpen();
  };

  const handleTaskEdit = () => {
    setIsEditingTask(true);
  };

  const handleTaskSave = async () => {
    if (!selectedTask) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskEditData.title,
          description: taskEditData.description,
          status: taskEditData.status,
          priority: taskEditData.priority,
          due_date: taskEditData.due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedTask.id);
      if (error) throw error;
      
      // Update local state
      setTodaysTasks(prev => prev.map(t => 
        t.id === selectedTask.id ? { ...t, ...taskEditData } : t
      ));
      setIsEditingTask(false);
      showSuccessToast('Task updated');
    } catch (error) {
      showErrorToast(error, 'Failed to update task');
    }
  };

  const handleTaskStatusChange = async (newStatus: string) => {
    if (!selectedTask) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTask.id);
      if (error) throw error;
      
      // Update local state
      setTaskEditData(prev => ({ ...prev, status: newStatus }));
      setTodaysTasks(prev => prev.map(t => 
        t.id === selectedTask.id ? { ...t, status: newStatus } : t
      ));
      showSuccessToast('Status updated');
    } catch (error) {
      showErrorToast(error, 'Failed to update status');
    }
  };

  // Agent modal functions
  const handleAgentClick = async (agent: AIAgent) => {
    setSelectedAgent(agent);
    setLoadingAgentTasks(true);
    
    try {
      // Determine agent user ID based on name
      let agentUserId = '';
      if (agent.name.toLowerCase() === 'ax') {
        agentUserId = 'd6c2fbde-5639-4944-b0ed-e13cbbd64c03';
      } else if (agent.name.toLowerCase() === 'tony') {
        agentUserId = 'a40862c9-50bf-4c3a-8084-3f750f99febf';
      }
      
      if (agentUserId) {
        // Fetch upcoming tasks (not done)
        const { data: upcomingTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('assignee_id', agentUserId)
          .neq('status', 'done')
          .order('priority', { ascending: false })
          .limit(5);
        
        // Fetch completed tasks
        const { data: completedTasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('assignee_id', agentUserId)
          .eq('status', 'done')
          .order('updated_at', { ascending: false })
          .limit(5);
        
        setAgentTasks({
          upcoming: upcomingTasks || [],
          completed: completedTasks || [],
        });
      }
    } catch (error) {
      console.error('Failed to load agent tasks:', error);
      showErrorToast(error, 'Failed to load agent tasks');
    } finally {
      setLoadingAgentTasks(false);
      onAgentModalOpen();
    }
  };

  // Group tasks by project for What's Next section
  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    
    todaysTasks.slice(0, 7).forEach(task => {
      const spaceName = spaces.find(s => s.id === task.space_id)?.name || 'General';
      if (!groups[spaceName]) {
        groups[spaceName] = [];
      }
      groups[spaceName].push(task);
    });
    
    return groups;
  }, [todaysTasks, spaces]);

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
                            <div className="flex md:hidden md:group-hover:flex items-center gap-1 flex-shrink-0">
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
                            <span className="text-[10px] text-slate-400 flex-shrink-0 hidden md:block md:group-hover:hidden mt-1">
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
                ) : Object.keys(groupedTasks).length === 0 && completedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-slate-500">The hit list is empty.</p>
                  </div>
                ) : (
                  <>
                    {/* Active tasks - grouped by project */}
                    <div className="space-y-4">
                      {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
                        <div key={projectName} className="space-y-2">
                          <div className="flex items-center gap-2 px-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{projectName}</h3>
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                            <span className="text-[10px] text-slate-400">{projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}</span>
                          </div>
                          {projectTasks.map((task) => (
                            <div 
                              key={task.id}
                              onClick={() => handleTaskClick(task)}
                              className="group flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                            >
                              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)} shadow-lg shadow-current/20`} />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px] uppercase font-bold tracking-tight">
                                    {task.priority}
                                  </Chip>
                                  {task.due_date && (
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Clock className="w-3 h-3" />
                                      {new Date(task.due_date).toLocaleDateString()}
                                    </div>
                                  )}
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
                        </div>
                      ))}
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
                  <Button size="sm" variant="light" radius="full" onPress={() => {
                    window.dispatchEvent(new CustomEvent('open-chat-thread', { detail: {} }))
                  }}>
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
                      const threadName = thread.subject || `Chat with ${thread.recipient.charAt(0).toUpperCase() + thread.recipient.slice(1)}`
                      return (
                        <div 
                          key={idx} 
                          onClick={() => {
                            const threadId = thread.threadId || `dm-${thread.recipient}`
                            window.dispatchEvent(new CustomEvent('open-chat-thread', { detail: { threadId } }))
                          }}
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
                              <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                                {threadName}
                              </span>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                {new Date(thread.lastMessage.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 capitalize mt-0.5">{thread.recipient}</p>
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

            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Agents</span>
                  </div>
                  <Button size="sm" variant="light" radius="full" onPress={() => router.push('/ai')}>
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
                {agents.map((agent) => (
                  <div 
                    key={agent.id} 
                    onClick={() => handleAgentClick(agent)}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar name={agent.name} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black" />
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{agent.name}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{agent.role.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <Chip size="sm" variant="flat" color={agent.is_active ? 'success' : 'default'} className="h-5 text-[10px]">
                        {agent.is_active ? 'Online' : 'Offline'}
                      </Chip>
                    </div>
                    {agent.last_action && (
                      <div className="ml-11 mt-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <Activity className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          <span className="line-clamp-1">{agent.last_action}</span>
                        </div>
                        {agent.last_action_at && (
                          <p className="text-[10px] text-slate-400 ml-4.5 mt-0.5">{timeAgo(agent.last_action_at)}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </main>

      {/* Task Detail Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={onTaskModalClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getPriorityColor(selectedTask?.priority || 'medium')}`} />
                <h2 className="text-lg font-bold">Task Details</h2>
              </div>
              {!isEditingTask && (
                <Button size="sm" color="primary" variant="flat" onPress={handleTaskEdit}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedTask && (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Title</label>
                  {isEditingTask ? (
                    <Input
                      value={taskEditData.title}
                      onChange={(e) => setTaskEditData(prev => ({ ...prev, title: e.target.value }))}
                      size="sm"
                      className="w-full"
                    />
                  ) : (
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{selectedTask.title}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Description</label>
                  {isEditingTask ? (
                    <Textarea
                      value={taskEditData.description}
                      onChange={(e) => setTaskEditData(prev => ({ ...prev, description: e.target.value }))}
                      size="sm"
                      className="w-full"
                      minRows={3}
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                      {selectedTask.description || 'No description'}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Status</label>
                  {isEditingTask ? (
                    <Select
                      selectedKeys={[taskEditData.status]}
                      onChange={(e) => setTaskEditData(prev => ({ ...prev, status: e.target.value }))}
                      size="sm"
                      className="w-full"
                    >
                      <SelectItem key="todo">To Do</SelectItem>
                      <SelectItem key="in_progress">In Progress</SelectItem>
                      <SelectItem key="review">Review</SelectItem>
                      <SelectItem key="done">Done</SelectItem>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Chip 
                        size="sm" 
                        variant="flat" 
                        color={selectedTask.status === 'done' ? 'success' : 'default'}
                        className="cursor-pointer"
                        onClick={() => handleTaskStatusChange(selectedTask.status === 'done' ? 'todo' : 'done')}
                      >
                        {selectedTask.status.replace('_', ' ')}
                      </Chip>
                      <span className="text-xs text-slate-400">(Click to toggle)</span>
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Priority</label>
                  {isEditingTask ? (
                    <Select
                      selectedKeys={[taskEditData.priority]}
                      onChange={(e) => setTaskEditData(prev => ({ ...prev, priority: e.target.value }))}
                      size="sm"
                      className="w-full"
                    >
                      {priorityOptions.map(option => (
                        <SelectItem key={option.key}>{option.label}</SelectItem>
                      ))}
                    </Select>
                  ) : (
                    <Chip size="sm" variant="flat" className={`${getPriorityColor(selectedTask.priority)} text-white`}>
                      {selectedTask.priority}
                    </Chip>
                  )}
                </div>

                {/* Project */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Project</label>
                  <Chip size="sm" variant="flat" color="default">
                    {spaces.find(s => s.id === selectedTask.space_id)?.name || 'General'}
                  </Chip>
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">Due Date</label>
                  {isEditingTask ? (
                    <Input
                      type="date"
                      value={taskEditData.due_date || ''}
                      onChange={(e) => setTaskEditData(prev => ({ ...prev, due_date: e.target.value }))}
                      size="sm"
                      className="w-full"
                    />
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">
                      {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No due date'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {isEditingTask ? (
              <>
                <Button variant="light" onPress={() => setIsEditingTask(false)}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleTaskSave}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button color="primary" onPress={onTaskModalClose}>
                Close
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Agent Detail Modal */}
      <Modal isOpen={isAgentModalOpen} onClose={onAgentModalClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <Avatar name={selectedAgent?.name} size="lg" className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-black" />
              <div>
                <h2 className="text-lg font-bold">{selectedAgent?.name}</h2>
                <p className="text-sm text-slate-400 capitalize">{selectedAgent?.role?.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </ModalHeader>
          <ModalBody className="pb-6">
            {selectedAgent && (
              <div className="space-y-6">
                {/* Status & Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                    <Chip size="sm" variant="flat" color={selectedAgent.is_active ? 'success' : 'default'}>
                      {selectedAgent.is_active ? 'Online' : 'Offline'}
                    </Chip>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Tasks</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">
                      {agentTasks.upcoming.length + agentTasks.completed.length}
                    </p>
                  </div>
                </div>

                {/* Last Action */}
                {selectedAgent.last_action && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Last Action</p>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <Activity className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-600 dark:text-slate-300">{selectedAgent.last_action}</span>
                      {selectedAgent.last_action_at && (
                        <span className="text-xs text-slate-400 ml-auto">{timeAgo(selectedAgent.last_action_at)}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Upcoming Tasks */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Upcoming Tasks ({agentTasks.upcoming.length})</p>
                  </div>
                  {loadingAgentTasks ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-lg w-full" />)}
                    </div>
                  ) : agentTasks.upcoming.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No upcoming tasks</p>
                  ) : (
                    <div className="space-y-2">
                      {agentTasks.upcoming.slice(0, 5).map(task => (
                        <div 
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                            <p className="text-xs text-slate-400">{task.priority}</p>
                          </div>
                          {task.due_date && (
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Tasks */}
                {agentTasks.completed.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Tasks ({agentTasks.completed.length})</p>
                    </div>
                    <div className="space-y-2">
                      {agentTasks.completed.slice(0, 5).map(task => (
                        <div 
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-400 line-through truncate">{task.title}</p>
                            <p className="text-xs text-slate-400">{task.priority}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {new Date(task.updated_at || task.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={onAgentModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
