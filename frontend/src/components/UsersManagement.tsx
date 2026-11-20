import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  History,
  PowerOff,
  UserCheck,
  UserX,
  Network,
  X,
  Clock,
  Shield,
  Loader2,
} from 'lucide-react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { User, Session, MacBinding } from '../types'

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Context menu state
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null)

  // Modal states
  const [historyModalUser, setHistoryModalUser] = useState<User | null>(null)
  const [userSessions, setUserSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [macModalUser, setMacModalUser] = useState<User | null>(null)
  const [macBindings, setMacBindings] = useState<MacBinding[]>([])
  const [loadingMacs, setLoadingMacs] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [currentPage, searchTerm])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getUsers({
        page: currentPage,
        limit: 10,
        search: searchTerm || undefined,
      })

      if (response.success && response.data) {
        setUsers(response.data.users || response.data.data || [])
        setTotalPages(response.data.pagination.pages)
      }
    } catch (error) {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleToggleMenu = (userId: string) => {
    setActiveMenuUserId((prev) => (prev === userId ? null : userId))
  }

  const closeMenu = () => {
    setActiveMenuUserId(null)
  }

  // Action: View Session History
  const handleViewSessionHistory = async (user: User) => {
    closeMenu()
    setHistoryModalUser(user)
    setLoadingSessions(true)
    setUserSessions([])
    try {
      const res = await adminAPI.getUserSessions(user.id)
      if (res.success && res.data) {
        setUserSessions(res.data)
      } else {
        toast.error(res.error || 'Failed to load session history')
      }
    } catch (error) {
      toast.error('Failed to load session history')
    } finally {
      setLoadingSessions(false)
    }
  }

  // Action: Terminate Active Sessions
  const handleTerminateActiveSessions = async (user: User) => {
    closeMenu()
    try {
      const res = await adminAPI.terminateUserSessions(user.id)
      if (res.success) {
        const count = res.data?.terminatedCount ?? 0
        toast.success(res.data?.message || `${count} active session(s) terminated`)
      } else {
        toast.error(res.error || 'Failed to terminate active sessions')
      }
    } catch (error) {
      toast.error('Failed to terminate active sessions')
    }
  }

  // Action: Toggle Active / Inactive
  const handleToggleActive = async (user: User) => {
    closeMenu()
    try {
      const res = await adminAPI.toggleUserActive(user.id)
      if (res.success) {
        const newActiveState = res.data?.isActive ?? !user.isActive
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: newActiveState } : u))
        )
        toast.success(
          res.data?.isActive !== undefined
            ? `User ${res.data.isActive ? 'activated' : 'deactivated'} successfully`
            : 'User status updated successfully'
        )
      } else {
        toast.error(res.error || 'Failed to update user status')
      }
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  // Action: View MAC Bindings
  const handleViewMacBindings = async (user: User) => {
    closeMenu()
    setMacModalUser(user)
    setLoadingMacs(true)
    setMacBindings([])
    try {
      const res = await adminAPI.getUserMacBindings(user.id)
      if (res.success && res.data) {
        setMacBindings(res.data)
      } else {
        toast.error(res.error || 'Failed to load MAC bindings')
      }
    } catch (error) {
      toast.error('Failed to load MAC bindings')
    } finally {
      setLoadingMacs(false)
    }
  }

  const renderActionMenu = (user: User) => {
    if (activeMenuUserId !== user.id) return null

    return (
      <>
        {/* Invisible backdrop to dismiss menu on click outside */}
        <div className="fixed inset-0 z-20" onClick={closeMenu} />
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-30 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => handleViewSessionHistory(user)}
            className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center transition-colors"
          >
            <History className="w-4 h-4 mr-2.5 text-indigo-500" />
            View Session History
          </button>
          <button
            onClick={() => handleTerminateActiveSessions(user)}
            className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-amber-700 hover:bg-amber-50 flex items-center transition-colors"
          >
            <PowerOff className="w-4 h-4 mr-2.5 text-amber-500" />
            Terminate Active Sessions
          </button>
          <button
            onClick={() => handleToggleActive(user)}
            className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center transition-colors"
          >
            {user.isActive ? (
              <>
                <UserX className="w-4 h-4 mr-2.5 text-rose-500" />
                Toggle Active/Inactive (Deactivate)
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2.5 text-emerald-500" />
                Toggle Active/Inactive (Activate)
              </>
            )}
          </button>
          <button
            onClick={() => handleViewMacBindings(user)}
            className="w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center transition-colors border-t border-gray-100 mt-1"
          >
            <Network className="w-4 h-4 mr-2.5 text-purple-500" />
            View MAC Bindings
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
            Users Management
          </h1>
          <p className="text-gray-600 mt-1">Manage customer accounts and monitor activity</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search users by name, phone, or email..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all placeholder-gray-500"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl overflow-visible">
        <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-2xl">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">All Users</h3>
          </div>
        </div>

        {loading ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="loading-spinner mx-auto"></div>
            <p className="text-gray-500 mt-4">Loading users...</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto overflow-y-visible">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                            <span className="text-white font-bold">
                              {(user.firstName || user.phone)[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center text-sm text-gray-900">
                            <Phone className="w-4 h-4 mr-2 text-gray-400" />
                            {user.phone}
                          </div>
                          {user.email && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {user.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full ${
                            user.isActive
                              ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200'
                              : 'bg-gradient-to-r from-red-100 to-pink-100 text-red-800 border border-red-200'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 mr-2" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap relative">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => handleToggleMenu(user.id)}
                            aria-label="User actions"
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          {renderActionMenu(user)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                        <span className="text-white font-bold text-lg">
                          {(user.firstName || user.phone)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : 'Unknown User'}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Phone className="w-4 h-4 mr-1" />
                          {user.phone}
                        </div>
                        {user.email && (
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Mail className="w-4 h-4 mr-1" />
                            {user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2 relative">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-full ${
                          user.isActive
                            ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200'
                            : 'bg-gradient-to-r from-red-100 to-pink-100 text-red-800 border border-red-200'
                        }`}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => handleToggleMenu(user.id)}
                          aria-label="User actions"
                          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                        {renderActionMenu(user)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session History Modal */}
      {historyModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow">
                  <History className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Session History</h3>
                  <p className="text-xs text-gray-500">
                    {historyModalUser.firstName && historyModalUser.lastName
                      ? `${historyModalUser.firstName} ${historyModalUser.lastName}`
                      : historyModalUser.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingSessions ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm text-gray-500 mt-3">Loading session history...</p>
                </div>
              ) : userSessions.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No sessions found for this user.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {userSessions.map((session) => (
                    <div key={session.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-gray-900">
                          {session.plan?.name || 'Standard Plan'}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 space-x-3">
                          <span className="flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1 text-gray-400" />
                            {new Date(session.startTime).toLocaleString()}
                          </span>
                          <span>•</span>
                          <span>Duration: {session.plan?.duration || 0}h</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                            session.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : session.status === 'EXPIRED'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setHistoryModalUser(null)}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAC Bindings Modal */}
      {macModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow">
                  <Network className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">MAC Address Bindings</h3>
                  <p className="text-xs text-gray-500">
                    {macModalUser.firstName && macModalUser.lastName
                      ? `${macModalUser.firstName} ${macModalUser.lastName}`
                      : macModalUser.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMacModalUser(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {loadingMacs ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
                  <p className="text-sm text-gray-500 mt-3">Loading MAC bindings...</p>
                </div>
              ) : macBindings.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  No MAC addresses bound to this user.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {macBindings.map((binding, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 font-mono text-xs">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-mono font-medium text-gray-900">
                            {binding.macAddress}
                          </div>
                          {binding.lastSeen && (
                            <div className="text-xs text-gray-500">
                              Last seen: {new Date(binding.lastSeen).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setMacModalUser(null)}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersManagement
