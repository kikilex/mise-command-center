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
  useDisclosure,
} from "@heroui/react"
import { SunIcon, MoonIcon, ComputerDesktopIcon, PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import SettingsNav from '@/components/SettingsNav'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { useBusiness, Business } from '@/lib/business-context'
import { useMenuSettings, PERSONAL_MENU_OPTIONS, BUSINESS_MENU_OPTIONS, DEFAULT_MENU_CONFIG, MenuConfig } from '@/lib/menu-settings'
import AddBusinessModal from '@/components/AddBusinessModal'
import EditBusinessModal from '@/components/EditBusinessModal'
import DeleteBusinessModal from '@/components/DeleteBusinessModal'
import { BUILD_VERSION } from '@/lib/version'

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
  const [savingMenus, setSavingMenus] = useState(false)
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS)
  const [mounted, setMounted] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  const [deletingBusiness, setDeletingBusiness] = useState<Business | null>(null)
  const [localMenuConfig, setLocalMenuConfig] = useState<MenuConfig>(DEFAULT_MENU_CONFIG)
  
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const { businesses, refreshBusinesses } = useBusiness()
  const { menuConfig, updateMenuConfig, refreshMenuSettings } = useMenuSettings()
  
  const { 
    isOpen: isAddOpen, 
    onOpen: onAddOpen, 
    onClose: onAddClose 
  } = useDisclosure()
  
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure()
  
  const { 
    isOpen: isDeleteOpen, 
    onOpen: onDeleteOpen, 
    onClose: onDeleteClose 
  } = useDisclosure()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    loadUserAndSettings()
  }, [])

  // Sync local menu config with context
  useEffect(() => {
    setLocalMenuConfig(menuConfig)
  }, [menuConfig])

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

      // Load theme setting from profile.settings.theme
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

  function togglePersonalMenu(key: string) {
    setLocalMenuConfig(prev => ({
      ...prev,
      personal: prev.personal.includes(key)
        ? prev.personal.filter(k => k !== key)
        : [...prev.personal, key],
    }))
  }

  function toggleBusinessMenu(key: string) {
    setLocalMenuConfig(prev => ({
      ...prev,
      business: prev.business.includes(key)
        ? prev.business.filter(k => k !== key)
        : [...prev.business, key],
    }))
  }

  async function saveMenuSettings() {
    setSavingMenus(true)
    try {
      await updateMenuConfig(localMenuConfig)
      showSuccessToast('Menu settings saved')
    } catch (error) {
      console.error('Save menu settings error:', error)
      showErrorToast(error, 'Failed to save menu settings')
    } finally {
      setSavingMenus(false)
    }
  }

  function resetMenusToDefaults() {
    setLocalMenuConfig(DEFAULT_MENU_CONFIG)
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
        <Navbar user={null} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Settings Sidebar */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24">
                <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
                <SettingsNav />
              </div>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
              <SettingsNav />
            </div>
          </div>

          {/* Settings Content */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground mb-6">General Settings</h2>

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
                  wrapper: "gap-4",
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
                    <SunIcon className="w-5 h-5" />
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
                    <MoonIcon className="w-5 h-5" />
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
                    <ComputerDesktopIcon className="w-5 h-5" />
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

        {/* Menu Customization Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col items-start px-6 pt-6">
            <h2 className="text-lg font-semibold">Menu Customization</h2>
            <p className="text-sm text-default-500 mt-1">
              Choose which modules appear in your navigation menu for each context
            </p>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Menu */}
              <div className="p-4 rounded-lg border border-default-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">👤</span>
                  <h3 className="font-semibold">Personal Menu</h3>
                </div>
                <p className="text-sm text-default-500 mb-4">
                  Shown when no business is selected
                </p>
                <div className="space-y-3">
                  {PERSONAL_MENU_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.key}
                      isSelected={localMenuConfig.personal.includes(option.key)}
                      onValueChange={() => togglePersonalMenu(option.key)}
                    >
                      <span className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        <span className="text-default-600">{option.label}</span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </div>

              {/* Business Menu */}
              <div className="p-4 rounded-lg border border-default-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">💼</span>
                  <h3 className="font-semibold">Business Menu</h3>
                </div>
                <p className="text-sm text-default-500 mb-4">
                  Shown when a business is selected
                </p>
                <div className="space-y-3">
                  {BUSINESS_MENU_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.key}
                      isSelected={localMenuConfig.business.includes(option.key)}
                      onValueChange={() => toggleBusinessMenu(option.key)}
                    >
                      <span className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        <span className="text-default-600">{option.label}</span>
                      </span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            </div>

            <Divider className="my-6" />

            <div className="flex justify-between">
              <Button
                variant="flat"
                onPress={resetMenusToDefaults}
              >
                Reset to Defaults
              </Button>
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

        {/* Business Management Card */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between px-6 pt-6">
            <div>
              <h2 className="text-lg font-semibold">Business Management</h2>
              <p className="text-sm text-default-500 mt-1">
                Manage your businesses and organizations
              </p>
            </div>
            <Button
              color="primary"
              size="sm"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={onAddOpen}
            >
              Add Business
            </Button>
          </CardHeader>
          <Divider />
          <CardBody className="px-6 py-6">
            {businesses.length === 0 ? (
              <div className="text-center py-8 text-default-500">
                <p className="mb-4">You don&apos;t have any businesses yet.</p>
                <Button
                  color="primary"
                  variant="flat"
                  startContent={<PlusIcon className="w-4 h-4" />}
                  onPress={onAddOpen}
                >
                  Create Your First Business
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {businesses.map((business) => (
                  <div
                    key={business.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-default-200 hover:border-default-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: business.color || '#3b82f6' }}
                      />
                      <div>
                        <p className="font-medium">{business.name}</p>
                        {business.description && (
                          <p className="text-sm text-default-500 line-clamp-1">
                            {business.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => {
                          setEditingBusiness(business)
                          onEditOpen()
                        }}
                      >
                        <PencilIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => {
                          setDeletingBusiness(business)
                          onDeleteOpen()
                        }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Info Card */}
        <Card className="bg-secondary/10 border border-secondary/20">
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
          </div>
        </div>
      </main>

      {/* Business Modals */}
      <AddBusinessModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onSuccess={refreshBusinesses}
      />

      <EditBusinessModal
        isOpen={isEditOpen}
        onClose={() => {
          onEditClose()
          setEditingBusiness(null)
        }}
        onSuccess={refreshBusinesses}
        business={editingBusiness}
      />

      <DeleteBusinessModal
        isOpen={isDeleteOpen}
        onClose={() => {
          onDeleteClose()
          setDeletingBusiness(null)
        }}
        onSuccess={refreshBusinesses}
        business={deletingBusiness}
      />

      {/* Build Version */}
      <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Build: {BUILD_VERSION}
        </p>
      </div>
    </div>
  )
}
