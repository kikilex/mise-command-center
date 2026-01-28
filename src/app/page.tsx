'use client'

import { 
  Button, 
  Card, 
  CardBody,
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
} from "@heroui/react";
import { useState, useEffect, useMemo } from "react";
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

interface Business {
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
  business_id: string | null
  due_date: string | null
  business?: Business | null
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
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    business_id: '',
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
      
      if (authError) {
        console.error('Auth error:', authError);
      }
      
      if (authUser) {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
            role: profile?.role || 'member'
          });
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
          });
        }
      }

      // Load businesses
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, color');
      
      if (businessError) {
        console.error('Businesses fetch error:', businessError);
      } else {
        setBusinesses(businessData || []);
      }

      // Load today's tasks (due today and not done)
      const todayStr = getTodayString();
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          business_id,
          due_date,
          businesses (
            id,
            name,
            color
          )
        `)
        .gte('due_date', `${todayStr}T00:00:00`)
        .lt('due_date', `${todayStr}T23:59:59.999`)
        .neq('status', 'done')
        .order('priority', { ascending: true });

      if (tasksError) {
        console.error('Tasks fetch error:', tasksError);
        showErrorToast(tasksError, 'Failed to load tasks');
      } else {
        // Transform the data to match our interface
        const transformedTasks = (tasksData || []).map(task => ({
          ...task,
          business: task.businesses as unknown as Business | null
        }));
        setTodaysTasks(transformedTasks);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError('Failed to load dashboard data');
      showErrorToast(error, 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    let filtered = todaysTasks;

    if (filter === 'personal') {
      filtered = filtered.filter(t => !t.business_id);
    } else if (filter === 'business') {
      if (selectedBusiness) {
        filtered = filtered.filter(t => t.business_id === selectedBusiness);
      } else {
        filtered = filtered.filter(t => t.business_id !== null);
      }
    }

    return filtered;
  }, [todaysTasks, filter, selectedBusiness]);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Today
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-white dark:bg-slate-800 shadow-sm">
                <CardBody className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-6 h-6 rounded" />
                    <div className="flex-1">
                      <Skeleton className="w-3/4 h-5 rounded mb-2" />
                      <Skeleton className="w-24 h-5 rounded" />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Task Cards */}
            <div className="space-y-2 mb-6">
              {filteredTasks.length === 0 ? (
                <Card className="bg-white dark:bg-slate-800 shadow-sm">
                  <CardBody className="p-8 text-center">
                    <div className="text-4xl mb-3">✨</div>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">
                      {filter === 'all' 
                        ? "No tasks due today" 
                        : filter === 'personal'
                        ? "No personal tasks due today"
                        : "No business tasks due today"}
                    </p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                      Add a task to get started
                    </p>
                  </CardBody>
                </Card>
              ) : (
                filteredTasks.map((task) => (
                  <Card 
                    key={task.id} 
                    className="bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleTaskDone(task.id)}
                          className="mt-0.5 w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center flex-shrink-0"
                          aria-label="Complete task"
                        >
                          <svg 
                            className="w-3 h-3 text-transparent hover:text-emerald-500" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={3} 
                              d="M5 13l4 4L19 7" 
                            />
                          </svg>
                        </button>

                        {/* Task Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                              <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {task.title}
                              </h3>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {getContextBadge(task)}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))
              )}
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={filter === 'all' ? 'solid' : 'flat'}
                color={filter === 'all' ? 'primary' : 'default'}
                onPress={() => {
                  setFilter('all');
                  setSelectedBusiness(null);
                }}
                className="font-medium"
              >
                All ({todaysTasks.length})
              </Button>
              <Button
                size="sm"
                variant={filter === 'personal' ? 'solid' : 'flat'}
                color={filter === 'personal' ? 'primary' : 'default'}
                onPress={() => {
                  setFilter('personal');
                  setSelectedBusiness(null);
                }}
                className="font-medium"
              >
                👤 Personal ({todaysTasks.filter(t => !t.business_id).length})
              </Button>
              <Button
                size="sm"
                variant={filter === 'business' && !selectedBusiness ? 'solid' : 'flat'}
                color={filter === 'business' && !selectedBusiness ? 'primary' : 'default'}
                onPress={() => {
                  setFilter('business');
                  setSelectedBusiness(null);
                }}
                className="font-medium"
              >
                🏢 Business ({todaysTasks.filter(t => t.business_id).length})
              </Button>
              
              {/* Individual business filters */}
              {filter === 'business' && businesses.length > 1 && (
                <>
                  {businesses.map(biz => {
                    const count = todaysTasks.filter(t => t.business_id === biz.id).length;
                    return (
                      <Button
                        key={biz.id}
                        size="sm"
                        variant={selectedBusiness === biz.id ? 'solid' : 'flat'}
                        style={selectedBusiness === biz.id ? {
                          backgroundColor: biz.color,
                          color: 'white',
                        } : {
                          borderColor: biz.color,
                          color: biz.color,
                        }}
                        className={selectedBusiness !== biz.id ? 'border' : ''}
                        onPress={() => setSelectedBusiness(biz.id)}
                      >
                        {biz.name} ({count})
                      </Button>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}
      </main>

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
