import React, { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await login(email, password)
      if (result.success) {
        toast.success('Login successful!')
        navigate('/admin', { replace: true })
      } else {
        const errorMsg = result.error || 'Login failed'
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err) {
      setError('Login failed')
      toast.error('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-canvas flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-surface-card rounded-card border border-border-subtle shadow-card w-full max-w-[400px] p-8">
          {/* Logo block */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  router
                </span>
              </div>
              <div className="flex items-baseline tracking-tight">
                <span className="text-[20px] font-semibold text-text-primary">Majal</span>
                <span className="text-[20px] font-semibold text-primary ml-0.5">ISP</span>
              </div>
            </div>
            <h1 className="text-[20px] font-semibold text-text-primary tracking-tight leading-tight">
              Sign in to ISP Console
            </h1>
            <p className="text-sm text-text-muted text-center mt-1">
              Sign in to manage your WiFi billing system
            </p>
          </div>

          {/* Error message display */}
          {error && (
            <div className="mb-4 p-2.5 rounded-control bg-status-danger-bg border border-status-danger-border text-status-danger text-sm text-center">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-text-primary mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                className={`h-10 w-full rounded-control border px-3 text-sm text-text-primary placeholder:text-placeholder focus:outline-none focus:ring-2 transition-colors ${
                  error
                    ? 'border-status-danger focus:ring-status-danger/[0.12]'
                    : 'border-border-subtle focus:border-primary focus:ring-primary/[0.12]'
                }`}
                placeholder="admin@majalisp.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-text-primary mb-1.5"
              >
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError(null)
                  }}
                  className={`h-10 w-full rounded-control border pl-3 pr-10 text-sm text-text-primary placeholder:text-placeholder focus:outline-none focus:ring-2 transition-colors ${
                    error
                      ? 'border-status-danger focus:ring-status-danger/[0.12]'
                      : 'border-border-subtle focus:border-primary focus:ring-primary/[0.12]'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle visibility"
                  className="absolute right-2.5 p-1 text-text-placeholder hover:text-text-muted focus:outline-none transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] select-none block leading-none">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-primary hover:bg-primary-hover active:bg-primary-active text-white font-medium text-sm rounded-control transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border-subtle flex items-center gap-2 text-text-muted">
            <span
              className="material-symbols-outlined text-[17px] text-primary shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              security
            </span>
            <p className="text-[12px] leading-relaxed text-text-muted">
              Encrypted operator access. Sessions are logged and audited.
            </p>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-text-muted">
              Default credentials: admin@majalisp.com / admin123
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a
            href="/"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors group"
          >
            <span className="transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Back to Customer Portal</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
