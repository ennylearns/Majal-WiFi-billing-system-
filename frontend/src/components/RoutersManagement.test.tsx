import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RoutersManagement from './RoutersManagement'
import { adminAPI } from '../services/api'

vi.mock('../services/api', () => ({
  adminAPI: {
    getRouters: vi.fn(),
    createRouter: vi.fn(),
    updateRouter: vi.fn(),
    deleteRouter: vi.fn(),
    testRouterConnection: vi.fn(),
    getProvisionScript: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('RoutersManagement Component', () => {
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
      isActive: false,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders router list with Setup Script buttons and test connection buttons', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValueOnce({
      success: true,
      data: mockRouters,
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
      expect(screen.getByText('Mombasa Branch')).toBeInTheDocument()
    })

    // Setup script buttons exist for each router row
    const setupScriptButtons = screen.getAllByRole('button', { name: /setup script/i })
    expect(setupScriptButtons).toHaveLength(2)
  })

  it('opens ProvisioningScriptModal when "Setup Script" action button is clicked', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValueOnce({
      success: true,
      data: mockRouters,
    })
    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      script: '/interface wireguard add name=wg-majal',
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
    })

    const setupScriptButtons = screen.getAllByRole('button', { name: /setup script/i })
    fireEvent.click(setupScriptButtons[0])

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Router Provisioning Script/i)).toBeInTheDocument()
    })
  })

  it('Add Router modal only requires Name and Location', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValueOnce({
      success: true,
      data: mockRouters,
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
    })

    const addRouterButtons = screen.getAllByRole('button', { name: /add router/i })
    fireEvent.click(addRouterButtons[0])

    // Modal is opened
    expect(screen.getByRole('heading', { name: /add router/i })).toBeInTheDocument()

    // Name and Location inputs are present and required
    const nameInput = screen.getByLabelText(/router name/i)
    const locationInput = screen.getByLabelText(/location/i)

    expect(nameInput).toBeRequired()
    expect(locationInput).toBeRequired()

    // Host, Username, Password inputs should NOT be required in simplified Add Router mode
    expect(screen.queryByLabelText(/host \/ ip/i)).not.toBeInTheDocument()
  })

  it('auto-opens ProvisioningScriptModal immediately after submitting Add Router form', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValue({
      success: true,
      data: mockRouters,
    })

    const newRouter = {
      id: 'router-3',
      name: 'Kisumu Hub',
      location: 'Kisumu CBD',
      host: '10.250.0.4',
      port: 8728,
      username: 'router_api_3',
      isActive: true,
      createdAt: '2026-01-02',
      updatedAt: '2026-01-02',
    }

    vi.mocked(adminAPI.createRouter).mockResolvedValueOnce({
      success: true,
      data: newRouter,
    })

    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      script: '/interface wireguard add name=wg-majal listen-port=13231',
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
    })

    const addRouterBtn = screen.getAllByRole('button', { name: /add router/i })[0]
    fireEvent.click(addRouterBtn)

    const nameInput = screen.getByLabelText(/router name/i)
    const locationInput = screen.getByLabelText(/location/i)

    fireEvent.change(nameInput, { target: { value: 'Kisumu Hub' } })
    fireEvent.change(locationInput, { target: { value: 'Kisumu CBD' } })

    const modal = screen.getByRole('dialog')
    const submitBtn = within(modal).getByRole('button', { name: /^add router$/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(adminAPI.createRouter).toHaveBeenCalledWith({
        name: 'Kisumu Hub',
        location: 'Kisumu CBD',
        isActive: true,
      })
    })

    // Provisioning script modal should auto-open for the newly created router
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText(/Kisumu Hub/i)).toBeInTheDocument()
    })
  })

  it('displays granular diagnostics badges for Test Connection', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValueOnce({
      success: true,
      data: mockRouters,
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
    })

    const testButtons = screen.getAllByRole('button', { name: /test/i })

    // 1. Online badge
    vi.mocked(adminAPI.testRouterConnection).mockResolvedValueOnce({
      success: true,
      status: 'online',
      message: 'Router connected successfully',
    })
    fireEvent.click(testButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/^online$/i)).toBeInTheDocument()
    })

    // 2. Tunnel offline badge
    vi.mocked(adminAPI.testRouterConnection).mockResolvedValueOnce({
      success: false,
      status: 'tunnel_offline',
      error: 'WireGuard tunnel offline',
    })
    fireEvent.click(testButtons[1])

    await waitFor(() => {
      expect(screen.getByText(/tunnel offline \(pending setup\)/i)).toBeInTheDocument()
    })
  })

  it('displays Auth Error and Unreachable badges for test connection failures', async () => {
    vi.mocked(adminAPI.getRouters).mockResolvedValueOnce({
      success: true,
      data: mockRouters,
    })

    render(<RoutersManagement />)

    await waitFor(() => {
      expect(screen.getByText('Nairobi Main')).toBeInTheDocument()
    })

    const testButtons = screen.getAllByRole('button', { name: /test/i })

    // Auth error
    vi.mocked(adminAPI.testRouterConnection).mockResolvedValueOnce({
      success: false,
      status: 'auth_failed',
      error: 'Invalid credentials',
    })
    fireEvent.click(testButtons[0])

    await waitFor(() => {
      expect(screen.getByText(/auth error/i)).toBeInTheDocument()
    })

    // Unreachable
    vi.mocked(adminAPI.testRouterConnection).mockResolvedValueOnce({
      success: false,
      status: 'unreachable',
      error: 'Host unreachable',
    })
    fireEvent.click(testButtons[1])

    await waitFor(() => {
      expect(screen.getByText(/unreachable/i)).toBeInTheDocument()
    })
  })
})
