import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AdminLogin from './AdminLogin'

const mockLogin = vi.fn()
let mockIsAuthenticated = false

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: mockIsAuthenticated,
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AdminLogin Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false
  })

  it('renders design system styled layout, card, logo block, and inputs', () => {
    const { container } = render(
      <MemoryRouter>
        <AdminLogin />
      </MemoryRouter>
    )

    // Page layout
    const layout = container.firstChild as HTMLElement
    expect(layout.className).toContain('bg-surface-canvas')
    expect(layout.className).toContain('flex')
    expect(layout.className).toContain('items-center')
    expect(layout.className).toContain('justify-center')
    expect(layout.className).toContain('min-h-screen')
    expect(layout.className).toContain('p-4')

    // Login card
    const card = container.querySelector('.bg-surface-card')
    expect(card).toBeInTheDocument()
    expect(card?.className).toContain('rounded-card')
    expect(card?.className).toContain('border')
    expect(card?.className).toContain('border-border-subtle')
    expect(card?.className).toContain('shadow-card')
    expect(card?.className).toContain('w-full')
    expect(card?.className).toContain('max-w-[400px]')
    expect(card?.className).toContain('p-8')

    // Logo block
    const logoBlock = container.querySelector('.w-9.h-9.rounded-lg.bg-primary')
    expect(logoBlock).toBeInTheDocument()
    const routerIcon = logoBlock?.querySelector('.material-symbols-outlined')
    expect(routerIcon).toHaveTextContent('router')
    expect(routerIcon).toHaveStyle({ fontVariationSettings: "'FILL' 1" })

    // Brand name "Majal" + "ISP"
    expect(screen.getByText('Majal')).toHaveClass('text-[20px]', 'font-semibold', 'text-text-primary')
    expect(screen.getByText('ISP')).toHaveClass('text-[20px]', 'font-semibold', 'text-primary')

    // Subtitle
    expect(screen.getByText(/sign in to manage your wifi billing system/i)).toHaveClass(
      'text-sm',
      'text-text-muted',
      'text-center'
    )

    // Form inputs
    const emailInput = screen.getByLabelText(/email address/i)
    expect(emailInput.className).toContain('h-10')
    expect(emailInput.className).toContain('w-full')
    expect(emailInput.className).toContain('rounded-control')
    expect(emailInput.className).toContain('border')
    expect(emailInput.className).toContain('border-border-subtle')
    expect(emailInput.className).toContain('text-sm')
    expect(emailInput.className).toContain('text-text-primary')

    // Primary button
    const submitBtn = screen.getByRole('button', { name: /sign in/i })
    expect(submitBtn.className).toContain('w-full')
    expect(submitBtn.className).toContain('h-10')
    expect(submitBtn.className).toContain('bg-primary')
    expect(submitBtn.className).toContain('hover:bg-primary-hover')
    expect(submitBtn.className).toContain('active:bg-primary-active')
    expect(submitBtn.className).toContain('text-white')
    expect(submitBtn.className).toContain('font-medium')
    expect(submitBtn.className).toContain('text-sm')
    expect(submitBtn.className).toContain('rounded-control')
  })

  it('toggles password visibility with Material Symbol icon', () => {
    render(
      <MemoryRouter>
        <AdminLogin />
      </MemoryRouter>
    )

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtn = screen.getByLabelText(/toggle visibility/i)
    expect(toggleBtn).toHaveTextContent('visibility')

    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('text')
    expect(toggleBtn).toHaveTextContent('visibility_off')

    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('password')
    expect(toggleBtn).toHaveTextContent('visibility')
  })

  it('displays error message and error border styling on failed login', async () => {
    mockLogin.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' })

    render(
      <MemoryRouter>
        <AdminLogin />
      </MemoryRouter>
    )

    const emailInput = screen.getByLabelText(/email address/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitBtn = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'wrong@admin.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      const errorMsg = screen.getByText('Invalid credentials')
      expect(errorMsg).toBeInTheDocument()
      expect(errorMsg).toHaveClass('text-status-danger', 'text-sm')
      expect(emailInput.className).toContain('border-status-danger')
      expect(passwordInput.className).toContain('border-status-danger')
    })
  })
})
