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
    getTrialStatus: vi.fn(),
    startTrial: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the countdown hook so portal tests are not time-dependent
const mockCountdown = vi.hoisted(() => ({
  display: '09:42',
  remainingSeconds: 582,
  isExpired: false,
  isWarning: false,
}))

vi.mock('../hooks/useTrialCountdown', () => ({
  useTrialCountdown: vi.fn(() => mockCountdown),
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
    vi.mocked(publicAPI.connect).mockResolvedValue({
      success: true,
      data: { message: 'Connected', session: {} },
    })
    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: {
        status: 'ELIGIBLE',
        isEligible: true,
        inCooldown: false,
      },
    })
  })

  it('renders Connect 10 Mins Free button and initiates trial with forwarded MAC address', async () => {
    vi.mocked(publicAPI.startTrial).mockResolvedValue({
      success: true,
      data: {
        message: '10-minute trial activated successfully',
        session: {
          id: 'trial-sess-1',
          sessionToken: 'tok-trial-1',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 600000).toISOString(),
          durationMinutes: 10,
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55&ip=192.168.88.50']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Connect 10 Mins Free/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Connect 10 Mins Free/i }))

    await waitFor(() => {
      expect(publicAPI.startTrial).toHaveBeenCalledWith({
        routerId: 'router-1',
        macAddress: '00:11:22:33:44:55',
        ipAddress: '192.168.88.50',
      })
      expect(screen.getByText(/Internet Activated/i)).toBeInTheDocument()
      expect(screen.getAllByText(/10-Minute Free Trial/i).length).toBeGreaterThan(0)
    })
  })

  it('displays cooldown badge when device has used a trial within the last 24 hours', async () => {
    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: {
        status: 'COOLDOWN',
        isEligible: false,
        inCooldown: true,
        remainingHours: 18,
        remainingMinutes: 30,
        remainingSeconds: 66600,
      },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText(/Available in 18h 30m/i).length).toBeGreaterThan(0)
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

  it('renders identity prompt modal when payment is triggered without contact params', async () => {
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
      expect(screen.getByTestId('identity-prompt-modal')).toBeInTheDocument()
      expect(screen.getByText(/Contact Information/i)).toBeInTheDocument()
    })
  })

  it('skips identity prompt modal when phone and email are present in URL params', async () => {
    vi.mocked(publicAPI.makePayment).mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&phone=0712345678&email=guest@test.com']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Pay/i }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Pay/i })[0])

    await waitFor(() => {
      expect(screen.queryByTestId('identity-prompt-modal')).not.toBeInTheDocument()
      expect(publicAPI.makePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '0712345678',
          email: 'guest@test.com',
        })
      )
      expect(screen.getByText(/Redirecting to Checkout/i)).toBeInTheDocument()
    })
  })

  it('validates that phone and email are non-empty before allowing progression', async () => {
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
      expect(screen.getByTestId('identity-prompt-modal')).toBeInTheDocument()
    })

    // Try submitting without filling inputs
    fireEvent.click(screen.getByRole('button', { name: /Continue to Payment/i }))

    expect(screen.getByText(/Phone number is required/i)).toBeInTheDocument()
    expect(screen.getByText(/Email address is required/i)).toBeInTheDocument()
    expect(publicAPI.makePayment).not.toHaveBeenCalled()
  })

  it('pre-populates phone from URL param if only phone is provided, requiring only email', async () => {
    vi.mocked(publicAPI.makePayment).mockReturnValue(new Promise(() => {}))

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&phone=0712345678']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Pay/i }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Pay/i })[0])

    await waitFor(() => {
      expect(screen.getByTestId('identity-prompt-modal')).toBeInTheDocument()
    })

    const phoneInput = screen.getByLabelText(/Phone Number/i) as HTMLInputElement
    expect(phoneInput.value).toBe('0712345678')

    const emailInput = screen.getByLabelText(/Email Address/i)
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue to Payment/i }))

    await waitFor(() => {
      expect(publicAPI.makePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          phone: '0712345678',
          email: 'user@example.com',
        })
      )
    })
  })

  it('redirects browser to Bachs authorization_url for hosted checkout', async () => {
    const originalLocation = window.location
    const locationMock = { ...originalLocation, href: 'http://localhost:3000/' }
    Object.defineProperty(window, 'location', {
      value: locationMock,
      writable: true,
      configurable: true,
    })

    try {
      vi.mocked(publicAPI.makePayment).mockResolvedValue({
        success: true,
        data: {
          reference: 'chk_live_123',
          access_code: 'chk_live_123',
          authorization_url: 'https://checkout.bachs.io/chk_live_123',
        },
        reference: 'chk_live_123',
        access_code: 'chk_live_123',
      })

      render(
        <MemoryRouter initialEntries={['/?routerId=router-1&phone=0712345678&email=guest@test.com']}>
          <CustomerPortal />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Pay/i }).length).toBeGreaterThan(0)
      })

      fireEvent.click(screen.getAllByRole('button', { name: /Pay/i })[0])

      await waitFor(() => {
        expect(window.location.href).toBe('https://checkout.bachs.io/chk_live_123')
      })
    } finally {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    }
  })

  it('polls payment status directly without redirecting when authorization_url is a Bachs mock URL', async () => {
    vi.mocked(publicAPI.makePayment).mockResolvedValue({
      success: true,
      data: {
        reference: 'chk_mock_123',
        access_code: 'chk_mock_123',
        authorization_url: 'https://checkout.bachs.io/mock/chk_mock_123',
      },
    })
    vi.mocked(publicAPI.getPaymentStatus).mockResolvedValue({
      success: true,
      data: {
        status: 'completed',
        sessionToken: 'tok-mock-1',
      },
    })
    vi.mocked(publicAPI.connect).mockResolvedValue({
      success: true,
      data: {
        message: 'Connected',
        session: { plan: '1 Hour Pass', endTime: new Date(Date.now() + 3600000).toISOString() },
      },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&phone=0712345678&email=guest@test.com']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Pay/i }).length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Pay/i })[0])

    await waitFor(() => {
      expect(publicAPI.getPaymentStatus).toHaveBeenCalledWith('chk_mock_123', {
        phone: '0712345678',
        email: 'guest@test.com',
      })
      expect(screen.getByText(/Internet Activated/i)).toBeInTheDocument()
    })
  })

  it('handles checkout_id return redirect by polling status and connecting', async () => {
    vi.mocked(publicAPI.getPaymentStatus).mockResolvedValue({
      success: true,
      data: {
        status: 'completed',
        sessionToken: 'tok-return-1',
      },
    })
    vi.mocked(publicAPI.connect).mockResolvedValue({
      success: true,
      data: {
        message: 'Connected',
        session: { plan: '1 Hour Pass', endTime: new Date(Date.now() + 3600000).toISOString() },
      },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&checkout_id=chk_return_123']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(publicAPI.getPaymentStatus).toHaveBeenCalledWith('chk_return_123', {
        phone: undefined,
        email: undefined,
      })
      expect(screen.getByText(/Internet Activated/i)).toBeInTheDocument()
    })
  })

  it('handles payment_cancelled return redirect by showing cancelled modal', async () => {
    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&payment_cancelled=true']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Payment Cancelled/i)).toBeInTheDocument()
    })
  })
})

