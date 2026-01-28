'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader, Input, Button, Link, Divider } from '@heroui/react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardBody className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Check your email</h2>
            <p className="text-slate-500 mb-6">
              We've sent a confirmation link to <strong>{email}</strong>
            </p>
            <Link href="/login">
              <Button color="primary" variant="flat">
                Back to Login
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-col gap-1 items-center pt-8 pb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mb-2">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create account</h1>
          <p className="text-slate-500 text-sm">Join the Mise Command Center</p>
        </CardHeader>
        <CardBody className="px-8 pb-8">
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
                {error}
              </div>
            )}
            
            <Input
              type="text"
              label="Full Name"
              placeholder="Alex Mise"
              value={name}
              onChange={(e) => setName(e.target.value)}
              variant="bordered"
              isRequired
            />
            
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
              description="At least 6 characters"
            />
            
            <Button
              type="submit"
              color="primary"
              className="mt-2 font-semibold"
              isLoading={loading}
              size="lg"
            >
              Create Account
            </Button>
          </form>
          
          <Divider className="my-6" />
          
          <p className="text-center text-slate-500 text-sm">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold">
              Sign in
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
