import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UsersManagement from './UsersManagement'
import { adminAPI } from '../services/api'

vi.mock('../services/api', () => ({
  adminAPI: {
    getUsers: vi.fn(),
    getUserSessions: vi.fn(),
    terminateUserSessions: vi.fn(),
    toggleUserActive: vi.fn(),
    getUserMacBindings: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('UsersManagement Component', () => {
  const mockUsers = [
    {
      id: 'user-1',
      phone: '+254712345678',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: 'CUSTOMER' as const,
      isActive: true,
      createdAt: '2026-01-15T10:00:00Z',
    },
    {
      id: 'user-2',
      phone: '+254798765432',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'CUSTOMER' as const,
      isActive: false,
      createdAt: '2026-02-01T12:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(adminAPI.getUsers).mockResolvedValue({
      success: true,
      data: {
        users: mockUsers,
        pagination: { page: 1, limit: 10, total: 2, pages: 1 },
      },
    })
  })

  it('removes Export Users and Filters buttons', async () => {
    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    expect(screen.queryByText(/Export Users/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^Filters$/i)).not.toBeInTheDocument()
  })

  it('opens action menu on clicking MoreVertical button', async () => {
    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions|more options/i })
    fireEvent.click(actionButtons[0])

    expect(screen.getAllByText(/View Session History/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Terminate Active Sessions/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/Toggle Active\/Inactive|Deactivate User|Activate User/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/View MAC Bindings/i)[0]).toBeInTheDocument()
  })

  it('terminates active sessions on clicking Terminate Active Sessions', async () => {
    vi.mocked(adminAPI.terminateUserSessions).mockResolvedValueOnce({
      success: true,
      data: { terminatedCount: 2, message: '2 active session(s) terminated successfully' },
    })

    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions|more options/i })
    fireEvent.click(actionButtons[0])

    const terminateBtn = screen.getAllByText(/Terminate Active Sessions/i)[0]
    fireEvent.click(terminateBtn)

    await waitFor(() => {
      expect(adminAPI.terminateUserSessions).toHaveBeenCalledWith('user-1')
    })
  })

  it('toggles user active status and updates row without full reload', async () => {
    vi.mocked(adminAPI.toggleUserActive).mockResolvedValueOnce({
      success: true,
      data: {
        isActive: false,
        data: {
          ...mockUsers[0],
          isActive: false,
        },
      },
    })

    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions|more options/i })
    fireEvent.click(actionButtons[0])

    const toggleBtn = screen.getAllByText(/Toggle Active\/Inactive|Deactivate User/i)[0]
    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(adminAPI.toggleUserActive).toHaveBeenCalledWith('user-1')
    })
  })

  it('fetches and displays session history in a modal/panel', async () => {
    vi.mocked(adminAPI.getUserSessions).mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'sess-1',
          userId: 'user-1',
          planId: 'plan-1',
          sessionToken: 'tok-1',
          status: 'ACTIVE',
          startTime: '2026-03-01T10:00:00Z',
          dataUsed: 1024,
          plan: {
            id: 'plan-1',
            name: 'Daily 24h Plan',
            price: 100,
            duration: 24,
            dataLimit: '5GB',
            speedLimit: '10Mbps',
            isActive: true,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions|more options/i })
    fireEvent.click(actionButtons[0])

    const viewSessionsBtn = screen.getAllByText(/View Session History/i)[0]
    fireEvent.click(viewSessionsBtn)

    await waitFor(() => {
      expect(adminAPI.getUserSessions).toHaveBeenCalledWith('user-1')
      expect(screen.getByText('Daily 24h Plan')).toBeInTheDocument()
      expect(screen.getByText(/Duration: 24h/i)).toBeInTheDocument()
    })
  })

  it('fetches and displays MAC bindings in a modal/panel', async () => {
    vi.mocked(adminAPI.getUserMacBindings).mockResolvedValueOnce({
      success: true,
      data: [
        {
          macAddress: '00:11:22:33:44:55',
          lastSeen: '2026-03-01T10:00:00Z',
        },
      ],
    })

    render(
      <MemoryRouter>
        <UsersManagement />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument()
    })

    const actionButtons = screen.getAllByRole('button', { name: /actions|more options/i })
    fireEvent.click(actionButtons[0])

    const viewMacBtn = screen.getAllByText(/View MAC Bindings/i)[0]
    fireEvent.click(viewMacBtn)

    await waitFor(() => {
      expect(adminAPI.getUserMacBindings).toHaveBeenCalledWith('user-1')
      expect(screen.getByText('00:11:22:33:44:55')).toBeInTheDocument()
    })
  })
})
