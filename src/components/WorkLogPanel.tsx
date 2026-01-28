'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  useDisclosure,
  Pagination,
  Tooltip,
  Divider,
} from "@heroui/react"
import toast from 'react-hot-toast'

interface WorkLog {
  id: string
  agent_name: string
  action: string
  task_id: string | null
  details: Record<string, unknown>
  tokens_used: number | null
  duration_ms: number | null
  created_at: string
}

interface WorkLogPanelProps {
  workLogs: WorkLog[]
  loading?: boolean
  onRefresh?: () => void
}

// Action type configuration with colors and icons
const actionConfig: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  'task_started': { icon: '🚀', color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Task Started' },
  'task_completed': { icon: '✅', color: 'text-emerald-700', bgColor: 'bg-emerald-100', label: 'Task Completed' },
  'agent_spawned': { icon: '🤖', color: 'text-violet-700', bgColor: 'bg-violet-100', label: 'Agent Spawned' },
  'content_created': { icon: '📝', color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Content Created' },
  'script_written': { icon: '✍️', color: 'text-pink-700', bgColor: 'bg-pink-100', label: 'Script Written' },
  'research': { icon: '🔍', color: 'text-cyan-700', bgColor: 'bg-cyan-100', label: 'Research' },
  'analysis': { icon: '📊', color: 'text-indigo-700', bgColor: 'bg-indigo-100', label: 'Analysis' },
  'error': { icon: '❌', color: 'text-red-700', bgColor: 'bg-red-100', label: 'Error' },
  'warning': { icon: '⚠️', color: 'text-orange-700', bgColor: 'bg-orange-100', label: 'Warning' },
  'message_sent': { icon: '💬', color: 'text-teal-700', bgColor: 'bg-teal-100', label: 'Message Sent' },
  'file_created': { icon: '📄', color: 'text-slate-700', bgColor: 'bg-slate-100', label: 'File Created' },
  'api_call': { icon: '🔗', color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'API Call' },
  'default': { icon: '⚡', color: 'text-gray-700', bgColor: 'bg-gray-100', label: 'Action' }
}

// Date filter options
const dateFilterOptions = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
]

const ITEMS_PER_PAGE = 15

