'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Input, Button, Link, Divider } from '@heroui/react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mb-2">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back</h1>
          <p className="text-slate-500 text-sm">Sign in to your Command Center</p>
        </CardHeader>
        <CardBody className="px-8 pb-8">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              variant="bordered"
              isRequired
            />
            
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="bordered"
              isRequired
            />
            
            <Button
              type="submit"
              color="primary"
              className="mt-2 font-semibold"
              isLoading={loading}
              size="lg"
            >
              Sign In
            </Button>
          </form>
          
          <Divider className="my-6" />
          
          <p className="text-center text-slate-500 text-sm">
            Don't have an account?{' '}
            <Link href="/signup" className="font-semibold">
              Sign up
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
