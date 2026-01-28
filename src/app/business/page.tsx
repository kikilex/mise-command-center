'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardBody,
  Input,
  useDisclosure,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/UserMenu'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface SalesData {
  id: string;
  product_name: string;
  amount: number;
  date: string;
}

interface ProductPerformance {
  product_id: string;
  name: string;
  total_revenue: number;
  units_sold: number;
}

export default function BusinessHubPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [salesStats, setSalesStats] = useState({
    today: 0,
    week: 0,
    month: 0,
  })
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [formData, setFormData] = useState({
    product_name: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  })

  const supabase = createClient()

  useEffect(() => {
    loadUser()
    loadBusinessData()
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
      showErrorToast(error, 'Failed to load user data')
    }
  }

  async function loadBusinessData() {
    setLoading(true)
    setLoadError(null)
    
    try {
      // Placeholder for fetching sales stats and product performance from Supabase
      // This would involve more complex SQL queries or Supabase functions
      // For now, setting dummy data
      setSalesStats({
        today: 1250,
        week: 8500,
        month: 32000,
      })

      setProductPerformance([
        { product_id: 'prod_1', name: 'Product A', total_revenue: 15000, units_sold: 300 },
        { product_id: 'prod_2', name: 'Product B', total_revenue: 10000, units_sold: 200 },
        { product_id: 'prod_3', name: 'Product C', total_revenue: 7000, units_sold: 150 },
      ])
    } catch (error) {
      console.error('Load business data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load business data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!user) {
      showErrorToast(null, 'You must be logged in to submit data.')
      return
    }

    const { product_name, amount, date } = formData;

    if (!product_name.trim() || !amount || !date) {
      showErrorToast(null, 'Please fill in all fields.')
      return
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showErrorToast(null, 'Please enter a valid amount.')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('sales_data') // Assuming a 'sales_data' table
        .insert({
          product_name,
          amount: parsedAmount,
          date,
          user_id: user.id, // Associate sales data with the current user
        })

      if (error) {
        throw error
      }

      showSuccessToast('Sales data entered successfully!')
      setFormData({
        product_name: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
      })
      onClose()
      loadBusinessData() // Refresh data after submission
    } catch (error) {
      console.error('Submit sales data error:', error)
      showErrorToast(error, 'Failed to enter sales data')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise Command Center</span>
              </a>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Business Hub</h1>
            <div className="flex items-center gap-2">
              {user && <UserMenu user={user} />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Sales Overview</h2>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadBusinessData} />
          </div>
        )}

        {/* Sales Stats */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading sales data...</div>
        ) : !loadError && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-white">
              <CardBody className="p-5">
                <p className="text-slate-500 text-sm mb-1">Revenue Today</p>
                <p className="text-3xl font-bold text-slate-800">${salesStats.today.toLocaleString()}</p>
              </CardBody>
            </Card>
            <Card className="bg-white">
              <CardBody className="p-5">
                <p className="text-slate-500 text-sm mb-1">Revenue This Week</p>
                <p className="text-3xl font-bold text-slate-800">${salesStats.week.toLocaleString()}</p>
              </CardBody>
            </Card>
            <Card className="bg-white">
              <CardBody className="p-5">
                <p className="text-slate-500 text-sm mb-1">Revenue This Month</p>
                <p className="text-3xl font-bold text-slate-800">${salesStats.month.toLocaleString()}</p>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Manual Sales Entry */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Product Performance</h2>
          <Button color="primary" onPress={onOpen} className="font-semibold">
            + Manual Sales Entry
          </Button>
        </div>

        {/* Product Performance Cards */}
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading product performance...</div>
        ) : !loadError && productPerformance.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <p className="text-slate-500">No product performance data available.</p>
            </CardBody>
          </Card>
        ) : !loadError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productPerformance.map((product) => (
              <Card key={product.product_id} className="bg-white">
                <CardBody className="p-5">
                  <h3 className="font-semibold text-lg text-slate-800 mb-2">{product.name}</h3>
                  <div className="flex justify-between items-center text-sm">
                    <p className="text-slate-500">Total Revenue:</p>
                    <p className="font-medium text-slate-700">${product.total_revenue.toLocaleString()}</p>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-1">
                    <p className="text-slate-500">Units Sold:</p>
                    <p className="font-medium text-slate-700">{product.units_sold.toLocaleString()}</p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Manual Sales Entry Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalContent>
          <ModalHeader>Manual Sales Data Entry</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Product Name"
                placeholder="e.g., Premium Coffee Beans"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                isRequired
              />
              <Input
                label="Amount"
                type="number"
                placeholder="e.g., 250.75"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                isRequired
              />
              <Input
                label="Date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                isRequired
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isDisabled={!formData.product_name.trim() || !formData.amount || !formData.date}
              isLoading={submitting}
            >
              Submit Sales Data
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
