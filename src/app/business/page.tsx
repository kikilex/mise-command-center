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
  Chip,
  Tabs,
  Tab,
  Textarea,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { useBusiness } from '@/lib/business-context'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface Product {
  id: string
  name: string
  description: string | null
  price: number | null
  sku: string | null
  is_active: boolean
  created_at: string
}

interface Sale {
  id: string
  product_id: string | null
  amount: number
  quantity: number
  sale_date: string
  source: string
  notes: string | null
  product?: Product
}

interface ProductPerformance {
  product_id: string
  name: string
  total_revenue: number
  units_sold: number
}

export default function BusinessHubPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Data states
  const [products, setProducts] = useState<Product[]>([])
  const [salesStats, setSalesStats] = useState({
    today: 0,
    week: 0,
    month: 0,
  })
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([])
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  
  // Modals
  const { isOpen: isSaleOpen, onOpen: onSaleOpen, onClose: onSaleClose } = useDisclosure()
  const { isOpen: isProductOpen, onOpen: onProductOpen, onClose: onProductClose } = useDisclosure()
  
  // Form data
  const [saleFormData, setSaleFormData] = useState({
    product_id: '',
    amount: '',
    quantity: '1',
    sale_date: new Date().toISOString().split('T')[0],
    source: 'manual',
    notes: '',
  })
  
  const [productFormData, setProductFormData] = useState({
    name: '',
    description: '',
    price: '',
    sku: '',
  })
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const { selectedBusinessId, selectedBusiness } = useBusiness()
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (selectedBusinessId) {
      loadBusinessData()
    } else {
      // Personal mode - clear business data
      setSalesStats({ today: 0, week: 0, month: 0 })
      setProductPerformance([])
      setProducts([])
      setRecentSales([])
      setLoading(false)
    }
  }, [selectedBusinessId])

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
    if (!selectedBusinessId) return
    
    setLoading(true)
    setLoadError(null)
    
    try {
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', selectedBusinessId)
        .order('name')
      
      if (productsError) throw productsError
      setProducts(productsData || [])

      // Calculate date ranges
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // Load sales stats - Today
      const { data: todaySales, error: todayError } = await supabase
        .from('sales')
        .select('amount')
        .eq('business_id', selectedBusinessId)
        .gte('sale_date', todayStart)
      
      if (todayError) throw todayError
      const todayTotal = (todaySales || []).reduce((sum, s) => sum + Number(s.amount), 0)

      // Load sales stats - Week
      const { data: weekSales, error: weekError } = await supabase
        .from('sales')
        .select('amount')
        .eq('business_id', selectedBusinessId)
        .gte('sale_date', weekStart)
      
      if (weekError) throw weekError
      const weekTotal = (weekSales || []).reduce((sum, s) => sum + Number(s.amount), 0)

      // Load sales stats - Month
      const { data: monthSales, error: monthError } = await supabase
        .from('sales')
        .select('amount')
        .eq('business_id', selectedBusinessId)
        .gte('sale_date', monthStart)
      
      if (monthError) throw monthError
      const monthTotal = (monthSales || []).reduce((sum, s) => sum + Number(s.amount), 0)

      setSalesStats({
        today: todayTotal,
        week: weekTotal,
        month: monthTotal,
      })

      // Load product performance
      const { data: perfData, error: perfError } = await supabase
        .from('sales')
        .select(`
          product_id,
          amount,
          quantity,
          products!inner(name)
        `)
        .eq('business_id', selectedBusinessId)
        .not('product_id', 'is', null)
      
      if (perfError && perfError.code !== 'PGRST116') {
        // Ignore "no rows" error
        console.error('Performance query error:', perfError)
      }

      // Aggregate product performance
      const perfMap = new Map<string, ProductPerformance>()
      for (const sale of perfData || []) {
        const productName = (sale as any).products?.name || 'Unknown'
        const existing = perfMap.get(sale.product_id!)
        if (existing) {
          existing.total_revenue += Number(sale.amount)
          existing.units_sold += sale.quantity
        } else {
          perfMap.set(sale.product_id!, {
            product_id: sale.product_id!,
            name: productName,
            total_revenue: Number(sale.amount),
            units_sold: sale.quantity,
          })
        }
      }
      setProductPerformance(Array.from(perfMap.values()).sort((a, b) => b.total_revenue - a.total_revenue))

      // Load recent sales
      const { data: recentData, error: recentError } = await supabase
        .from('sales')
        .select('*, products(name)')
        .eq('business_id', selectedBusinessId)
        .order('sale_date', { ascending: false })
        .limit(10)
      
      if (recentError) throw recentError
      setRecentSales(recentData || [])

    } catch (error) {
      console.error('Load business data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load business data')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitSale() {
    if (!user || !selectedBusinessId) {
      showErrorToast(null, 'Please select a business first')
      return
    }

    const { amount, sale_date, source, quantity, product_id, notes } = saleFormData

    if (!amount || !sale_date) {
      showErrorToast(null, 'Please fill in amount and date')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showErrorToast(null, 'Please enter a valid amount')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('sales')
        .insert({
          business_id: selectedBusinessId,
          product_id: product_id || null,
          amount: parsedAmount,
          quantity: parseInt(quantity) || 1,
          sale_date: new Date(sale_date).toISOString(),
          source: source || 'manual',
          notes: notes || null,
          created_by: user.id,
        })

      if (error) throw error

      showSuccessToast('Sale recorded successfully!')
      setSaleFormData({
        product_id: '',
        amount: '',
        quantity: '1',
        sale_date: new Date().toISOString().split('T')[0],
        source: 'manual',
        notes: '',
      })
      onSaleClose()
      loadBusinessData()
    } catch (error) {
      console.error('Submit sale error:', error)
      showErrorToast(error, 'Failed to record sale')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitProduct() {
    if (!user || !selectedBusinessId) {
      showErrorToast(null, 'Please select a business first')
      return
    }

    const { name, description, price, sku } = productFormData

    if (!name.trim()) {
      showErrorToast(null, 'Please enter a product name')
      return
    }

    setSubmitting(true)

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            description: description || null,
            price: price ? parseFloat(price) : null,
            sku: sku || null,
          })
          .eq('id', editingProduct.id)

        if (error) throw error
        showSuccessToast('Product updated!')
      } else {
        const { error } = await supabase
          .from('products')
          .insert({
            business_id: selectedBusinessId,
            name: name.trim(),
            description: description || null,
            price: price ? parseFloat(price) : null,
            sku: sku || null,
            is_active: true,
          })

        if (error) throw error
        showSuccessToast('Product created!')
      }

      setProductFormData({ name: '', description: '', price: '', sku: '' })
      setEditingProduct(null)
      onProductClose()
      loadBusinessData()
    } catch (error) {
      console.error('Submit product error:', error)
      showErrorToast(error, 'Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product)
    setProductFormData({
      name: product.name,
      description: product.description || '',
      price: product.price?.toString() || '',
      sku: product.sku || '',
    })
    onProductOpen()
  }

  function handleNewProduct() {
    setEditingProduct(null)
    setProductFormData({ name: '', description: '', price: '', sku: '' })
    onProductOpen()
  }

  const sourceOptions = [
    { key: 'manual', label: 'Manual Entry' },
    { key: 'shopify', label: 'Shopify' },
    { key: 'amazon', label: 'Amazon' },
    { key: 'tiktok', label: 'TikTok Shop' },
    { key: 'etsy', label: 'Etsy' },
    { key: 'other', label: 'Other' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {selectedBusiness ? selectedBusiness.name : 'Business Hub'}
            </h1>
            {selectedBusiness?.description && (
              <p className="text-slate-500 text-sm mt-1">{selectedBusiness.description}</p>
            )}
          </div>
          
          {selectedBusinessId && (
            <div className="flex gap-2 flex-wrap">
              <Button color="primary" variant="flat" onPress={handleNewProduct} className="min-h-[44px]">
                + Add Product
              </Button>
              <Button color="primary" onPress={onSaleOpen} className="min-h-[44px]">
                + Record Sale
              </Button>
            </div>
          )}
        </div>

        {/* No business selected state */}
        {!selectedBusinessId && (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Select a Business</h3>
              <p className="text-slate-500">
                Use the business selector in the navbar to choose a business and view its data.
              </p>
            </CardBody>
          </Card>
        )}

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadBusinessData} />
          </div>
        )}

        {/* Business Content */}
        {selectedBusinessId && !loadError && (
          <>
            {/* Sales Stats */}
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading sales data...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-white">
                  <CardBody className="p-5">
                    <p className="text-slate-500 text-sm mb-1">Revenue Today</p>
                    <p className="text-3xl font-bold text-slate-800">
                      ${salesStats.today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </CardBody>
                </Card>
                <Card className="bg-white">
                  <CardBody className="p-5">
                    <p className="text-slate-500 text-sm mb-1">Revenue This Week</p>
                    <p className="text-3xl font-bold text-slate-800">
                      ${salesStats.week.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </CardBody>
                </Card>
                <Card className="bg-white">
                  <CardBody className="p-5">
                    <p className="text-slate-500 text-sm mb-1">Revenue This Month</p>
                    <p className="text-3xl font-bold text-slate-800">
                      ${salesStats.month.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Tabs */}
            <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 mb-6">
              <Tabs 
                selectedKey={activeTab} 
                onSelectionChange={(key) => setActiveTab(key as string)}
                classNames={{
                  tabList: "flex-nowrap",
                  tab: "min-h-[44px] whitespace-nowrap",
                }}
              >
                <Tab key="overview" title="Overview" />
                <Tab key="products" title={`Products (${products.length})`} />
                <Tab key="sales" title="Recent Sales" />
              </Tabs>
            </div>

            {/* Tab Content */}
            {!loading && (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Product Performance */}
                    <Card className="bg-white">
                      <CardBody className="p-5">
                        <h3 className="font-semibold text-lg text-slate-800 mb-4">Top Products</h3>
                        {productPerformance.length === 0 ? (
                          <p className="text-slate-500 text-sm">No sales data yet</p>
                        ) : (
                          <div className="space-y-3">
                            {productPerformance.slice(0, 5).map((product) => (
                              <div key={product.product_id} className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-slate-800">{product.name}</p>
                                  <p className="text-xs text-slate-500">{product.units_sold} units sold</p>
                                </div>
                                <p className="font-semibold text-slate-700">
                                  ${product.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardBody>
                    </Card>

                    {/* Recent Activity */}
                    <Card className="bg-white">
                      <CardBody className="p-5">
                        <h3 className="font-semibold text-lg text-slate-800 mb-4">Recent Sales</h3>
                        {recentSales.length === 0 ? (
                          <p className="text-slate-500 text-sm">No sales recorded yet</p>
                        ) : (
                          <div className="space-y-3">
                            {recentSales.slice(0, 5).map((sale) => (
                              <div key={sale.id} className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-slate-800">
                                    {(sale as any).products?.name || 'General Sale'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(sale.sale_date).toLocaleDateString()} via {sale.source}
                                  </p>
                                </div>
                                <p className="font-semibold text-green-600">
                                  +${Number(sale.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {products.length === 0 ? (
                      <Card className="bg-white col-span-full">
                        <CardBody className="text-center py-12">
                          <p className="text-slate-500 mb-4">No products yet</p>
                          <Button color="primary" onPress={handleNewProduct}>Add Your First Product</Button>
                        </CardBody>
                      </Card>
                    ) : (
                      products.map((product) => (
                        <Card key={product.id} className="bg-white hover:shadow-md transition-shadow">
                          <CardBody className="p-5">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-slate-800">{product.name}</h4>
                              <Chip size="sm" color={product.is_active ? 'success' : 'default'} variant="flat">
                                {product.is_active ? 'Active' : 'Inactive'}
                              </Chip>
                            </div>
                            {product.description && (
                              <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <div>
                                {product.price && (
                                  <p className="font-bold text-lg text-slate-800">${product.price.toFixed(2)}</p>
                                )}
                                {product.sku && (
                                  <p className="text-xs text-slate-400">SKU: {product.sku}</p>
                                )}
                              </div>
                              <Button size="sm" variant="flat" onPress={() => handleEditProduct(product)}>
                                Edit
                              </Button>
                            </div>
                          </CardBody>
                        </Card>
                      ))
                    )}
                  </div>
                )}

                {/* Sales Tab */}
                {activeTab === 'sales' && (
                  <Card className="bg-white">
                    <CardBody className="p-0">
                      {recentSales.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-slate-500 mb-4">No sales recorded yet</p>
                          <Button color="primary" onPress={onSaleOpen}>Record Your First Sale</Button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50 border-b">
                              <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Date</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Product</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Source</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Qty</th>
                                <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {recentSales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    {new Date(sale.sale_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-800">
                                    {(sale as any).products?.name || '-'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Chip size="sm" variant="flat">{sale.source}</Chip>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600 text-right">
                                    {sale.quantity}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-green-600 text-right">
                                    ${Number(sale.amount).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Record Sale Modal */}
      <Modal isOpen={isSaleOpen} onClose={onSaleClose} size="lg">
        <ModalContent>
          <ModalHeader>Record Sale</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Select
                label="Product (Optional)"
                placeholder="Select a product"
                selectedKeys={saleFormData.product_id ? [saleFormData.product_id] : []}
                onChange={(e) => setSaleFormData({ ...saleFormData, product_id: e.target.value })}
              >
                {products.map((p) => (
                  <SelectItem key={p.id}>{p.name}</SelectItem>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  startContent={<span className="text-slate-400">$</span>}
                  value={saleFormData.amount}
                  onChange={(e) => setSaleFormData({ ...saleFormData, amount: e.target.value })}
                  isRequired
                />
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={saleFormData.quantity}
                  onChange={(e) => setSaleFormData({ ...saleFormData, quantity: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Date"
                  type="date"
                  value={saleFormData.sale_date}
                  onChange={(e) => setSaleFormData({ ...saleFormData, sale_date: e.target.value })}
                  isRequired
                />
                <Select
                  label="Source"
                  selectedKeys={[saleFormData.source]}
                  onChange={(e) => setSaleFormData({ ...saleFormData, source: e.target.value })}
                >
                  {sourceOptions.map((s) => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <Textarea
                label="Notes (Optional)"
                placeholder="Any additional details..."
                value={saleFormData.notes}
                onChange={(e) => setSaleFormData({ ...saleFormData, notes: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onSaleClose}>Cancel</Button>
            <Button
              color="primary"
              onPress={handleSubmitSale}
              isDisabled={!saleFormData.amount || !saleFormData.sale_date}
              isLoading={submitting}
            >
              Record Sale
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Product Modal */}
      <Modal isOpen={isProductOpen} onClose={onProductClose} size="lg">
        <ModalContent>
          <ModalHeader>{editingProduct ? 'Edit Product' : 'Add Product'}</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Product Name"
                placeholder="e.g., Spiritual Warfare Prayer Guide"
                value={productFormData.name}
                onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                isRequired
              />
              <Textarea
                label="Description"
                placeholder="Brief description of the product..."
                value={productFormData.description}
                onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  startContent={<span className="text-slate-400">$</span>}
                  value={productFormData.price}
                  onChange={(e) => setProductFormData({ ...productFormData, price: e.target.value })}
                />
                <Input
                  label="SKU"
                  placeholder="e.g., SWP-001"
                  value={productFormData.sku}
                  onChange={(e) => setProductFormData({ ...productFormData, sku: e.target.value })}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onProductClose}>Cancel</Button>
            <Button
              color="primary"
              onPress={handleSubmitProduct}
              isDisabled={!productFormData.name.trim()}
              isLoading={submitting}
            >
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
