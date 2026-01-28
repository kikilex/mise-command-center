'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Input, Button, Link, Divider } from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, getErrorMessage } from '@/lib/errors'

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

    // Validation
    if (!email.trim()) {
      setError('Please enter your email address')
      setLoading(false)
      return
    }

    if (!password) {
      setError('Please enter your password')
      setLoading(false)
      return
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        // Provide user-friendly error messages
        let friendlyMessage = getErrorMessage(signInError)
        
        if (signInError.message.includes('Invalid login credentials')) {
          friendlyMessage = 'Invalid email or password. Please try again.'
        } else if (signInError.message.includes('Email not confirmed')) {
          friendlyMessage = 'Please verify your email address before signing in.'
        } else if (signInError.message.includes('Too many requests')) {
          friendlyMessage = 'Too many login attempts. Please wait a moment and try again.'
        }
        
        setError(friendlyMessage)
        setLoading(false)
        return
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('Login error:', err)
      const errorMessage = getErrorMessage(err)
      setError(errorMessage)
      showErrorToast(err, 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center mb-2">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-default-500 text-sm">Sign in to your Command Center</p>
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
              isDisabled={loading}
            />
            
            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="bordered"
              isRequired
              isDisabled={loading}
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
