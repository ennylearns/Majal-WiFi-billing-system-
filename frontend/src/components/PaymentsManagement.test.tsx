import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PaymentsManagement from './PaymentsManagement'
import { adminAPI } from '../services/api'

vi.mock('../services/api', () => ({
  adminAPI: {
    getPayments: vi.fn(),
  },
}))

describe('PaymentsManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders KPI cards from response totals and does not show Export Report button', async () => {
    vi.mocked(adminAPI.getPayments).mockResolvedValueOnce({
      success: true,
      data: {
        payments: [
          {
            id: 'pay-1',
            userId: 'usr-1',
            planId: 'plan-1',
            amount: 500,
            status: 'COMPLETED',
            paymentMethod: 'PAYSTACK',
            createdAt: '2026-02-01T10:00:00Z',
            updatedAt: '2026-02-01T10:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
        totals: {
          revenue: 15000,
          count: 25,
          pending: 3,
          failed: 2,
        },
      },
    })

    render(
      <MemoryRouter>
        <PaymentsManagement />
      </MemoryRouter>
    )

    expect(adminAPI.getPayments).toHaveBeenCalledTimes(1)

    // Verify "Export Report" button is removed
    expect(screen.queryByText(/Export Report/i)).not.toBeInTheDocument()

    // Verify KPI cards reflect the aggregate totals (15000 revenue, 25 count, 3 pending, 2 failed)
    // rather than reducing over the 1 paginated payment
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    // Check revenue formatted currency
    expect(screen.getByText(/15,000/)).toBeInTheDocument()
  })
})
