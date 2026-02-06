'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Chip,
  Progress,
  Textarea,
  Avatar,
} from '@heroui/react'
import { 
  ArrowLeft, CheckCircle2, Circle, ClipboardList, 
  ExternalLink, Link as LinkIcon, Clock, User,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { formatDistanceToNow } from 'date-fns'

interface ChecklistRun {
  id: string
  playbook_id: string
  project_id: string
  assigned_to: string
  assigned_by: string
  status: string
  started_at: string
  completed_at: string | null
  playbook?: {
    id: string
    title: string
    description: string | null
  }
  project?: {
    id: string
    name: string
    space_id: string
  }
  assignee?: {
    id: string
    name: string
    display_name: string
    avatar_url: string
  }
}

interface StepProgress {
  id: string
  run_id: string
  step_id: string
  completed: boolean
  completed_at: string | null
  notes: string | null
  step?: {
    id: string
    position: number
    title: string
    description: string | null
    resources: { type: string; title: string; url: string }[]
  }
}

export default function ChecklistRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [run, setRun] = useState<ChecklistRun | null>(null)
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [savingStep, setSavingStep] = useState<string | null>(null)
  const [stepNotes, setStepNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(userData)
      }

      // Load the run with related data
      const { data: runData, error: runError } = await supabase
        .from('checklist_runs')
        .select(`
          *,
          playbook:playbook_id (id, title, description),
          project:project_id (id, name, space_id),
          assignee:assigned_to (id, name, display_name, avatar_url)
        `)
        .eq('id', id)
        .single()

      if (runError) throw runError
      setRun(runData)

      // Load step progress with step details
      const { data: progressData, error: progressError } = await supabase
        .from('checklist_step_progress')
        .select(`
          *,
          step:step_id (id, position, title, description, resources)
        `)
        .eq('run_id', id)
        .order('step(position)', { ascending: true })

      if (progressError) throw progressError
      
      // Sort by step position
      const sorted = (progressData || []).sort((a, b) => 
        (a.step?.position || 0) - (b.step?.position || 0)
      )
      setStepProgress(sorted)

      // Initialize notes state
      const notesMap: Record<string, string> = {}
      sorted.forEach(sp => {
        notesMap[sp.id] = sp.notes || ''
      })
      setStepNotes(notesMap)

      // Auto-expand the first incomplete step
      const firstIncomplete = sorted.find(sp => !sp.completed)
      if (firstIncomplete) {
        setExpandedSteps(new Set([firstIncomplete.id]))
      }

    } catch (error) {
      console.error('Load error:', error)
      showErrorToast(error, 'Failed to load checklist')
    } finally {
      setLoading(false)
    }
  }

  async function toggleStepComplete(progressId: string, currentlyComplete: boolean) {
    setSavingStep(progressId)
    try {
      const newCompleted = !currentlyComplete
      const progress = stepProgress.find(sp => sp.id === progressId)
      
      const { error } = await supabase
        .from('checklist_step_progress')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          notes: stepNotes[progressId] || null,
        })
        .eq('id', progressId)

      if (error) throw error

      // Update local state
      setStepProgress(prev => prev.map(sp => 
        sp.id === progressId 
          ? { ...sp, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null, notes: stepNotes[progressId] || null }
          : sp
      ))

      // Post progress update to project feed
      if (newCompleted && run && progress?.step) {
        const completedCount = stepProgress.filter(sp => sp.id === progressId ? true : sp.completed).length
        const totalSteps = stepProgress.length

        await supabase
          .from('project_updates')
          .insert({
            project_id: run.project_id,
            author_id: user?.id,
            content: `Completed step ${progress.step.position + 1}/${totalSteps}: "${progress.step.title}"${stepNotes[progressId] ? `\n\nNote: ${stepNotes[progressId]}` : ''}`,
            update_type: 'checklist_progress',
            metadata: {
              checklist_run_id: run.id,
              playbook_name: run.playbook?.title,
              step_title: progress.step.title,
              completed_steps: completedCount,
              total_steps: totalSteps,
            },
          })

        // Check if all steps are now complete
        if (completedCount === totalSteps) {
          // Mark run as completed
          await supabase
            .from('checklist_runs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', run.id)

          // Post completion update
          await supabase
            .from('project_updates')
            .insert({
              project_id: run.project_id,
              author_id: user?.id,
              content: `Completed all steps in "${run.playbook?.title}"! 🎉`,
              update_type: 'checklist_completed',
              metadata: {
                checklist_run_id: run.id,
                playbook_name: run.playbook?.title,
                total_steps: totalSteps,
              },
            })

          setRun(prev => prev ? { ...prev, status: 'completed', completed_at: new Date().toISOString() } : null)
          showSuccessToast('Playbook completed! 🎉')
        }
      }

      // Auto-expand next incomplete step
      if (newCompleted) {
        const nextIncomplete = stepProgress.find(sp => sp.id !== progressId && !sp.completed)
        if (nextIncomplete) {
          setExpandedSteps(new Set([nextIncomplete.id]))
        }
      }

    } catch (error) {
      console.error('Toggle error:', error)
      showErrorToast(error, 'Failed to update step')
    } finally {
      setSavingStep(null)
    }
  }

  function toggleExpanded(progressId: string) {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(progressId)) {
        next.delete(progressId)
      } else {
        next.add(progressId)
      }
      return next
    })
  }

  const completedCount = stepProgress.filter(sp => sp.completed).length
  const totalSteps = stepProgress.length
  const progressPercent = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <p>Checklist not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar />

      <main className="max-w-3xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/projects/${run.project_id}`} 
            className="inline-flex items-center gap-2 text-default-500 hover:text-default-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {run.project?.name}</span>
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{run.playbook?.title}</h1>
              </div>
              {run.playbook?.description && (
                <p className="text-default-500">{run.playbook.description}</p>
              )}
            </div>
            <Chip 
              color={run.status === 'completed' ? 'success' : 'primary'} 
              variant="flat"
            >
              {run.status === 'completed' ? 'Completed' : 'In Progress'}
            </Chip>
          </div>

          {/* Progress + Assignee */}
          <div className="mt-4 p-4 bg-white dark:bg-default-100 rounded-xl border border-default-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Avatar 
                  src={run.assignee?.avatar_url} 
                  name={run.assignee?.display_name || run.assignee?.name}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium">{run.assignee?.display_name || run.assignee?.name}</p>
                  <p className="text-xs text-default-400">Assigned</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{completedCount}/{totalSteps} steps</p>
                <p className="text-xs text-default-400">
                  {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <Progress 
              value={progressPercent} 
              color={run.status === 'completed' ? 'success' : 'primary'}
              className="mt-2"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {stepProgress.map((sp, index) => {
            const isExpanded = expandedSteps.has(sp.id)
            const step = sp.step
            if (!step) return null

            return (
              <Card 
                key={sp.id} 
                className={`transition-all ${sp.completed ? 'bg-success-50 dark:bg-success-900/10 border-success-200' : ''}`}
              >
                <CardBody className="p-0">
                  {/* Step Header - Always visible */}
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left"
                    onClick={() => toggleExpanded(sp.id)}
                  >
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        sp.completed 
                          ? 'bg-success text-white' 
                          : 'bg-default-100 text-default-600'
                      }`}
                    >
                      {sp.completed ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-medium ${sp.completed ? 'text-success-700 dark:text-success-300' : 'text-foreground'}`}>
                        {step.title}
                      </h3>
                      {sp.completed && sp.notes && (
                        <p className="text-xs text-success-600 dark:text-success-400 mt-0.5 truncate">
                          Note: {sp.notes}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-default-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-default-400" />
                    )}
                  </button>

                  {/* Step Details - Expandable */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-default-100">
                      <div className="pt-4 pl-11">
                        {step.description && (
                          <p className="text-sm text-default-600 mb-4 whitespace-pre-wrap">
                            {step.description}
                          </p>
                        )}

                        {/* Resources */}
                        {step.resources && step.resources.length > 0 && (
                          <div className="mb-4 space-y-2">
                            {step.resources.map((resource, ri) => (
                              <a
                                key={ri}
                                href={resource.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <LinkIcon className="w-4 h-4" />
                                {resource.title || resource.url}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Notes Input */}
                        <Textarea
                          placeholder="Add a note (optional)..."
                          value={stepNotes[sp.id] || ''}
                          onValueChange={(v) => setStepNotes(prev => ({ ...prev, [sp.id]: v }))}
                          minRows={2}
                          size="sm"
                          className="mb-3"
                          isDisabled={sp.completed}
                        />

                        {/* Complete Button */}
                        <Button
                          color={sp.completed ? 'default' : 'success'}
                          variant={sp.completed ? 'flat' : 'solid'}
                          onPress={() => toggleStepComplete(sp.id, sp.completed)}
                          isLoading={savingStep === sp.id}
                          startContent={sp.completed ? <Circle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        >
                          {sp.completed ? 'Mark Incomplete' : 'Mark Complete'}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>

        {/* Completed Message */}
        {run.status === 'completed' && (
          <Card className="mt-6 bg-success-50 dark:bg-success-900/20 border-success-200">
            <CardBody className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success" />
              <h3 className="text-lg font-semibold text-success-700 dark:text-success-300">
                Playbook Completed!
              </h3>
              <p className="text-sm text-success-600 dark:text-success-400 mt-1">
                All {totalSteps} steps finished
              </p>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  )
}
