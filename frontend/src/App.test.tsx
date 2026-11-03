import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'
import { adminAPI } from './services/api'

vi.mock('./services/api', () => ({
  adminAPI: {
    login: vi.fn(),
    getProfile: vi.fn(),
    getDashboardStats: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Admin Login Navigation Loop', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    store = {}
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          store[key] = val
        }),
        removeItem: vi.fn((key: string) => {
          delete store[key]
        }),
        clear: vi.fn(() => {
          store = {}
        }),
      },
      writable: true,
      configurable: true,
    })
  })

  it('successfully transitions from login to admin dashboard without infinite redirect loop', async () => {
    vi.mocked(adminAPI.login).mockResolvedValueOnce({
      success: true,
      data: {
        token: 'test-token',
        user: {
          id: 'user-1',
          phone: '1234567890',
          email: 'admin@collospot.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
          isActive: true,
          createdAt: '2026-01-01',
        },
      },
    })
    vi.mocked(adminAPI.getDashboardStats).mockResolvedValue({
      success: true,
      data: {
        totalRevenue: 1000,
        todayRevenue: 100,
        activeSessions: 5,
        totalSessions: 20,
        totalUsers: 10,
        activeUsers: 8,
      },
    })

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <App />
      </MemoryRouter>
    )

    // Form should be visible
    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'admin@collospot.com' } })
    fireEvent.change(passwordInput, { target: { value: 'admin123' } })
    fireEvent.click(submitButton)

    // After login, we expect AdminDashboard content, not an infinite redirect crash
    await waitFor(() => {
      expect(screen.getByText(/Admin Portal/i)).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated user accessing /admin to /admin/login', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  it('redirects authenticated user accessing /admin/login to /admin', async () => {
    store['auth_token'] = 'existing-token'
    store['user'] = JSON.stringify({
      id: 'user-1',
      email: 'admin@collospot.com',
      role: 'ADMIN',
      firstName: 'Admin',
    })
    store['last_token_verified'] = Date.now().toString()

    vi.mocked(adminAPI.getDashboardStats).mockResolvedValue({
      success: true,
      data: {
        totalRevenue: 1000,
        todayRevenue: 100,
        activeSessions: 5,
        totalSessions: 20,
        totalUsers: 10,
        activeUsers: 8,
      },
    })

    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <App />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Admin Portal/i)).toBeInTheDocument()
    })
  })
})
