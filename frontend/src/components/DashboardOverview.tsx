import React, { useState, useEffect } from 'react'
import { formatCurrency } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'
import { adminAPI } from '../services/api'
import type { DashboardStats, Payment, HealthCheckResponse } from '../types'

interface DashboardOverviewProps {
  stats: DashboardStats | null
  onRefresh?: () => void
}

// ── Status badge ──────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral'

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-status-success-bg border-status-success-border text-status-success',
  warning: 'bg-status-warning-bg border-status-warning-border text-status-warning',
  danger:  'bg-status-danger-bg  border-status-danger-border  text-status-danger',
  neutral: 'bg-status-neutral-bg border-status-neutral-border text-status-neutral',
}

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger:  'bg-status-danger',
  neutral: 'bg-status-neutral',
}

function StatusBadge({ variant, label }: { variant: BadgeVariant; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge border micro-label ${BADGE_CLASSES[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_CLASSES[variant]}`} />
      {label}
    </span>
  )
}

function paymentVariant(status: Payment['status']): BadgeVariant {
  if (status === 'COMPLETED') return 'success'
  if (status === 'PENDING')   return 'warning'
  if (status === 'FAILED')    return 'danger'
  return 'neutral'
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return iso
  }
}

// ── Main component ────────────────────────────────────────────────────────────
const DashboardOverview: React.FC<DashboardOverviewProps> = ({ stats, onRefresh }) => {
  const navigate = useNavigate()

  // Recent payments — live data
  const [payments, setPayments]             = useState<Payment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)

  // Infrastructure health — live data
  const [health, setHealth]                 = useState<HealthCheckResponse | null>(null)
  const [healthLoading, setHealthLoading]   = useState(true)

  const fetchHealth = () => {
    if (typeof adminAPI.getHealth !== 'function') {
      setHealthLoading(false)
      return
    }
    setHealthLoading(true)
    adminAPI
      .getHealth()
      .then(res => {
        setHealth(res)
      })
      .catch(() => {
        setHealth({
          postgres: { status: 'error', message: 'Failed to fetch status' },
          paystack: { status: 'error', message: 'Failed to fetch status' },
          wireguard: { status: 'error', message: 'Failed to fetch status' }
        })
      })
      .finally(() => setHealthLoading(false))
  }

  useEffect(() => {
    fetchHealth()
  }, [])

  useEffect(() => {
    adminAPI
      .getPayments({ limit: 5, page: 1 })
      .then(res => {
        if (res.success && res.data?.payments) setPayments(res.data.payments)
        else if (res.success && (res.data as any)?.data) setPayments((res.data as any).data as Payment[])
      })
      .catch(() => {/* silent — table stays empty */})
      .finally(() => setPaymentsLoading(false))
  }, [])

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-card rounded-card border border-border-subtle shadow-card p-5 animate-pulse">
              <div className="h-3 bg-surface-dim rounded w-1/2 mb-4" />
              <div className="h-8 bg-surface-dim rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Stat cards data ────────────────────────────────────────────────────────
  const statCards = [
    {
      title:    'Total Users',
      value:    stats.totalUsers.toLocaleString(),
      icon:     'group',
      sub:      '+12% this week',
      subIcon:  'arrow_upward',
      subClass: 'text-status-success',
    },
    {
      title:    'Total Revenue',
      value:    formatCurrency(stats.totalRevenue),
      icon:     'payments',
      sub:      '+8% vs last month',
      subIcon:  'arrow_upward',
      subClass: 'text-status-success',
    },
    {
      title:    'Active Sessions',
      value:    stats.activeSessions.toLocaleString(),
      icon:     'wifi_tethering',
      sub:      stats.activeSessions > 0 ? 'Live across access points' : 'No active sessions',
      subIcon:  null,
      subClass: 'text-text-muted',
    },
    {
      title:    "Today's Revenue",
      value:    formatCurrency(stats.todayRevenue),
      icon:     'trending_up',
      sub:      'Today',
      subIcon:  null,
      subClass: 'text-text-muted',
    },
  ]

  return (
    <div className="flex flex-col gap-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Dashboard Overview</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Hotspot operations, RADIUS session accounting, and gateway throughput.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded border border-border-subtle bg-surface-card text-xs font-medium text-text-primary hover:bg-surface-canvas transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px] text-text-muted">file_download</span>
            Export Log
          </button>
          <button
            onClick={() => navigate('/admin/users')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded bg-[#0045A9] text-white text-xs font-medium hover:bg-[#00388a] transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Issue Voucher
          </button>
        </div>
      </div>

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="group bg-surface-card rounded-card border border-border-subtle shadow-card p-5 flex flex-col justify-between
                       hover:border-border-strong hover:shadow-card-hover transition-all duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="micro-label text-text-secondary">{card.title}</span>
              <span className="material-symbols-outlined text-[18px] text-text-placeholder">{card.icon}</span>
            </div>
            <div className="mt-3">
              <div className="text-[2rem] font-bold tabular-nums text-text-primary leading-none">{card.value}</div>
              <div className={`flex items-center gap-0.5 mt-2.5 text-xs ${card.subClass}`}>
                {card.subIcon && (
                  <span className="material-symbols-outlined text-[14px]">{card.subIcon}</span>
                )}
                {!card.subIcon && card.title === 'Active Sessions' && (
                  <span className="w-2 h-2 rounded-full bg-status-success mr-1" />
                )}
                <span>{card.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column middle section ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Quick Actions */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Quick Actions</h2>
            <span className="text-[11px] font-mono text-text-muted">Shortcuts</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {[
              {
                href: '/admin/users',
                icon: 'manage_accounts',
                label: 'Manage Customers',
                desc: 'Review user accounts, active subscriptions, and bind device MAC addresses.',
              },
              {
                href: '/admin/plans',
                icon: 'add_card',
                label: 'Create New Plan',
                desc: 'Configure bandwidth speed limits, session durations, and KES tariffs.',
              },
              {
                href: '/admin/routers',
                icon: 'router',
                label: 'MikroTik Fleet',
                desc: 'Deploy ROS configuration scripts, monitor CAPsMAN, and check link health.',
              },
            ].map(action => (
              <button
                key={action.href}
                onClick={() => navigate(action.href)}
                className="group bg-surface-card p-3.5 rounded-card border border-border-subtle hover:border-[#0045A9] transition-colors flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded border border-border-subtle bg-surface-canvas flex items-center justify-center text-text-muted group-hover:text-[#0045A9] transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-text-primary group-hover:text-[#0045A9] transition-colors">{action.label}</span>
                    <span className="text-[11px] text-text-muted truncate">{action.desc}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[16px] text-text-placeholder group-hover:text-[#0045A9] group-hover:translate-x-0.5 transition-all ml-2 flex-shrink-0">
                  chevron_right
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Infrastructure Status */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Infrastructure Status</h2>
            <button
              onClick={() => {
                fetchHealth()
                onRefresh?.()
              }}
              className={`text-[11px] font-mono font-medium hover:underline ${
                health &&
                health.postgres.status === 'ok' &&
                health.paystack.status === 'ok' &&
                health.wireguard.status === 'ok'
                  ? 'text-status-success'
                  : health
                  ? 'text-status-danger'
                  : 'text-text-muted'
              }`}
            >
              {healthLoading && !health
                ? 'Checking Systems…'
                : health &&
                  health.postgres.status === 'ok' &&
                  health.paystack.status === 'ok' &&
                  health.wireguard.status === 'ok'
                ? 'All Systems Operational'
                : 'System Issues Detected'}
            </button>
          </div>
          <div className="bg-surface-card rounded-card border border-border-subtle divide-y divide-border-subtle">
            {healthLoading && !health ? (
              <div className="p-4 text-xs text-text-muted text-center">Loading infrastructure status…</div>
            ) : (
              ([
                {
                  label: 'PostgreSQL Database',
                  status: health?.postgres.status === 'ok' ? 'Online' : 'Error',
                  detail: health?.postgres.message || (health?.postgres.status === 'ok' ? 'Connected' : 'Unavailable'),
                  variant: (health?.postgres.status === 'ok' ? 'success' : 'danger') as BadgeVariant
                },
                {
                  label: 'Paystack',
                  status: health?.paystack.status === 'ok' ? 'Online' : 'Error',
                  detail: health?.paystack.message || (health?.paystack.status === 'ok' ? 'Configured' : 'Missing configuration'),
                  variant: (health?.paystack.status === 'ok' ? 'success' : 'danger') as BadgeVariant
                },
                {
                  label: 'WireGuard',
                  status: health?.wireguard.status === 'ok' ? 'Online' : 'Error',
                  detail: health?.wireguard.message || (health?.wireguard.status === 'ok' ? 'Interface active' : 'Unavailable'),
                  variant: (health?.wireguard.status === 'ok' ? 'success' : 'danger') as BadgeVariant
                }
              ] as Array<{ label: string; detail: string; status: string; variant: BadgeVariant }>).map(svc => (
                <div key={svc.label} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_CLASSES[svc.variant]}`} />
                    <div>
                      <div className="text-xs font-semibold text-text-primary">{svc.label}</div>
                      <div className="text-[11px] font-mono text-text-muted">{svc.detail}</div>
                    </div>
                  </div>
                  <StatusBadge variant={svc.variant} label={svc.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Transactions table ─────────────────────────────────────── */}
      <div className="bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden">

        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Recent Transactions</h2>
            <p className="text-[11px] text-text-muted">Real-time captive portal checkout events &amp; automated session provisioning.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border-subtle text-xs font-medium text-text-primary hover:bg-surface-canvas transition-colors" type="button">
              <span className="material-symbols-outlined text-[14px] text-text-muted">tune</span>
              Filter
            </button>
            <button
              onClick={() => navigate('/admin/payments')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-canvas border border-border-subtle text-xs font-medium text-text-primary hover:bg-surface-dim transition-colors"
              type="button"
            >
              View All
              <span className="material-symbols-outlined text-[14px] text-text-muted">north_east</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-canvas border-b border-border-subtle">
                {(
                  ['Identifier / Phone', 'Plan', 'Reference', 'Amount (KES)', 'Timestamp', 'Status'] as const
                ).map((col, ci) => (
                  <th
                    key={col}
                    className={`micro-label h-10 px-4 text-text-secondary ${
                      ci === 3 || ci === 5 ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paymentsLoading && (
                <tr>
                  <td colSpan={6} className="h-12 px-4 text-sm text-text-muted text-center">
                    Loading…
                  </td>
                </tr>
              )}
              {!paymentsLoading && payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="h-12 px-4 text-sm text-text-muted text-center">
                    No recent transactions.
                  </td>
                </tr>
              )}
              {!paymentsLoading && payments.map(p => {
                const identifier = p.user?.phone || p.user?.email || '—'
                const plan       = p.plan?.name  || '—'
                const ref        = p.paymentReference || p.checkoutRequestId || '—'
                const amount     = formatCurrency(p.amount)
                const ts         = formatTimestamp(p.createdAt)
                const variant    = paymentVariant(p.status)
                const label      = p.status.charAt(0) + p.status.slice(1).toLowerCase()

                return (
                  <tr key={p.id} className="border-b border-border-subtle last:border-0 hover:bg-surface-canvas transition-colors">
                    <td className="h-12 px-4 text-sm text-text-primary whitespace-nowrap tabular-nums font-mono">
                      {identifier}
                    </td>
                    <td className="h-12 px-4 text-sm text-text-primary whitespace-nowrap">{plan}</td>
                    <td className="h-12 px-4 text-[11px] text-text-muted whitespace-nowrap tabular-nums font-mono">{ref}</td>
                    <td className="h-12 px-4 text-sm text-text-primary whitespace-nowrap text-right tabular-nums font-mono font-semibold">
                      {amount}
                    </td>
                    <td className="h-12 px-4 text-[11px] text-text-muted whitespace-nowrap tabular-nums font-mono">{ts}</td>
                    <td className="h-12 px-4 whitespace-nowrap text-right">
                      <StatusBadge variant={variant} label={label} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-surface-card border-t border-border-subtle flex items-center justify-between text-xs text-text-muted">
          <span>Showing {payments.length} recent transaction{payments.length !== 1 ? 's' : ''}</span>
          <button
            onClick={() => navigate('/admin/payments')}
            className="px-2.5 py-1 rounded border border-border-subtle bg-surface-card text-text-primary hover:bg-surface-canvas text-xs font-medium"
            type="button"
          >
            View all payments
          </button>
        </div>
      </div>

    </div>
  )
}

export default DashboardOverview
