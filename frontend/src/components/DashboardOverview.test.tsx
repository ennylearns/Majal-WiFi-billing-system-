import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardOverview from './DashboardOverview'
import { adminAPI } from '../services/api'
import type { DashboardStats } from '../types'

vi.mock('../services/api', () => ({
  adminAPI: {
    getPayments: vi.fn(),
    getHealth: vi.fn(),
  },
}))

describe('DashboardOverview Component - Infrastructure Status', () => {
  const mockStats: DashboardStats = {
    totalUsers: 150,
    activeUsers: 45,
    totalRevenue: 25000,
    todayRevenue: 3500,
    activeSessions: 12,
    totalSessions: 320,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminAPI.getPayments).mockResolvedValue({
      success: true,
      data: {
        payments: [],
        pagination: { page: 1, limit: 5, total: 0, pages: 0 },
      },
    })
  })

  it('fetches health check on mount and renders live infrastructure rows with real status and message', async () => {
    vi.mocked(adminAPI.getHealth).mockResolvedValueOnce({
      postgres: { status: 'ok', message: 'Connected' },
      paystack: { status: 'ok', message: 'Configured' },
      wireguard: { status: 'ok', message: 'Interface active' },
    })

    render(
      <MemoryRouter>
        <DashboardOverview stats={mockStats} />
      </MemoryRouter>
    )

    expect(adminAPI.getHealth).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument()
      expect(screen.getByText('Paystack')).toBeInTheDocument()
      expect(screen.getByText('WireGuard')).toBeInTheDocument()
    })

    // Real messages from response
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('Configured')).toBeInTheDocument()
    expect(screen.getByText('Interface active')).toBeInTheDocument()

    // Status badges
    const onlineBadges = screen.getAllByText('Online')
    expect(onlineBadges.length).toBeGreaterThanOrEqual(3)

    // All Systems Operational indicator
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument()

    // Fake rows and fake metrics are removed
    expect(screen.queryByText('RouterOS Core Gateway')).not.toBeInTheDocument()
    expect(screen.queryByText(/Latency: 4ms/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Replica lag 0s/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Paystack Payment Webhooks/)).not.toBeInTheDocument()
    expect(screen.queryByText(/99.98% delivery rate/)).not.toBeInTheDocument()
    expect(screen.queryByText('Active Access Gateways')).not.toBeInTheDocument()
  })

  it('renders error status and message when a service check fails', async () => {
    vi.mocked(adminAPI.getHealth).mockResolvedValueOnce({
      postgres: { status: 'ok', message: 'Connected' },
      paystack: { status: 'error', message: 'PAYSTACK_SECRET_KEY is not set' },
      wireguard: { status: 'error', message: 'wg show failed: interface down' },
    })

    render(
      <MemoryRouter>
        <DashboardOverview stats={mockStats} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('PostgreSQL Database')).toBeInTheDocument()
      expect(screen.getByText('Paystack')).toBeInTheDocument()
      expect(screen.getByText('WireGuard')).toBeInTheDocument()
    })

    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('PAYSTACK_SECRET_KEY is not set')).toBeInTheDocument()
    expect(screen.getByText('wg show failed: interface down')).toBeInTheDocument()

    expect(screen.getByText('System Issues Detected')).toBeInTheDocument()
    const errorBadges = screen.getAllByText('Error')
    expect(errorBadges).toHaveLength(2)
  })
})