export default function WorkLogPanel({ workLogs, loading, onRefresh }: WorkLogPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null)
  const { isOpen, onOpen, onClose } = useDisclosure()

  // Get unique action types and agent names for filters
  const uniqueActions = useMemo(() => {
    const actions = new Set(workLogs.map(log => log.action))
    return Array.from(actions).sort()
  }, [workLogs])

  const uniqueAgents = useMemo(() => {
    const agents = new Set(workLogs.map(log => log.agent_name))
    return Array.from(agents).sort()
  }, [workLogs])

  // Filter logs based on all criteria
  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesAction = log.action.toLowerCase().includes(query)
        const matchesAgent = log.agent_name.toLowerCase().includes(query)
        const matchesDetails = JSON.stringify(log.details).toLowerCase().includes(query)
        if (!matchesAction && !matchesAgent && !matchesDetails) return false
      }

      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false

      // Agent filter
      if (agentFilter !== 'all' && log.agent_name !== agentFilter) return false

      // Date filter
      const logDate = new Date(log.created_at)
      const now = new Date()
      
      switch (dateFilter) {
        case 'today': {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          if (logDate < startOfToday) return false
          break
        }
        case '7days': {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          if (logDate < sevenDaysAgo) return false
          break
        }
        case '30days': {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          if (logDate < thirtyDaysAgo) return false
          break
        }
        case 'custom': {
          if (customStartDate) {
            const start = new Date(customStartDate)
            if (logDate < start) return false
          }
          if (customEndDate) {
            const end = new Date(customEndDate)
            end.setHours(23, 59, 59, 999)
            if (logDate > end) return false
          }
          break
        }
      }

      return true
    })
  }, [workLogs, searchQuery, actionFilter, agentFilter, dateFilter, customStartDate, customEndDate])

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredLogs, currentPage])

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback((setter: (value: string) => void, value: string) => {
    setter(value)
    setCurrentPage(1)
  }, [])

  // Format timestamp nicely
  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    // Show relative time for recent entries
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`

    // Show date for older entries
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  // Format full timestamp for modal
  const formatFullTimestamp = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })
  }

  // Get action config
  const getActionConfig = (action: string) => {
    return actionConfig[action] || actionConfig.default
  }

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (!ms) return null
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  // Get summary from details
  const getSummary = (log: WorkLog) => {
    const details = log.details
    if (typeof details === 'object' && details !== null) {
      // Try common summary fields
      if ('summary' in details && typeof details.summary === 'string') return details.summary
      if ('title' in details && typeof details.title === 'string') return details.title
      if ('message' in details && typeof details.message === 'string') return details.message
      if ('description' in details && typeof details.description === 'string') return details.description
      if ('task' in details && typeof details.task === 'string') return details.task
      
      // If no summary field, return first string value or first key
      const firstStringValue = Object.values(details).find(v => typeof v === 'string')
      if (firstStringValue) return String(firstStringValue).slice(0, 100)
    }
    return null
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy')
    }
  }

  // Open log details modal
  const handleLogClick = (log: WorkLog) => {
    setSelectedLog(log)
    onOpen()
  }

  return (
    <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex flex-col gap-4 w-full">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Work Log</h2>
              <Chip size="sm" className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                {filteredLogs.length} entries
              </Chip>
            </div>
            {onRefresh && (
              <Button 
                size="sm" 
                variant="flat" 
                onPress={onRefresh}
                isLoading={loading}
              >
                ↻ Refresh
              </Button>
            )}
          </div>

          {/* Search bar */}
          <Input
            placeholder="Search by action, agent, or details..."
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery, e.target.value)}
            startContent={<span className="text-slate-400">🔍</span>}
            size="sm"
            className="max-w-full"
          />

          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            <Select
              size="sm"
              label="Action"
              selectedKeys={[actionFilter]}
              onChange={(e) => handleFilterChange(setActionFilter, e.target.value)}
              className="w-[160px]"
              items={[{ key: 'all', label: 'All Actions' }, ...uniqueActions.map(a => ({ key: a, label: `${getActionConfig(a).icon} ${getActionConfig(a).label}` }))]}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>

            <Select
              size="sm"
              label="Agent"
              selectedKeys={[agentFilter]}
              onChange={(e) => handleFilterChange(setAgentFilter, e.target.value)}
              className="w-[160px]"
              items={[{ key: 'all', label: 'All Agents' }, ...uniqueAgents.map(a => ({ key: a, label: a }))]}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>

            <Select
              size="sm"
              label="Date"
              selectedKeys={[dateFilter]}
              onChange={(e) => handleFilterChange(setDateFilter, e.target.value)}
              className="w-[160px]"
            >
              {dateFilterOptions.map(opt => (
                <SelectItem key={opt.key}>{opt.label}</SelectItem>
              ))}
            </Select>

            {/* Custom date range inputs */}
            {dateFilter === 'custom' && (
              <div className="flex gap-2 items-end">
                <Input
                  type="date"
                  size="sm"
                  label="From"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-[140px]"
                />
                <Input
                  type="date"
                  size="sm"
                  label="To"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
            )}

            {/* Clear filters button */}
            {(searchQuery || actionFilter !== 'all' || agentFilter !== 'all' || dateFilter !== 'all') && (
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={() => {
                  setSearchQuery('')
                  setActionFilter('all')
                  setAgentFilter('all')
                  setDateFilter('all')
                  setCustomStartDate('')
                  setCustomEndDate('')
                  setCurrentPage(1)
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="px-6 pb-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Loading work logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-slate-500 dark:text-slate-400 mb-2">No work logs found</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {workLogs.length > 0 
                ? 'Try adjusting your filters' 
                : 'AI activity will appear here'}
            </p>
          </div>
        ) : (
          <>
            {/* Log entries */}
            <div className="space-y-2">
              {paginatedLogs.map(log => {
                const config = getActionConfig(log.action)
                const summary = getSummary(log)
                const duration = formatDuration(log.duration_ms)

                return (
                  <div
                    key={log.id}
                    onClick={() => handleLogClick(log)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-lg ${config.bgColor} dark:opacity-80 flex items-center justify-center flex-shrink-0`}>
                      <span className="text-lg">{config.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {/* Action chip */}
                        <Chip
                          size="sm"
                          className={`${config.bgColor} ${config.color} dark:opacity-90`}
                        >
                          {config.label}
                        </Chip>

                        {/* Agent name */}
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {log.agent_name}
                        </span>

                        {/* Task ID if present */}
                        {log.task_id && (
                          <Chip size="sm" variant="flat" className="text-xs">
                            Task: {log.task_id.slice(0, 8)}
                          </Chip>
                        )}
                      </div>

                      {/* Summary */}
                      {summary && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-1">
                          {summary}
                        </p>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                        <Tooltip content={formatFullTimestamp(log.created_at)}>
                          <span className="cursor-help">🕒 {formatTimestamp(log.created_at)}</span>
                        </Tooltip>
                        
                        {log.tokens_used && (
                          <span>🎯 {log.tokens_used.toLocaleString()} tokens</span>
                        )}
                        
                        {duration && (
                          <span>⏱️ {duration}</span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div className="text-slate-400 dark:text-slate-500 flex-shrink-0">
                      →
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  total={totalPages}
                  page={currentPage}
                  onChange={setCurrentPage}
                  color="primary"
                  size="sm"
                  showControls
                />
              </div>
            )}
          </>
        )}
      </CardBody>

      {/* Details Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {selectedLog && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getActionConfig(selectedLog.action).icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {getActionConfig(selectedLog.action).label}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                      by {selectedLog.agent_name}
                    </p>
                  </div>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Timestamp</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatFullTimestamp(selectedLog.created_at)}
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Agent</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {selectedLog.agent_name}
                      </p>
                    </div>

                    {selectedLog.tokens_used && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tokens Used</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {selectedLog.tokens_used.toLocaleString()}
                        </p>
                      </div>
                    )}

                    {selectedLog.duration_ms && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Duration</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {formatDuration(selectedLog.duration_ms)} ({selectedLog.duration_ms}ms)
                        </p>
                      </div>
                    )}

                    {selectedLog.task_id && (
                      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 col-span-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Task ID</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 font-mono">
                          {selectedLog.task_id}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Details JSON */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Details</p>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => copyToClipboard(JSON.stringify(selectedLog.details, null, 2))}
                      >
                        📋 Copy JSON
                      </Button>
                    </div>
                    <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-[400px] overflow-y-auto">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>

                  {/* Raw log data */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Full Log Entry</p>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => copyToClipboard(JSON.stringify(selectedLog, null, 2))}
                      >
                        📋 Copy All
                      </Button>
                    </div>
                    <pre className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-[200px] overflow-y-auto">
                      {JSON.stringify(selectedLog, null, 2)}
                    </pre>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  )
}
