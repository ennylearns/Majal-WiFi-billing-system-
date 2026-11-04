import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CustomerPortal from './CustomerPortal'
import { publicAPI } from '../services/api'

vi.mock('../services/api', () => ({
  publicAPI: {
    getRouters: vi.fn(),
    getPlans: vi.fn(),
    makePayment: vi.fn(),
    getPaymentStatus: vi.fn(),
    connect: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockRouters = [
  {
    id: 'router-1',
    name: 'Westlands Hub #02',
    location: 'Westlands Hub #02',
    ipAddress: '192.168.88.1',
    isActive: true,
  },
  {
    id: 'router-2',
    name: 'Kilimani Center',
    location: 'Kilimani Center',
    ipAddress: '192.168.88.2',
    isActive: true,
  },
]

const mockPlans = [
  {
    id: 'plan-1',
    name: '1 Hour Pass',
    price: 50,
    duration: 1,
    speedLimit: '15 Mbps',
    dataLimit: 'Unlimited',
    routerId: 'router-1',
    router: mockRouters[0],
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'plan-2',
    name: '24 Hours Unlimited',
    price: 150,
    duration: 24,
    speedLimit: '25 Mbps',
    dataLimit: 'Unlimited',
    routerId: 'router-1',
    router: mockRouters[0],
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
]

describe('CustomerPortal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicAPI.getRouters).mockResolvedValue({
      success: true,
      data: mockRouters,
    })
    vi.mocked(publicAPI.getPlans).mockResolvedValue({
      success: true,
      data: mockPlans,
    })
  })

  it('renders design system sticky header with brand logo and customer hotspot label', async () => {
    render(
      <MemoryRouter initialEntries={['/?routerId=router-1']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Customer Hotspot/i)).toBeInTheDocument()
    })

    expect(screen.getAllByText(/Majal/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/ISP/i).length).toBeGreaterThan(0)
  })

  it('renders plan selection cards and applies selected ring state on selection', async () => {
    render(
      <MemoryRouter initialEntries={['/?routerId=router-1']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('1 Hour Pass')).toBeInTheDocument()
      expect(screen.getByText('24 Hours Unlimited')).toBeInTheDocument()
    })

    const card = screen.getByText('1 Hour Pass').closest('.cursor-pointer')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('rounded-card')
    expect(card).toHaveClass('shadow-card')

    // Click to select
    fireEvent.click(card!)
    expect(card).toHaveClass('border-primary')
    expect(card).toHaveClass('ring-2')
  })

  it('toggles location selection drawer when change button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/?routerId=router-1']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('Westlands Hub #02').length).toBeGreaterThan(0)
    })

    const changeBtn = screen.getByRole('button', { name: /change/i })
    fireEvent.click(changeBtn)

    await waitFor(() => {
      expect(screen.getByText(/Select Access Point/i)).toBeInTheDocument()
      expect(screen.getAllByText('Kilimani Center').length).toBeGreaterThan(0)
    })
  })

  it('renders checkout modal when payment is triggered', async () => {
    vi.mocked(publicAPI.makePayment).mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Pay/i }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Pay/i })[0])

    await waitFor(() => {
      expect(screen.getByText(/Opening Paystack Checkout/i)).toBeInTheDocument()
    })

    const modal = screen.getByText(/Opening Paystack Checkout/i).closest('.rounded-card')
    expect(modal).toHaveClass('rounded-card')
    expect(modal).toHaveClass('shadow-card')
  })
})
