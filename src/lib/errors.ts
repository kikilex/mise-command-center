import toast from 'react-hot-toast'

// Error types for better categorization
export type ErrorType = 'network' | 'auth' | 'database' | 'validation' | 'unknown'

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'Failed to fetch': 'Unable to connect. Please check your internet connection.',
  'NetworkError': 'Network error. Please check your connection and try again.',
  'TypeError: Failed to fetch': 'Connection failed. Please try again.',
  
  // Auth errors
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'Email not confirmed': 'Please verify your email address before signing in.',
  'User already registered': 'An account with this email already exists.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters.',
  'Invalid email': 'Please enter a valid email address.',
  
  // Database errors
  'duplicate key value': 'This item already exists.',
  'foreign key violation': 'This operation references data that no longer exists.',
  'null value in column': 'Please fill in all required fields.',
  
  // Rate limiting
  'rate limit': 'Too many requests. Please wait a moment and try again.',
}

// Get user-friendly message from error
export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unexpected error occurred'
  
  let message = ''
  
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'object' && error !== null) {
    message = (error as any).message || (error as any).error_description || JSON.stringify(error)
  } else if (typeof error === 'string') {
    message = error
  } else {
    message = 'An unexpected error occurred'
  }
  
  // Check for known error patterns
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return friendlyMessage
    }
  }
  
  // Return original message if no pattern matched (but clean it up)
  return message.length > 100 ? message.substring(0, 100) + '...' : message
}

// Determine error type
export function getErrorType(error: unknown): ErrorType {
  const message = getErrorMessage(error).toLowerCase()
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return 'network'
  }
  if (message.includes('auth') || message.includes('login') || message.includes('password') || message.includes('email')) {
    return 'auth'
  }
  if (message.includes('database') || message.includes('duplicate') || message.includes('foreign key')) {
    return 'database'
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('validation')) {
    return 'validation'
  }
  return 'unknown'
}

// Show error toast with user-friendly message
export function showErrorToast(error: unknown, fallbackMessage?: string): void {
  const message = getErrorMessage(error) || fallbackMessage || 'An error occurred'
  toast.error(message)
}

// Show success toast
export function showSuccessToast(message: string): void {
  toast.success(message)
}

// Wrapper for async operations with error handling
export async function handleAsync<T>(
  operation: () => Promise<T>,
  options?: {
    errorMessage?: string
    successMessage?: string
    showSuccessToast?: boolean
    onError?: (error: unknown) => void
  }
): Promise<{ data: T | null; error: unknown | null }> {
  try {
    const data = await operation()
    if (options?.showSuccessToast && options?.successMessage) {
      showSuccessToast(options.successMessage)
    }
    return { data, error: null }
  } catch (error) {
    console.error('Operation failed:', error)
    showErrorToast(error, options?.errorMessage)
    options?.onError?.(error)
    return { data: null, error }
  }
}

// Check if error is a network error
export function isNetworkError(error: unknown): boolean {
  return getErrorType(error) === 'network'
}

// Retry wrapper for network operations
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      // Don't retry non-network errors
      if (!isNetworkError(error)) {
        throw error
      }
      
      // Don't wait on the last attempt
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }
  }
  
  throw lastError
}
