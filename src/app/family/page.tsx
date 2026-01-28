'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Checkbox
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface ShoppingItem {
  id: string
  name: string
  quantity: number | null
  category: string | null
  is_checked: boolean
  created_by: string | null
  created_at: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const categories = [
  { key: 'produce', label: 'Produce', emoji: '🥬' },
  { key: 'dairy', label: 'Dairy', emoji: '🥛' },
  { key: 'meat', label: 'Meat & Seafood', emoji: '🥩' },
  { key: 'bakery', label: 'Bakery', emoji: '🍞' },
  { key: 'frozen', label: 'Frozen', emoji: '🧊' },
  { key: 'pantry', label: 'Pantry', emoji: '🥫' },
  { key: 'snacks', label: 'Snacks', emoji: '🍿' },
  { key: 'beverages', label: 'Beverages', emoji: '🥤' },
  { key: 'household', label: 'Household', emoji: '🧹' },
  { key: 'personal', label: 'Personal Care', emoji: '🧴' },
  { key: 'other', label: 'Other', emoji: '📦' },
]

export default function FamilyPage() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [formData, setFormData] = useState({
    name: '',
    quantity: '1',
    category: 'other',
  })
  
  const supabase = createClient()

  useEffect(() => {
    loadUser()
    loadItems()
  }, [])

  async function loadUser() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        return
      }
      
      if (authUser) {
        try {
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
        } catch (err) {
          console.error('Failed to fetch profile:', err)
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0],
          })
        }
      }
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  async function loadItems() {
    setLoading(true)
    setLoadError(null)
    
    try {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('*')
        .order('is_checked', { ascending: true })
        .order('created_at', { ascending: false })
      
      if (error) {
        throw error
      }
      
      setItems(data || [])
    } catch (error) {
      console.error('Load items error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load shopping list')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      showErrorToast(null, 'Please enter an item name')
      return
    }
    
    setSubmitting(true)
    
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .insert({
          name: formData.name.trim(),
          quantity: parseInt(formData.quantity) || 1,
          category: formData.category,
          is_checked: false,
          created_by: user?.id || null,
        })
      
      if (error) {
        throw error
      }
      
      showSuccessToast('Item added!')
      loadItems()
      handleClose()
    } catch (error) {
      console.error('Submit item error:', error)
      showErrorToast(error, 'Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleCheck(item: ShoppingItem) {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .update({ is_checked: !item.is_checked })
        .eq('id', item.id)
      
      if (error) {
        throw error
      }
      
      // Update local state immediately for snappy UI
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, is_checked: !i.is_checked } : i
      ))
    } catch (error) {
      console.error('Toggle check error:', error)
      showErrorToast(error, 'Failed to update item')
    }
  }

  async function handleDelete(itemId: string) {
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .eq('id', itemId)
      
      if (error) {
        throw error
      }
      
      setItems(prev => prev.filter(i => i.id !== itemId))
      showSuccessToast('Item removed')
    } catch (error) {
      console.error('Delete item error:', error)
      showErrorToast(error, 'Failed to delete item')
    }
  }

  async function handleClearChecked() {
    const checkedIds = items.filter(i => i.is_checked).map(i => i.id)
    if (checkedIds.length === 0) return
    
    try {
      const { error } = await supabase
        .from('shopping_list_items')
        .delete()
        .in('id', checkedIds)
      
      if (error) {
        throw error
      }
      
      setItems(prev => prev.filter(i => !i.is_checked))
      showSuccessToast(`Cleared ${checkedIds.length} items`)
    } catch (error) {
      console.error('Clear checked error:', error)
      showErrorToast(error, 'Failed to clear items')
    }
  }

  function handleClose() {
    setFormData({
      name: '',
      quantity: '1',
      category: 'other',
    })
    onClose()
  }

  function getCategoryInfo(categoryKey: string | null) {
    return categories.find(c => c.key === categoryKey) || { key: 'other', label: 'Other', emoji: '📦' }
  }

  // Filter and group items
  const filteredItems = useMemo(() => {
    let filtered = categoryFilter === 'all' 
      ? items 
      : items.filter(i => i.category === categoryFilter)
    
    // Sort: unchecked first, then by category, then by name
    return filtered.sort((a, b) => {
      if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1
      if (a.category !== b.category) return (a.category || 'zzz').localeCompare(b.category || 'zzz')
      return a.name.localeCompare(b.name)
    })
  }, [items, categoryFilter])

  const uncheckedCount = items.filter(i => !i.is_checked).length
  const checkedCount = items.filter(i => i.is_checked).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Family Shopping List</h1>
          <p className="text-slate-500">Shared list for the whole family</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-white shadow-sm border-0">
            <CardBody className="p-4 text-center">
              <p className="text-3xl font-bold text-slate-800">{uncheckedCount}</p>
              <p className="text-sm text-slate-500">Items to get</p>
            </CardBody>
          </Card>
          <Card className="bg-white shadow-sm border-0">
            <CardBody className="p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600">{checkedCount}</p>
              <p className="text-sm text-slate-500">In cart</p>
            </CardBody>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between mb-6">
          <div className="flex-1">
            <Select
              size="sm"
              selectedKeys={[categoryFilter]}
              onChange={(e) => setCategoryFilter(e.target.value || 'all')}
              className="max-w-xs"
              label="Filter by category"
              items={[{ key: 'all', label: 'All Categories', emoji: '' }, ...categories]}
            >
              {(cat) => (
                <SelectItem key={cat.key}>{cat.emoji ? `${cat.emoji} ` : ''}{cat.label}</SelectItem>
              )}
            </Select>
          </div>
          <div className="flex gap-2">
            {checkedCount > 0 && (
              <Button 
                size="sm" 
                variant="flat" 
                color="danger"
                onPress={handleClearChecked}
              >
                Clear Checked ({checkedCount})
              </Button>
            )}
            <Button 
              color="primary" 
              onPress={onOpen}
              className="font-semibold"
            >
              + Add Item
            </Button>
          </div>
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadItems} />
          </div>
        )}

        {/* Shopping List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading shopping list...</div>
        ) : !loadError && filteredItems.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <span className="text-4xl mb-4 block">🛒</span>
              <p className="text-slate-500 mb-4">
                {categoryFilter !== 'all' 
                  ? 'No items in this category' 
                  : 'Your shopping list is empty'}
              </p>
              <Button color="primary" onPress={onOpen}>Add your first item</Button>
            </CardBody>
          </Card>
        ) : !loadError && (
          <Card className="bg-white shadow-sm border-0">
            <CardBody className="p-0">
              <div className="divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const catInfo = getCategoryInfo(item.category)
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center gap-3 p-4 transition-colors ${
                        item.is_checked ? 'bg-slate-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Checkbox
                        isSelected={item.is_checked}
                        onValueChange={() => handleToggleCheck(item)}
                        size="lg"
                        color="success"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{catInfo.emoji}</span>
                          <span className={`font-medium ${
                            item.is_checked ? 'text-slate-400 line-through' : 'text-slate-800'
                          }`}>
                            {item.name}
                          </span>
                          {item.quantity && item.quantity > 1 && (
                            <Chip size="sm" variant="flat" className="bg-slate-100">
                              ×{item.quantity}
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">{catInfo.label}</p>
                      </div>

                      <Button 
                        size="sm" 
                        variant="light" 
                        isIconOnly
                        color="danger"
                        onPress={() => handleDelete(item.id)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        )}
      </main>

      {/* Add Item Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <ModalContent>
          <ModalHeader>Add Item</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Item Name"
                placeholder="e.g., Milk, Bread, Apples"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                isRequired
                autoFocus
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
                <Select
                  label="Category"
                  selectedKeys={[formData.category]}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  items={categories}
                >
                  {(cat) => (
                    <SelectItem key={cat.key}>{cat.emoji} {cat.label}</SelectItem>
                  )}
                </Select>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleSubmit}
              isDisabled={!formData.name.trim()}
              isLoading={submitting}
            >
              Add Item
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
