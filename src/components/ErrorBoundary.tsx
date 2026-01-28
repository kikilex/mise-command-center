'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button, Card, CardBody } from "@heroui/react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-4">
          <Card className="max-w-md w-full shadow-xl">
            <CardBody className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
              <p className="text-slate-500 mb-6">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4 p-3 bg-slate-100 rounded-lg text-sm">
                  <summary className="cursor-pointer text-slate-600 font-medium">Error Details</summary>
                  <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-40">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <div className="flex gap-3 justify-center">
                <Button 
                  variant="flat" 
                  onPress={this.handleGoHome}
                >
                  Go Home
                </Button>
                <Button 
                  color="primary" 
                  onPress={this.handleRetry}
                >
                  Try Again
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// A simpler inline error fallback component for smaller sections
export function ErrorFallback({ 
  error, 
  resetError 
}: { 
  error?: string
  resetError?: () => void 
}) {
  return (
    <Card className="bg-red-50 border border-red-200">
      <CardBody className="p-4 text-center">
        <p className="text-red-600 mb-2">{error || 'Something went wrong'}</p>
        {resetError && (
          <Button size="sm" variant="flat" color="danger" onPress={resetError}>
            Try Again
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
