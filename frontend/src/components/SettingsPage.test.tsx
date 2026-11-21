import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import SettingsPage from './SettingsPage'

describe('SettingsPage Component', () => {
  it('renders General tab fields as read-only without Save buttons', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    // General tab is active by default
    const businessNameInput = screen.getByLabelText(/business \/ system name/i)
    expect(businessNameInput).toHaveAttribute('readOnly')

    const companyNameInput = screen.getByLabelText(/company name/i)
    expect(companyNameInput).toHaveAttribute('readOnly')

    const supportEmailInput = screen.getByLabelText(/support email/i)
    expect(supportEmailInput).toHaveAttribute('readOnly')

    // No Save / Save Changes button
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('renders Paystack tab as read-only with masked secret key and no Save button', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    // Switch to Paystack tab
    const paystackTab = screen.getByRole('button', { name: /paystack/i })
    fireEvent.click(paystackTab)

    const publicKeyInput = screen.getByLabelText(/public key/i)
    expect(publicKeyInput).toHaveAttribute('readOnly')

    const secretKeyInput = screen.getByLabelText(/secret key/i)
    expect(secretKeyInput).toHaveAttribute('readOnly')
    // Secret key is masked
    expect(secretKeyInput).toHaveValue('••••••••••••••••••••••••••••••••')

    const webhookInput = screen.getByLabelText(/webhook url/i)
    expect(webhookInput).toHaveAttribute('readOnly')

    // No Save Paystack button
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('renders Router tab as a navigational card linking to /admin/routers with no form or Test Connection button', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    // Switch to Router tab
    const routerTab = screen.getByRole('button', { name: /router/i })
    fireEvent.click(routerTab)

    // Navigational card with link to /admin/routers
    const navLink = screen.getByRole('link', { name: /routers/i })
    expect(navLink).toHaveAttribute('href', '/admin/routers')

    // Old form inputs must be gone
    expect(screen.queryByLabelText(/router ip address/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/api port/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()

    // Test Connection button must be removed
    expect(screen.queryByRole('button', { name: /test connection/i })).not.toBeInTheDocument()

    // No Save button
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('does not render Security or Database tab entries or panels', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /security/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /database/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/security settings coming soon/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/database management coming soon/i)).not.toBeInTheDocument()
  })
})