describe('CustomerPortal – Trial Countdown Banner', () => {
  const activeTrialStatus = {
    status: 'ACTIVE' as const,
    isEligible: false,
    inCooldown: false,
    remainingSeconds: 582,
    session: {
      id: 'sess-t',
      sessionToken: 'tok-t',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 582000).toISOString(),
      routerId: 'router-1',
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publicAPI.getRouters).mockResolvedValue({ success: true, data: mockRouters })
    vi.mocked(publicAPI.getPlans).mockResolvedValue({ success: true, data: mockPlans })
    vi.mocked(publicAPI.connect).mockResolvedValue({
      success: true,
      data: { message: 'Connected', session: {} },
    })
    // Reset countdown mock to non-warning state
    Object.assign(mockCountdown, {
      display: '09:42',
      remainingSeconds: 582,
      isExpired: false,
      isWarning: false,
    })
  })

  it('renders sticky countdown banner when trial is active', async () => {
    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: activeTrialStatus,
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('status', { name: /trial countdown/i })).toBeInTheDocument()
      expect(screen.getByTestId('trial-countdown')).toHaveTextContent('09:42')
    })
  })

  it('renders warning styles when fewer than 2 minutes remain', async () => {
    Object.assign(mockCountdown, {
      display: '01:30',
      remainingSeconds: 90,
      isExpired: false,
      isWarning: true,
    })

    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: { ...activeTrialStatus, remainingSeconds: 90 },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      const timer = screen.getByTestId('trial-countdown')
      expect(timer).toHaveTextContent('01:30')
      // Warning pulse class applied
      expect(timer).toHaveClass('animate-pulse')
    })
  })

  it('renders expired banner when trial status is COOLDOWN (no active session)', async () => {
    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: {
        status: 'COOLDOWN',
        isEligible: false,
        inCooldown: true,
        remainingHours: 23,
        remainingMinutes: 0,
        remainingSeconds: 82800,
      },
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/free trial has ended/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /buy a plan/i })).toBeInTheDocument()
    })
  })

  it('countdown banner contains a View Plans button', async () => {
    vi.mocked(publicAPI.getTrialStatus).mockResolvedValue({
      success: true,
      data: activeTrialStatus,
    })

    render(
      <MemoryRouter initialEntries={['/?routerId=router-1&mac=00:11:22:33:44:55']}>
        <CustomerPortal />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view plans/i })).toBeInTheDocument()
    })
  })
})
