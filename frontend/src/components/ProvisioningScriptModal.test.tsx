import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProvisioningScriptModal from './ProvisioningScriptModal'
import { adminAPI } from '../services/api'

// Mock adminAPI
vi.mock('../services/api', () => ({
  adminAPI: {
    getProvisionScript: vi.fn(),
  },
}))

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('ProvisioningScriptModal', () => {
  const mockRouter = {
    id: 'router-123',
    name: 'Mombasa Gateway',
    location: 'Mombasa Port',
  }

  const sampleScript = `/interface wireguard add name=wg-majal listen-port=13231
/interface wireguard peers add interface=wg-majal public-key="testKey" endpoint-address="198.51.100.1"
/ip address add address=10.250.0.2/24 interface=wg-majal`

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ProvisioningScriptModal isOpen={false} onClose={vi.fn()} router={mockRouter} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('fetches and renders script when opened', async () => {
    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      script: sampleScript,
    })

    render(
      <ProvisioningScriptModal isOpen={true} onClose={vi.fn()} router={mockRouter} />
    )

    // Verify router name is in title/header
    expect(screen.getByText(/Mombasa Gateway/i)).toBeInTheDocument()

    // Wait for script to appear
    await waitFor(() => {
      expect(screen.getByText(/interface wireguard add name=wg-majal/i)).toBeInTheDocument()
    })

    // 3-step Winbox instructions are displayed
    expect(screen.getByText(/Step 1: Connect/i)).toBeInTheDocument()
    expect(screen.getByText(/Step 2: Terminal/i)).toBeInTheDocument()
    expect(screen.getByText(/Step 3: Paste & Run/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Winbox/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Terminal/i).length).toBeGreaterThan(0)
  })

  it('copies script to clipboard and updates button state on click', async () => {
    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      data: { script: sampleScript },
    })

    render(
      <ProvisioningScriptModal isOpen={true} onClose={vi.fn()} router={mockRouter} />
    )

    await waitFor(() => {
      expect(screen.getByText(/interface wireguard add name=wg-majal/i)).toBeInTheDocument()
    })

    const copyButtons = screen.getAllByRole('button', { name: /copy/i })
    fireEvent.click(copyButtons[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(sampleScript)

    // Button updates state to Copied
    await waitFor(() => {
      expect(screen.getAllByText(/copied/i).length).toBeGreaterThan(0)
    })
  })

  it('displays error and allows retry when fetch fails', async () => {
    vi.mocked(adminAPI.getProvisionScript).mockRejectedValueOnce(new Error('Network error'))

    render(
      <ProvisioningScriptModal isOpen={true} onClose={vi.fn()} router={mockRouter} />
    )

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })

    // Retry button exists
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    expect(retryBtn).toBeInTheDocument()

    // Click retry
    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      script: sampleScript,
    })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(screen.getByText(/interface wireguard add name=wg-majal/i)).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    vi.mocked(adminAPI.getProvisionScript).mockResolvedValueOnce({
      success: true,
      script: sampleScript,
    })

    const onClose = vi.fn()
    render(
      <ProvisioningScriptModal isOpen={true} onClose={onClose} router={mockRouter} />
    )

    await waitFor(() => {
      expect(screen.getByText(/interface wireguard add name=wg-majal/i)).toBeInTheDocument()
    })

    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalled()
  })
})
