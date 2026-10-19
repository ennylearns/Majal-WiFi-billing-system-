import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Edit,
  Trash2,
  X,
  Router as RouterIcon,
  MapPin,
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { Router } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────

type TestResult = { status: 'idle' | 'testing' | 'ok' | 'fail'; message?: string }

type FormData = {
  name: string
  location: string
  host: string
  port: string
  username: string
  password: string
}

const EMPTY_FORM: FormData = {
  name: '',
  location: '',
  host: '',
  port: '8728',
  username: 'admin',
  password: '',
}

// ── Helpers ────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-700 border-red-200'
    }`}
  >
    {isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
    {isActive ? 'Active' : 'Inactive'}
  </span>
)

// ── Component ──────────────────────────────────────────────────────────────

const RoutersManagement: React.FC = () => {
  const [routers, setRouters] = useState<Router[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Router | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Per-row test-connection state
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchRouters = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) setRefreshing(true)
      const res = await adminAPI.getRouters()
      if (res.success && res.data) setRouters(res.data)
    } catch {
      toast.error('Failed to load routers')
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRouters()
  }, [fetchRouters])

  // ── Modal helpers ──────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null)
    setFormData(EMPTY_FORM)
    setShowPassword(false)
    setShowModal(true)
  }

  const openEdit = (router: Router) => {
    setEditing(router)
    setFormData({
      name: router.name,
      location: router.location,
      host: router.host,
      port: router.port.toString(),
      username: router.username,
      password: '', // never pre-fill password
    })
    setShowPassword(false)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
  }

  const field = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(f => ({ ...f, [key]: e.target.value }))

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        name: formData.name,
        location: formData.location,
        host: formData.host,
        port: parseInt(formData.port, 10),
        username: formData.username,
        isActive: true,
        ...(formData.password ? { password: formData.password } : {}),
      }

      if (editing) {
        await adminAPI.updateRouter(editing.id, payload)
        toast.success('Router updated')
      } else {
        await adminAPI.createRouter({ ...payload, password: formData.password })
        toast.success('Router created')
      }

      closeModal()
      fetchRouters()
    } catch {
      toast.error(editing ? 'Failed to update router' : 'Failed to create router')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────

  const handleDelete = async (router: Router) => {
    if (!confirm(`Delete router "${router.name}"? This action cannot be undone.`)) return
    try {
      await adminAPI.deleteRouter(router.id)
      toast.success('Router deleted')
      fetchRouters()
    } catch {
      toast.error('Failed to delete router')
    }
  }

  // ── Test connection ────────────────────────────────────────────────────

  const handleTest = async (router: Router) => {
    setTestResults(r => ({ ...r, [router.id]: { status: 'testing' } }))
    try {
      const res = await adminAPI.testRouterConnection(router.id)
      if (res.success) {
        setTestResults(r => ({ ...r, [router.id]: { status: 'ok' } }))
      } else {
        setTestResults(r => ({
          ...r,
          [router.id]: { status: 'fail', message: res.error || 'Connection failed' },
        }))
      }
    } catch {
      setTestResults(r => ({
        ...r,
        [router.id]: { status: 'fail', message: 'Network error' },
      }))
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
            Routers
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Manage your MikroTik router fleet</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRouters(true)}
            disabled={refreshing}
            className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Router
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <span className="text-sm">Loading routers…</span>
          </div>
        ) : routers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-gray-400">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center">
              <RouterIcon className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-600">No routers yet</p>
              <p className="text-sm mt-1">Add your first router to get started</p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Router
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-indigo-50/40">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Name
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Location
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Host / Port
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Connection
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {routers.map(router => {
                  const tr = testResults[router.id] ?? { status: 'idle' }
                  return (
                    <tr
                      key={router.id}
                      className="hover:bg-indigo-50/30 transition-colors duration-150 group"
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                            <RouterIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-semibold text-gray-900 text-sm">{router.name}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {router.location}
                        </div>
                      </td>

                      {/* Host / Port */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm font-mono">
                          <Server className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {router.host}:{router.port}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-6 py-4">
                        <StatusBadge isActive={router.isActive} />
                      </td>

                      {/* Test Connection */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTest(router)}
                            disabled={tr.status === 'testing'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {tr.status === 'testing' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wifi className="w-3.5 h-3.5" />
                            )}
                            {tr.status === 'testing' ? 'Testing…' : 'Test'}
                          </button>

                          {tr.status === 'ok' && (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Connected
                            </span>
                          )}
                          {tr.status === 'fail' && (
                            <span
                              className="flex items-center gap-1 text-red-600 text-xs font-medium max-w-[180px] truncate"
                              title={tr.message}
                            >
                              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                              {tr.message || 'Failed'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(router)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit router"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(router)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete router"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <RouterIcon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editing ? 'Edit Router' : 'Add Router'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Router Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={field('name')}
                  placeholder="e.g. Main Office Router"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={field('location')}
                  placeholder="e.g. Block A, Floor 2"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Host + Port row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Host / IP <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={field('host')}
                    placeholder="192.168.1.1"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={formData.port}
                    onChange={field('port')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={formData.username}
                  onChange={field('username')}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password{!editing && <span className="text-red-400"> *</span>}
                  {editing && (
                    <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editing}
                    autoComplete={editing ? 'new-password' : 'current-password'}
                    value={formData.password}
                    onChange={field('password')}
                    placeholder={editing ? '••••••••' : 'Enter password'}
                    className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Save Changes' : 'Add Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoutersManagement
