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
  Tab
} from "@heroui/react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise</span>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white text-xs font-medium">CC</div>
                <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-medium">+</div>
              </div>
            </div>
            
            <Tabs 
              aria-label="Navigation" 
              variant="light" 
              classNames={{
                tabList: "gap-2",
                tab: "px-4 py-2 text-sm font-medium",
                cursor: "bg-white shadow-md",
              }}
              defaultSelectedKey="overview"
            >
              <Tab key="overview" title="Overview" />
              <Tab key="tasks" title="Tasks" />
              <Tab key="content" title="Content" />
              <Tab key="businesses" title="Businesses" />
              <Tab key="analytics" title="Analytics" />
            </Tabs>

            <div className="flex items-center gap-3">
              <Button isIconOnly variant="light" className="text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </Button>
              <Avatar 
                src="https://i.pravatar.cc/150?u=alex" 
                size="sm"
                className="ring-2 ring-white shadow-md"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Tasks</span>
                <Chip size="sm" className="bg-emerald-100 text-emerald-700 font-medium">+12</Chip>
              </div>
              <p className="text-3xl font-bold text-slate-800">24</p>
              <p className="text-slate-400 text-sm mt-1">8 completed this week</p>
            </CardBody>
          </Card>

          <Card className="bg-white shadow-sm border-0 hover:shadow-md transition-shadow">
            <CardBody className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Content Pipeline</span>
                <Chip size="sm" className="bg-blue-100 text-blue-700 font-medium">+3</Chip>
              </div>
              <p className="text-3xl font-bold text-slate-800">15</p>
              <p className="text-slate-400 text-sm mt-1">4 ready to post</p>
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
              <p className="text-3xl font-bold text-slate-800">1</p>
              <p className="text-slate-400 text-sm mt-1">Ax (Umbrella CEO)</p>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Tasks & AI */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Task Completion Card */}
            <Card className="bg-white shadow-sm border-0">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800">Task Completion Rate</h3>
                  <span className="text-slate-400">→</span>
                </div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-4xl font-bold text-slate-800">87%</span>
                  <div className="flex -space-x-2">
                    <Avatar src="https://i.pravatar.cc/150?u=alex" size="sm" className="ring-2 ring-white" />
                    <Avatar src="https://i.pravatar.cc/150?u=mom" size="sm" className="ring-2 ring-white" />
                    <div className="w-8 h-8 rounded-full bg-slate-200 ring-2 ring-white flex items-center justify-center text-xs text-slate-600 font-medium">+2</div>
                  </div>
                </div>
                <div className="flex gap-1 mb-2">
                  {[...Array(20)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-3 h-3 rounded-full ${i < 17 ? 'bg-emerald-400' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
                <p className="text-slate-400 text-sm">Most tasks completed within deadlines</p>
              </CardBody>
            </Card>

            {/* Today's Tasks */}
            <Card className="bg-white shadow-sm border-0">
              <CardHeader className="px-6 pt-6 pb-0">
                <div className="flex items-center justify-between w-full">
                  <h3 className="font-semibold text-slate-800">Today&apos;s Tasks</h3>
                  <div className="flex items-center gap-2">
                    <Tabs size="sm" variant="light" defaultSelectedKey="priority">
                      <Tab key="priority" title={<span className="flex items-center gap-1">Priority <Chip size="sm" className="bg-rose-100 text-rose-600 min-w-5 h-5">3</Chip></span>} />
                      <Tab key="active" title={<span className="flex items-center gap-1">Active <Chip size="sm" className="bg-slate-100 text-slate-600 min-w-5 h-5">5</Chip></span>} />
                      <Tab key="completed" title="Completed" />
                    </Tabs>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="px-6 pb-6">
                <div className="space-y-3 mt-4">
                  {[
                    { title: "Set up Command Center database", assignee: "Ax", status: "In Progress", priority: "high" },
                    { title: "Review testimony scripts", assignee: "Mom", status: "Todo", priority: "medium" },
                    { title: "Deploy to production", assignee: "Ax", status: "Todo", priority: "high" },
                    { title: "Create content calendar", assignee: "Alex", status: "Draft", priority: "low" },
                  ].map((task, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full ${
                          task.priority === 'high' ? 'bg-rose-400' : 
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
                          task.status === 'Todo' ? 'bg-slate-100 text-slate-600' :
                          'bg-slate-100 text-slate-500'
                        }
                      >
                        {task.status}
                      </Chip>
                    </div>
                  ))}
                </div>
                <Button 
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
    </div>
  );
}
