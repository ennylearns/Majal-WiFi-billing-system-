import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { adminAPI } from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const initAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const savedUser = localStorage.getItem('user')
        const lastVerified = localStorage.getItem('last_token_verified')
        const now = Date.now()

        if (token && savedUser) {
          const parsedUser = JSON.parse(savedUser)
          setUser(parsedUser)
          
          // Only verify token if it hasn't been verified in the last 5 minutes
          if (!lastVerified || now - parseInt(lastVerified) > 5 * 60 * 1000) {
            try {
              const response = await adminAPI.getProfile()
              if (response.success && response.data) {
                setUser(response.data)
                localStorage.setItem('user', JSON.stringify(response.data))
                localStorage.setItem('last_token_verified', now.toString())
              }
            } catch (error: any) {
              // Only clear storage if it's an auth error, not rate limiting
              if (error.response?.status === 401 || error.response?.status === 403) {
                localStorage.removeItem('auth_token')
                localStorage.removeItem('user')
                localStorage.removeItem('last_token_verified')
                setUser(null)
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await adminAPI.login({ email, password })
      if (response.success && response.data) {
        const { user: loggedInUser, token } = response.data
        localStorage.setItem('auth_token', token)
        localStorage.setItem('user', JSON.stringify(loggedInUser))
        localStorage.setItem('last_token_verified', Date.now().toString())
        setUser(loggedInUser)
        return { success: true }
      }
      return { success: false, error: 'Login failed' }
    } catch (error: any) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    localStorage.removeItem('last_token_verified')
    setUser(null)
    initialized.current = false
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default useAuth

