'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Divider,
  Spinner,
  RadioGroup,
  Radio,
} from "@heroui/react"
import { Sun, Moon, Monitor } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { BUILD_VERSION } from '@/lib/version'
import {
  DEFAULT_MENU_CONFIG,
  MenuConfig,
  PERSONAL_MENU_OPTIONS,
  BUSINESS_MENU_OPTIONS,
  useMenuSettings,
} from '@/lib/menu-settings'

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

type ThemeValue = 'light' | 'dark' | 'system'

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
  const [savingTheme, setSavingTheme] = useState(false)
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS)
  const [mounted, setMounted] = useState(false)
  const [menuSettings, setMenuSettings] = useState<MenuConfig>(DEFAULT_MENU_CONFIG)
  const [savingMenus, setSavingMenus] = useState(false)
  
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const { menuConfig, updateMenuConfig, loading: menuLoading } = useMenuSettings()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    loadUserAndSettings()
  }, [])

  useEffect(() => {
    if (!menuLoading) {
      setMenuSettings(menuConfig)
    }
  }, [menuConfig, menuLoading])

  async function loadUserAndSettings() {
    setLoading(true)
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError || !authUser) {
        console.error('Auth error:', authError)
        setLoading(false)
        return
      }

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

      if (profile?.settings?.reminders) {
        setReminderSettings({
          ...DEFAULT_REMINDER_SETTINGS,
          ...profile.settings.reminders,
        })
      }

      if (profile?.settings?.theme) {
        setTheme(profile.settings.theme)
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
      const { data: profile, error: fetchError } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

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

  function toggleMenuItem(section: 'personal' | 'business', key: string) {
    setMenuSettings(prev => {
      const current = prev[section]
      const updated = current.includes(key)
        ? current.filter(item => item !== key)
        : [...current, key]

      return {
        ...prev,
        [section]: updated,
      }
    })
  }

  async function saveMenuSettings() {
    setSavingMenus(true)
    try {
      await updateMenuConfig(menuSettings)
      showSuccessToast('Menu settings saved')
    } catch (error) {
      console.error('Save menu settings error:', error)
      showErrorToast(error, 'Failed to save menu settings')
    } finally {
      setSavingMenus(false)
    }
  }

  function updateHighPriority(key: '24h' | '6h' | '1h', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      high: { ...prev.high, [key]: value }
    }))
  }

  function updateMediumPriority(key: '24h', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      medium: { ...prev.medium, [key]: value }
    }))
  }

  function updateLowPriority(key: 'day_of', value: boolean) {
    setReminderSettings(prev => ({
      ...prev,
      low: { ...prev.low, [key]: value }
    }))
  }

  function resetToDefaults() {
    setReminderSettings(DEFAULT_REMINDER_SETTINGS)
  }

  async function handleThemeChange(newTheme: ThemeValue) {
    setTheme(newTheme)
    
    if (!user) return

    setSavingTheme(true)
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      if (fetchError) throw fetchError

      const updatedSettings = {
        ...(profile?.settings || {}),
        theme: newTheme,
      }

      const { error } = await supabase
        .from('users')
        .update({ settings: updatedSettings })
        .eq('id', user.id)

      if (error) throw error

      showSuccessToast('Theme preference saved')
    } catch (error) {
      console.error('Save theme error:', error)
      showErrorToast(error, 'Failed to save theme preference')
    } finally {
      setSavingTheme(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Theme Settings Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col items-start px-6 pt-6">
            <h2 className="text-lg font-semibold">Appearance</h2>
            <p className="text-sm text-default-500 mt-1">
              Customize how the app looks on your device
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            {mounted ? (
              <RadioGroup
                label="Theme"
                value={theme}
                onValueChange={(value) => handleThemeChange(value as ThemeValue)}
                orientation="horizontal"
                classNames={{
                  wrapper: "gap-4 flex-wrap",
                }}
              >
                <Radio
                  value="light"
                  description="Always use light mode"
                  classNames={{
                    base: "inline-flex m-0 items-center justify-between flex-row-reverse max-w-[300px] cursor-pointer rounded-lg gap-4 p-4 border-2 border-default-200 data-[selected=true]:border-primary",
                    wrapper: "hidden",
                    labelWrapper: "ml-0",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-5 h-5" />
                    <span>Light</span>
                  </div>
                </Radio>
                <Radio
                  value="dark"
                  description="Always use dark mode"
                  classNames={{
                    base: "inline-flex m-0 items-center justify-between flex-row-reverse max-w-[300px] cursor-pointer rounded-lg gap-4 p-4 border-2 border-default-200 data-[selected=true]:border-primary",
                    wrapper: "hidden",
                    labelWrapper: "ml-0",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-5 h-5" />
                    <span>Dark</span>
                  </div>
                </Radio>
                <Radio
                  value="system"
                  description="Follow system settings"
                  classNames={{
                    base: "inline-flex m-0 items-center justify-between flex-row-reverse max-w-[300px] cursor-pointer rounded-lg gap-4 p-4 border-2 border-default-200 data-[selected=true]:border-primary",
                    wrapper: "hidden",
                    labelWrapper: "ml-0",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    <span>System</span>
                  </div>
                </Radio>
              </RadioGroup>
            ) : (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            )}
            {savingTheme && (
              <p className="text-sm text-default-500 mt-4">Saving...</p>
            )}
          </CardBody>
        </Card>

        {/* Reminder Settings Card */}
        <Card className="bg-content1 mb-6">
          <CardHeader className="flex flex-col items-start px-6 pt-6">
            <h2 className="text-lg font-semibold">Task Reminder Settings</h2>
            <p className="text-sm text-default-500 mt-1">
              Configure when you want to receive reminders based on task priority
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            <div className="space-y-8">
              {/* High Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-danger" />
                  <h3 className="font-semibold">High Priority / Critical Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.high['24h']}
                    onValueChange={(v) => updateHighPriority('24h', v)}
                  >
                    <span className="text-default-600">24 hours before due</span>
                  </Checkbox>
                  <Checkbox
                    isSelected={reminderSettings.high['6h']}
                    onValueChange={(v) => updateHighPriority('6h', v)}
                  >
                    <span className="text-default-600">6 hours before due</span>
                  </Checkbox>
                  <Checkbox
                    isSelected={reminderSettings.high['1h']}
                    onValueChange={(v) => updateHighPriority('1h', v)}
                  >
                    <span className="text-default-600">1 hour before due</span>
                  </Checkbox>
                </div>
              </div>

              {/* Medium Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <h3 className="font-semibold">Medium Priority Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.medium['24h']}
                    onValueChange={(v) => updateMediumPriority('24h', v)}
                  >
                    <span className="text-default-600">24 hours before due</span>
                  </Checkbox>
                </div>
              </div>

              {/* Low Priority */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-default-400" />
                  <h3 className="font-semibold">Low Priority Tasks</h3>
                </div>
                <div className="ml-5 space-y-3">
                  <Checkbox
                    isSelected={reminderSettings.low['day_of']}
                    onValueChange={(v) => updateLowPriority('day_of', v)}
                  >
                    <span className="text-default-600">Morning of due date (9:00 AM)</span>
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

        {/* Menu Settings Card */}
        <Card className="bg-content1 mb-6">
          <CardHeader className="flex flex-col items-start px-6 pt-6">
            <h2 className="text-lg font-semibold">Menu Visibility</h2>
            <p className="text-sm text-default-500 mt-1">
              Choose which sections appear in your sidebar
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            {menuLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-default-600 mb-3">Personal Menu</h3>
                  <div className="space-y-2">
                    {PERSONAL_MENU_OPTIONS.map(option => (
                      <Checkbox
                        key={`personal-${option.key}`}
                        isSelected={menuSettings.personal.includes(option.key)}
                        onValueChange={() => toggleMenuItem('personal', option.key)}
                      >
                        <span className="text-default-600">{option.label || 'Dashboard'}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-default-600 mb-3">Business Menu</h3>
                  <div className="space-y-2">
                    {BUSINESS_MENU_OPTIONS.map(option => (
                      <Checkbox
                        key={`business-${option.key}`}
                        isSelected={menuSettings.business.includes(option.key)}
                        onValueChange={() => toggleMenuItem('business', option.key)}
                      >
                        <span className="text-default-600">{option.label || 'Dashboard'}</span>
                      </Checkbox>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Divider className="my-6" />

            <div className="flex justify-end">
              <Button
                color="primary"
                onPress={saveMenuSettings}
                isLoading={savingMenus}
              >
                Save Menu Settings
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Info Card */}
        <Card className="bg-secondary/10 border border-secondary/20 mb-6">
          <CardBody className="px-6 py-4">
            <div className="flex gap-3">
              <span className="text-xl">💡</span>
              <div className="text-sm">
                <p className="font-medium mb-1">How reminders work:</p>
                <ul className="list-disc list-inside space-y-1 text-default-600">
                  <li>Reminders are checked periodically by the system</li>
                  <li>Each reminder window is tracked separately so you only get notified once per window</li>
                  <li>Tasks marked as Done will not trigger reminders</li>
                  <li>Tasks must have a due date set to receive reminders</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Build Version */}
        <div className="pt-4 border-t border-default-200">
          <p className="text-xs text-default-400 text-center">
            Build: {BUILD_VERSION}
          </p>
        </div>
      </main>
    </div>
  )
}
