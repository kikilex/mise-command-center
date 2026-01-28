'use client'

import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Avatar,
  Progress,
  Input,
  Tabs,
  Tab,
  Skeleton
} from "@heroui/react";
import { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface UserData {
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

interface DashboardStats {
  totalTasks: number
  completedTasks: number
  contentPipeline: number
  readyToPost: number
  aiAgents: number
  recentTasks: Array<{
    id: string
    title: string
    assignee: string
    status: string
    priority: string
  }>
}

export default function Home() {
  const [user, setUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    contentPipeline: 0,
    readyToPost: 0,
    aiAgents: 1,
    recentTasks: []
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    
    try {
      // Get user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        // Non-fatal - user might not be logged in
      }
      
      if (authUser) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          
          if (profileError) {
            console.error('Profile fetch error:', profileError);
          }
          
          setUser({
            email: authUser.email || '',
            name: profile?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
            role: profile?.role || 'member'
          });
        } catch (err) {
          console.error('Failed to fetch profile:', err);
          // Set basic user info even if profile fails
          setUser({
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
          });
        }
      }

      // Get task stats
      const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*');
      if (tasksError) {
        console.error('Tasks fetch error:', tasksError);
        showErrorToast(tasksError, 'Failed to load tasks');
      }
      
      const { data: content, error: contentError } = await supabase.from('content_items').select('*');
      if (contentError) {
        console.error('Content fetch error:', contentError);
      }
      
      const { data: agents, error: agentsError } = await supabase.from('ai_agents').select('*').eq('is_active', true);
      if (agentsError) {
        console.error('Agents fetch error:', agentsError);
      }
      
      const { data: users, error: usersError } = await supabase.from('users').select('id, name, email');
      if (usersError) {
        console.error('Users fetch error:', usersError);
      }

      const userMap = new Map(users?.map(u => [u.id, u.name || u.email?.split('@')[0]]) || []);

      if (tasks) {
        const completedCount = tasks.filter(t => t.status === 'done').length;
        const recentTasks = tasks.slice(0, 4).map(t => ({
          id: t.id,
          title: t.title,
          assignee: userMap.get(t.assignee_id) || userMap.get(t.created_by) || 'Unassigned',
          status: t.status === 'in_progress' ? 'In Progress' : 
                  t.status === 'todo' ? 'Todo' : 
                  t.status === 'done' ? 'Done' :
                  t.status === 'review' ? 'Review' : t.status,
          priority: t.priority
        }));

        setStats(prev => ({
          ...prev,
          totalTasks: tasks.length,
          completedTasks: completedCount,
          recentTasks
        }));
      }

      if (content) {
        const readyCount = content.filter(c => 
          c.status === 'approved' || c.status === 'scheduled'
        ).length;
        setStats(prev => ({
          ...prev,
          contentPipeline: content.length,
          readyToPost: readyCount
        }));
      }

      if (agents) {
        setStats(prev => ({
          ...prev,
          aiAgents: agents.length || 1
        }));
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

  if (loadError && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-4">
        <ErrorFallback error={loadError} resetError={loadData} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar user={user} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Stats Row */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="bg-white shadow-sm border-0">
                <CardBody className="p-5">
                  <Skeleton className="w-20 h-4 rounded mb-2" />
                  <Skeleton className="w-16 h-8 rounded mb-2" />
                  <Skeleton className="w-32 h-3 rounded" />
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Tasks</span>
                {stats.totalTasks > 0 && (
                  <Chip size="sm" className="bg-emerald-100 text-emerald-700 font-medium">
                    {stats.completedTasks} done
                  </Chip>
                )}
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.totalTasks}</p>
              <p className="text-slate-400 text-sm mt-1">
                {stats.totalTasks === 0 ? 'No tasks yet' : `${stats.completedTasks} completed`}
              </p>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Content Pipeline</span>
                {stats.readyToPost > 0 && (
                  <Chip size="sm" className="bg-blue-100 text-blue-700 font-medium">
                    {stats.readyToPost} ready
                  </Chip>
                )}
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.contentPipeline}</p>
              <p className="text-slate-400 text-sm mt-1">
                {stats.contentPipeline === 0 ? 'No content yet' : `${stats.readyToPost} ready to post`}
              </p>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Businesses</span>
                <Chip size="sm" className="bg-purple-100 text-purple-700 font-medium">Active</Chip>
              </div>
              <p className="text-3xl font-bold text-slate-800">1</p>
              <p className="text-slate-400 text-sm mt-1">Christian Content</p>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">AI Agents</span>
                <Chip size="sm" className="bg-emerald-100 text-emerald-700 font-medium">Online</Chip>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stats.aiAgents}</p>
              <p className="text-slate-400 text-sm mt-1">Ax (Umbrella CEO)</p>
            </CardBody>
          </Card>
        </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Tasks & AI */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Task Completion Card */}
            <Card className="bg-white shadow-sm border-0">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Task Completion Rate</h3>
                  <a href="/tasks" className="text-slate-400 hover:text-violet-600">→</a>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl font-bold text-slate-800">
                    {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                  </span>
                  <div className="flex -space-x-2">
                    {user && <Avatar name={user.name} size="sm" className="ring-2 ring-white" />}
                  </div>
                </div>
                <div className="flex gap-1 mb-2">
                  {[...Array(Math.min(20, Math.max(stats.totalTasks, 1)))].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-3 rounded-full ${
                        stats.totalTasks > 0 && i < Math.round((stats.completedTasks / stats.totalTasks) * Math.min(20, stats.totalTasks))
                          ? 'bg-emerald-400' 
                          : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-slate-400 text-sm">
                  {stats.totalTasks === 0 
                    ? 'Create your first task to get started' 
                    : `${stats.completedTasks} of ${stats.totalTasks} tasks completed`}
                </p>
              </CardBody>
            </Card>

            {/* Recent Tasks */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-semibold text-slate-800">Recent Tasks</h3>
                  <a href="/tasks" className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                    View all →
                  </a>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <div className="space-y-3 mt-4">
                  {stats.recentTasks.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No tasks yet. Create your first task!</p>
                  ) : (
                    stats.recentTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'high' || task.priority === 'critical' ? 'bg-rose-400' : 
                            task.priority === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
                          }`} />
                          <div>
                            <p className="font-medium text-slate-700">{task.title}</p>
                            <p className="text-sm text-slate-400">Assigned to {task.assignee}</p>
                          </div>
                        </div>
                        <Chip 
                          size="sm" 
                          variant="flat"
                          className={
                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                            task.status === 'Done' ? 'bg-emerald-100 text-emerald-700' :
                            task.status === 'Review' ? 'bg-purple-100 text-purple-700' :
                            'bg-slate-100 text-slate-600'
                          }
                        >
                          {task.status}
                        </Chip>
                      </div>
                    ))
                  )}
                </div>
                <Button 
                  as="a"
                  href="/tasks"
                  className="w-full mt-4 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white font-medium shadow-lg shadow-emerald-200"
                >
                  + Add New Task
                </Button>
              </CardBody>
            </Card>
          </div>

          {/* Right Column - AI Assistant & Widgets */}
          <div className="space-y-6">
            
            {/* AI Assistant Card */}
            <Card className="bg-gradient-to-br from-white to-violet-50/50 shadow-sm border-0">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <span className="text-white text-lg">⚡</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">How can I help you?</h3>
                    <p className="text-xs text-slate-400">Ax • Online</p>
                  </div>
                  <span className="ml-auto text-slate-400">↗</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { icon: "📋", label: "Prioritize Tasks", color: "bg-amber-50" },
                    { icon: "✍️", label: "Write Script", color: "bg-emerald-50" },
                    { icon: "🔍", label: "Research Topic", color: "bg-blue-50" },
                    { icon: "📊", label: "Run Analysis", color: "bg-purple-50" },
                  ].map((action, i) => (
                    <button 
                      key={i}
                      className={`${action.color} p-3 rounded-xl text-left hover:scale-[1.02] transition-transform`}
                    >
                      <span className="text-lg mb-1 block">{action.icon}</span>
                      <span className="text-sm font-medium text-slate-700">{action.label}</span>
                    </button>
                  ))}
                </div>

                <Input
                  placeholder="Ask something..."
                  variant="flat"
                  classNames={{
                    input: "bg-white",
                    inputWrapper: "bg-white shadow-sm"
                  }}
                  endContent={
                    <Button isIconOnly size="sm" variant="light" className="text-violet-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    </Button>
                  }
                />
              </CardBody>
            </Card>

            {/* Content Pipeline Widget */}
            <Card className="bg-white shadow-sm border-0">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Content Pipeline</h3>
                  <span className="text-slate-400">→</span>
                </div>
                <div className="space-y-3">
                  {[
                    { stage: "Ideas", count: 8, color: "bg-slate-200" },
                    { stage: "Script", count: 3, color: "bg-blue-400" },
                    { stage: "Review", count: 2, color: "bg-amber-400" },
                    { stage: "Ready", count: 4, color: "bg-emerald-400" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${item.color}`} />
                        <span className="text-slate-600">{item.stage}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{item.count}</span>
                    </div>
                  ))}
                </div>
                <Divider className="my-4" />
                <div className="flex gap-2">
                  <Progress 
                    value={47} 
                    className="flex-1"
                    classNames={{
                      indicator: "bg-gradient-to-r from-emerald-400 to-teal-400"
                    }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">47% of pipeline ready to publish</p>
              </CardBody>
            </Card>

            {/* AI Activity */}
            <Card className="bg-white shadow-sm border-0">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">AI Activity</h3>
                  <Chip size="sm" className="bg-emerald-100 text-emerald-700">Live</Chip>
                </div>
                <div className="space-y-3">
                  {[
                    { action: "Deployed Command Center", time: "2m ago", icon: "🚀" },
                    { action: "Reviewed project spec", time: "15m ago", icon: "📝" },
                    { action: "Updated memory files", time: "1h ago", icon: "🧠" },
                  ].map((activity, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span>{activity.icon}</span>
                      <span className="text-slate-600 flex-1">{activity.action}</span>
                      <span className="text-slate-400">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

          </div>
        </div>
      </main>

      {/* Floating Quick Add Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          as="a"
          href="/tasks"
          color="primary"
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg shadow-violet-300 hover:shadow-xl hover:shadow-violet-400 transition-all"
          isIconOnly
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
