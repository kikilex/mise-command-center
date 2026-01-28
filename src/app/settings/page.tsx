'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Divider,
  Spinner,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

interface ReminderSettings {
  high: {
    '24h': boolean
    '6h': boolean
    '1h': boolean
  }
  medium: {
    '24h': boolean
  }
  low: {
    'day_of': boolean
  }
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  high: {
    '24h': true,
    '6h': true,
    '1h': true,
  },
  medium: {
    '24h': true,
  },
  low: {
    'day_of': true,
  },
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS)

  const supabase = createClient()

  useEffect(() => {
    loadUserAndSettings()
  }, [])

  async function loadUserAndSettings() {
    setLoading(true)
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser) {
        console.error('Auth error:', authError)
        setLoading(false)
        return
      }

      // Fetch user profile with settings
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
      }

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        name: profile?.name || authUser.email?.split('@')[0],
        avatar_url: profile?.avatar_url,
      })

      // Load reminder settings from profile.settings.reminders
      if (profile?.settings?.reminders) {
        setReminderSettings({
          ...DEFAULT_REMINDER_SETTINGS,
          ...profile.settings.reminders,
        })
      }
    } catch (error) {
      console.error('Load settings error:', error)
      showErrorToast(error, 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  async function saveReminderSettings() {
    if (!user) return

    setSaving(true)
    try {
      // Get current settings first
      const { data: profile, error: fetchError } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      // Merge with existing settings
      const updatedSettings = {
        ...(profile?.settings || {}),
        reminders: reminderSettings,
      }

      const { error } = await supabase
        .from('users')
        .update({ settings: updatedSettings })
        .eq('id', user.id)

      if (error) throw error

      showSuccessToast('Reminder settings saved')
    } catch (error) {
      console.error('Save settings error:', error)
      showErrorToast(error, 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  function updateHighPriority(key: '24h' | '6h' | '1h', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      high: { ...prev.high, [key]: value },
    }))
  }

  function updateMediumPriority(key: '24h', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      medium: { ...prev.medium, [key]: value },
    }))
  }

  function updateLowPriority(key: 'day_of', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      low: { ...prev.low, [key]: value },
    }))
  }

  function resetToDefaults() {
    setReminderSettings(DEFAULT_REMINDER_SETTINGS)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
        <Navbar user={null} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar user={user} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

        {/* Reminder Settings Card */}
        <Card className="bg-white mb-6">
          <CardHeader className="flex flex-col items-start px-6 pt-6">
            <h2 className="text-lg font-semibold text-slate-800">Task Reminder Settings</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure when you want to receive reminders based on task priority
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            <div className="space-y-8">
              {/* High Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <h3 className="font-semibold text-slate-700">High Priority / Critical Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.high['24h']}
                    onValueChange={(v) => updateHighPriority('24h', v)}
                  >
                    <span className="text-slate-600">24 hours before due</span>
                  </Checkbox>
                  <Checkbox
                    isSelected={reminderSettings.high['6h']}
                    onValueChange={(v) => updateHighPriority('6h', v)}
                  >
                    <span className="text-slate-600">6 hours before due</span>
                  </Checkbox>
                  <Checkbox
                    isSelected={reminderSettings.high['1h']}
                    onValueChange={(v) => updateHighPriority('1h', v)}
                  >
                    <span className="text-slate-600">1 hour before due</span>
                  </Checkbox>
                </div>
              </div>

              {/* Medium Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <h3 className="font-semibold text-slate-700">Medium Priority Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.medium['24h']}
                    onValueChange={(v) => updateMediumPriority('24h', v)}
                  >
                    <span className="text-slate-600">24 hours before due</span>
                  </Checkbox>
                </div>
              </div>

              {/* Low Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <h3 className="font-semibold text-slate-700">Low Priority Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.low['day_of']}
                    onValueChange={(v) => updateLowPriority('day_of', v)}
                  >
                    <span className="text-slate-600">Morning of due date (9:00 AM)</span>
                  </Checkbox>
                </div>
              </div>
            </div>

            <Divider className="my-6" />

            <div className="flex justify-between">
              <Button
                variant="flat"
                onPress={resetToDefaults}
              >
                Reset to Defaults
              </Button>
              <Button
                color="primary"
                onPress={saveReminderSettings}
                isLoading={saving}
              >
                Save Changes
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Info Card */}
        <Card className="bg-violet-50 border border-violet-200">
          <CardBody className="px-6 py-4">
            <div className="flex gap-3">
              <span className="text-xl">💡</span>
              <div className="text-sm text-violet-700">
                <p className="font-medium mb-1">How reminders work:</p>
                <ul className="list-disc list-inside space-y-1 text-violet-600">
                  <li>Reminders are checked periodically by the system</li>
                  <li>Each reminder window is tracked separately so you only get notified once per window</li>
                  <li>Tasks marked as Done will not trigger reminders</li>
                  <li>Tasks must have a due date set to receive reminders</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
