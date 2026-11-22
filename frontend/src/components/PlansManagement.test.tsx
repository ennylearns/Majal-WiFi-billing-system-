import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PlansManagement, { PlanModal } from './PlansManagement'
import { adminAPI } from '../services/api'

vi.mock('../services/api', () => ({
  adminAPI: {
    getPlans: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    deletePlan: vi.fn(),
    getRouters: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PlansManagement Component and PlanModal', () => {
  const mockRouters = [
    {
      id: 'router-1',
      name: 'Nairobi Main',
      location: 'HQ Server Room',
      host: '10.250.0.2',
      port: 8728,
      username: 'router_api_1',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'router-2',
      name: 'Mombasa Branch',
      location: 'Branch 2',
      host: '10.250.0.3',
      port: 8728,
      username: 'router_api_2',
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]

  const mockPlans = [
    {
      id: 'plan-1',
      name: 'Daily Pass',
      description: 'Standard daily access',
      price: 100,
      duration: 24,
      dataLimit: '10GB',
      speedLimit: '10Mbps',
      isActive: true,
      routerId: 'router-1',
      router: {
        id: 'router-1',
        name: 'Nairobi Main',
        location: 'HQ Server Room',
      },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminAPI.getPlans).mockResolvedValue({
      success: true,
      data: mockPlans,
    })
    vi.mocked(adminAPI.getRouters).mockResolvedValue({
      success: true,
      data: mockRouters,
    })
  })

  it('Plan modal fetches the router list via adminAPI.getRouters() on mount and disables submit button while loading', async () => {
    let resolveRouters: (value: any) => void
    const routersPromise = new Promise((resolve) => {
      resolveRouters = resolve
    })
    vi.mocked(adminAPI.getRouters).mockReturnValueOnce(routersPromise as any)

    render(<PlansManagement />)

    await waitFor(() => {
      expect(screen.getByText('Daily Pass')).toBeInTheDocument()
    })

    const addPlanBtn = screen.getByRole('button', { name: /add plan/i })
    fireEvent.click(addPlanBtn)

    expect(adminAPI.getRouters).toHaveBeenCalledTimes(1)

    const submitBtn = screen.getByRole('button', { name: /save plan/i })
    expect(submitBtn).toBeDisabled()

    resolveRouters!({
      success: true,
      data: mockRouters,
    })

    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled()
    })
  })

  it('renders required Router select field with options labelled "{name} — {location}" and no Advanced Settings', async () => {
    render(<PlansManagement />)

    await waitFor(() => {
      expect(screen.getByText('Daily Pass')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add plan/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/^router$/i)).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/^router$/i) as HTMLSelectElement
    expect(select).toBeRequired()

    expect(screen.getByText('Nairobi Main — HQ Server Room')).toBeInTheDocument()
    expect(screen.getByText('Mombasa Branch — Branch 2')).toBeInTheDocument()

    expect(screen.queryByText(/advanced settings/i)).not.toBeInTheDocument()
  })

  it('sends routerId in create payload and requires router to be selected', async () => {
    vi.mocked(adminAPI.createPlan).mockResolvedValueOnce({
      success: true,
      data: { ...mockPlans[0], id: 'plan-new' },
    })

    render(<PlansManagement />)

    await waitFor(() => {
      expect(screen.getByText('Daily Pass')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /add plan/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/^router$/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText(/e\.g\., Premium 24 Hours/i), {
      target: { value: 'New Test Plan' },
    })
    fireEvent.change(screen.getByPlaceholderText('100'), {
      target: { value: '250' },
    })
    fireEvent.change(screen.getByPlaceholderText('24'), {
      target: { value: '48' },
    })
    fireEvent.change(screen.getByPlaceholderText('10GB'), {
      target: { value: '50GB' },
    })
    fireEvent.change(screen.getByPlaceholderText('20Mbps'), {
      target: { value: '50Mbps' },
    })

    const select = screen.getByLabelText(/^router$/i) as HTMLSelectElement
    expect(select.value).toBe('')

    fireEvent.change(select, { target: { value: 'router-2' } })
    expect(select.value).toBe('router-2')

    fireEvent.click(screen.getByRole('button', { name: /save plan/i }))

    await waitFor(() => {
      expect(adminAPI.createPlan).toHaveBeenCalledWith({
        name: 'New Test Plan',
        description: '',
        price: 250,
        duration: 48,
        dataLimit: '50GB',
        speedLimit: '50Mbps',
        routerId: 'router-2',
      })
    })
  })

  it('pre-selects plan current router when opened in edit modal and sends updated routerId on update', async () => {
    vi.mocked(adminAPI.updatePlan).mockResolvedValueOnce({
      success: true,
      data: mockPlans[0],
    })

    render(<PlansManagement />)

    await waitFor(() => {
      expect(screen.getByText('Daily Pass')).toBeInTheDocument()
    })

    const editBtn = screen.getByTitle('Edit plan')
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /edit internet plan/i })).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/^router$/i) as HTMLSelectElement
    expect(select.value).toBe('router-1')

    fireEvent.change(select, { target: { value: 'router-2' } })
    fireEvent.click(screen.getByRole('button', { name: /update plan/i }))

    await waitFor(() => {
      expect(adminAPI.updatePlan).toHaveBeenCalledWith('plan-1', {
        name: 'Daily Pass',
        description: 'Standard daily access',
        price: 100,
        duration: 24,
        dataLimit: '10GB',
        speedLimit: '10Mbps',
        routerId: 'router-2',
      })
    })
  })

  it('PlanModal can be rendered standalone and pre-selects current router', async () => {
    const handleClose = vi.fn()
    const handleSuccess = vi.fn()

    render(
      <PlanModal
        isOpen={true}
        plan={mockPlans[0]}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/^router$/i)).toBeInTheDocument()
    })

    const select = screen.getByLabelText(/^router$/i) as HTMLSelectElement
    expect(select.value).toBe('router-1')
  })
})
