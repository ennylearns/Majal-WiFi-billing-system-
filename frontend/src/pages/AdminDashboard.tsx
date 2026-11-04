import React, { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { adminAPI } from '../services/api'
import { formatCurrency } from '../utils/formatters'
import toast from 'react-hot-toast'
import type { DashboardStats } from '../types'

import DashboardOverview from '../components/DashboardOverview'
import UsersManagement from '../components/UsersManagement'
import PlansManagement from '../components/PlansManagement'
import SessionsManagement from '../components/SessionsManagement'
import PaymentsManagement from '../components/PaymentsManagement'
import SettingsPage from '../components/SettingsPage'
import RoutersManagement from '../components/RoutersManagement'

const AdminDashboard: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      const response = await adminAPI.getDashboardStats()
      if (response.success && response.data) {
        setStats(response.data)
      }
    } catch (error) {
      toast.error('Failed to load dashboard stats')
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { name: 'Users', href: '/admin/users', icon: 'group' },
    { name: 'Plans', href: '/admin/plans', icon: 'sell' },
    { name: 'Sessions', href: '/admin/sessions', icon: 'wifi_tethering' },
    { name: 'Payments', href: '/admin/payments', icon: 'payments' },
    { name: 'Routers', href: '/admin/routers', icon: 'router' },
    { name: 'Settings', href: '/admin/settings', icon: 'settings' },
  ]

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
    toast.success('Logged out successfully')
  }

  const handleRefresh = () => {
    fetchDashboardStats(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  const displayName = user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : 'Root Admin'
  const displayRole = user?.role ? (user.role === 'ADMIN' ? 'NOC-Operator' : user.role) : 'NOC-Operator'

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Persistent Sidebar (fixed 240px) */}
      <aside className={`fixed left-0 top-0 h-full w-[240px] bg-surface-card border-r border-border-subtle z-50 flex flex-col justify-between transition-transform duration-200 select-none ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col">
          {/* Brand block (top, 56px) */}
          <div className="h-14 px-4 border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded bg-[#0045A9] text-white font-bold text-xs flex items-center justify-center">
                M
              </div>
              <span className="font-semibold text-sm text-text-primary tracking-tight truncate">Majal ISP</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide bg-surface-dim text-text-muted">Admin</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1 text-text-muted hover:text-text-primary rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* User mini-profile block */}
          <div className="p-3 border-b border-border-subtle">
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-surface-canvas border border-border-subtle">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary text-white font-semibold text-xs flex items-center justify-center">
                  {(user?.firstName || 'R')[0]}
                </div>
                <span className="w-2 h-2 bg-emerald-500 ring-2 ring-white absolute bottom-0 right-0 rounded-full"></span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-text-primary truncate leading-tight">{displayName}</span>
                <span className="text-[11px] font-mono text-text-muted truncate">{displayRole}</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-0.5 py-3 px-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/admin' && location.pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-light text-[#0045A9] border-l-2 border-[#0045A9]'
                      : 'text-text-muted hover:bg-surface-canvas hover:text-text-primary'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer / Subtle Sign Out */}
        <div className="p-3 border-t border-border-subtle">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-text-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors text-xs font-medium"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="ml-0 lg:ml-[240px]">
        {/* Top bar */}
        <div className="bg-surface-card/80 backdrop-blur-sm border-b border-border-subtle sticky top-0 z-40">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-text-muted hover:text-text-primary hover:bg-surface-dim rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">menu</span>
              </button>
              
              <div className="hidden md:flex items-center space-x-4">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Search anything..."
                    className="pl-9 pr-4 py-1.5 bg-surface-canvas border border-border-subtle rounded-md text-xs text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-primary focus:bg-surface-card transition-all w-64"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {stats && (
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="flex items-center bg-surface-canvas px-3 py-1.5 rounded-md border border-border-subtle text-xs">
                    <span className="text-text-muted mr-1.5">Today:</span>
                    <span className="font-semibold font-mono text-text-primary">{formatCurrency(stats.todayRevenue)}</span>
                  </div>
                  <div className="flex items-center bg-surface-canvas px-3 py-1.5 rounded-md border border-border-subtle text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                    <span className="font-semibold font-mono text-text-primary mr-1">{stats.activeSessions}</span>
                    <span className="text-text-muted">active</span>
                  </div>
                </div>
              )}
              
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-dim rounded-md transition-colors disabled:opacity-50"
                title="Refresh data"
              >
                <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>
              </button>
              
              <button className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-dim rounded-md transition-colors relative" title="Notifications">
                <span className="material-symbols-outlined text-[18px]">notifications</span>
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-status-danger rounded-full"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="min-h-[calc(100vh-3.5rem)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Routes>
              <Route path="/" element={<DashboardOverview stats={stats} onRefresh={handleRefresh} />} />
              <Route path="/users" element={<UsersManagement />} />
              <Route path="/plans" element={<PlansManagement />} />
              <Route path="/sessions" element={<SessionsManagement />} />
              <Route path="/payments" element={<PaymentsManagement />} />
              <Route path="/routers" element={<RoutersManagement />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
