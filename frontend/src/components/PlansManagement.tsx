import React, { useState, useEffect } from 'react'
import { adminAPI } from '../services/api'
import { formatDuration } from '../utils/formatters'
import toast from 'react-hot-toast'
import type { Plan, Router } from '../types'

export interface PlanModalProps {
  isOpen?: boolean
  plan?: Plan | null
  onClose: () => void
  onSuccess: () => void
}

export const PlanModal: React.FC<PlanModalProps> = ({
  isOpen = true,
  plan = null,
  onClose,
  onSuccess,
}) => {
  const [routers, setRouters] = useState<Router[]>([])
  const [loadingRouters, setLoadingRouters] = useState(true)
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price !== undefined ? plan.price.toString() : '',
    duration: plan?.duration !== undefined ? plan.duration.toString() : '',
    dataLimit: plan?.dataLimit || '',
    speedLimit: plan?.speedLimit || '',
    routerId: plan?.routerId || plan?.router?.id || '',
  })

  useEffect(() => {
    fetchRouters()
  }, [])

  const fetchRouters = async () => {
    setLoadingRouters(true)
    try {
      const response = await adminAPI.getRouters()
      if (response.success && response.data) {
        setRouters(response.data)
      }
    } catch (error) {
      toast.error('Failed to load routers')
    } finally {
      setLoadingRouters(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.routerId) {
      toast.error('Please select a router')
      return
    }

    try {
      const planData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        dataLimit: formData.dataLimit,
        speedLimit: formData.speedLimit,
        routerId: formData.routerId,
      }

      if (plan) {
        await adminAPI.updatePlan(plan.id, planData)
        toast.success('Plan updated successfully')
      } else {
        await adminAPI.createPlan(planData)
        toast.success('Plan created successfully')
      }

      onClose()
      onSuccess()
    } catch (error) {
      toast.error('Failed to save plan')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-surface-card rounded-card w-full max-w-lg shadow-overlay border border-border-subtle overflow-hidden">
        {/* Modal header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-border-subtle">
          <h2 className="font-bold text-base text-text-primary">
            {plan ? 'Edit Internet Plan' : 'Create Internet Plan'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-control text-text-muted hover:text-text-primary hover:bg-surface-canvas transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Plan Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              placeholder="e.g., Premium 24 Hours"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              rows={2}
              placeholder="Brief description of the plan"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Price (KES)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder font-mono text-xs">KES</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full h-9 pl-11 pr-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Duration (hours)
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full h-9 px-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="24"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Data Limit
              </label>
              <input
                type="text"
                required
                value={formData.dataLimit}
                onChange={(e) => setFormData({ ...formData, dataLimit: e.target.value })}
                className="w-full h-9 px-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="10GB"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Speed Limit
              </label>
              <input
                type="text"
                required
                value={formData.speedLimit}
                onChange={(e) => setFormData({ ...formData, speedLimit: e.target.value })}
                className="w-full h-9 px-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary placeholder:text-text-placeholder focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                placeholder="20Mbps"
              />
            </div>
          </div>

          <div>
            <label htmlFor="router" className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Router
            </label>
            <select
              id="router"
              required
              value={formData.routerId}
              onChange={(e) => setFormData({ ...formData, routerId: e.target.value })}
              className="w-full h-9 px-3 rounded-control border border-border-subtle bg-surface-canvas text-sm text-text-primary focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            >
              <option value="">Select a router</option>
              {routers.map((router) => (
                <option key={router.id} value={router.id}>
                  {router.name} — {router.location}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-control border border-border-subtle text-text-secondary hover:bg-slate-50 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loadingRouters}
              className="h-10 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-control transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {plan ? 'Update Plan' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const PlansManagement: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await adminAPI.getPlans()
      if (response.success && response.data) {
        setPlans(response.data)
      }
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePlan = () => {
    setEditingPlan(null)
    setShowModal(true)
  }

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan)
    setShowModal(true)
  }

  const handleDeletePlan = async (planId: string) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      try {
        await adminAPI.deletePlan(planId)
        toast.success('Plan deleted successfully')
        fetchPlans()
      } catch (error) {
        toast.error('Failed to delete plan')
      }
    }
  }

  // Derive a tier label from plan index (0-based)
  const getTierLabel = (index: number) => {
    const tiers = ['Starter', 'Basic', 'Standard', 'Pro', 'Premium', 'Enterprise']
    return tiers[index] ?? 'Custom'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Plans Management</h1>
          <p className="text-sm text-text-muted mt-1">Configure captive portal tiers, bandwidth profiles, and subscriber speed caps</p>
        </div>
        <button
          onClick={handleCreatePlan}
          className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-control transition-colors self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden animate-pulse">
              <div className="h-14 px-5 border-b border-border-subtle flex items-center justify-between">
                <div className="h-3 bg-slate-200 rounded w-1/2" />
                <div className="h-5 bg-slate-200 rounded-badge w-14" />
              </div>
              <div className="px-5 py-4 space-y-3">
                <div className="h-8 bg-slate-200 rounded w-1/3" />
                <div className="h-3 bg-slate-200 rounded w-2/5" />
              </div>
              <div className="px-5 pb-4 space-y-2">
                <div className="h-3 bg-slate-200 rounded" />
                <div className="h-3 bg-slate-200 rounded" />
                <div className="h-3 bg-slate-200 rounded" />
              </div>
              <div className="px-5 pb-5">
                <div className="h-10 bg-slate-200 rounded-control" />
              </div>
            </div>
          ))
        ) : (
          plans.map((plan, index) => (
            <div
              key={plan.id}
              className="bg-surface-card rounded-card border border-border-subtle shadow-card overflow-hidden hover:border-border-strong hover:shadow-card-hover transition-all"
            >
              {/* Card header block — 56 px tall */}
              <div className="h-14 px-5 border-b border-border-subtle flex items-center justify-between">
                <span className="font-semibold text-sm text-text-primary truncate mr-2">{plan.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Tier badge — neutral status variant */}
                  <span className="rounded-badge border bg-status-neutral-bg border-status-neutral-border text-status-neutral text-[11px] font-medium px-2 py-0.5">
                    {getTierLabel(index)}
                  </span>
                  {/* Edit / Delete icon buttons */}
                  <button
                    onClick={() => handleEditPlan(plan)}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-slate-100 transition-colors"
                    title="Edit plan"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id)}
                    className="p-1 rounded text-text-muted hover:text-status-danger hover:bg-status-danger-bg transition-colors"
                    title="Delete plan"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Price section */}
              <div className="px-5 py-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-text-muted">KES</span>
                  <span className="text-[2rem] font-bold tabular-nums text-text-primary leading-none">
                    {plan.price.toLocaleString()}
                  </span>
                  <span className="text-sm text-text-muted">/ {formatDuration(plan.duration)}</span>
                </div>
              </div>

              {/* Feature list */}
              <div className="px-5 pb-4 space-y-2">
                <div className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-success">check_circle</span>
                  <span>Speed: <span className="font-medium text-text-primary">{plan.speedLimit}</span></span>
                </div>
                <div className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-success">check_circle</span>
                  <span>Data: <span className="font-medium text-text-primary">{plan.dataLimit}</span></span>
                </div>
                <div className="text-sm text-text-secondary flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-status-success">check_circle</span>
                  <span>Duration: <span className="font-medium text-text-primary">{formatDuration(plan.duration)}</span></span>
                </div>
                {/* Active / Inactive status */}
                <div className="text-sm text-text-secondary flex items-center gap-2">
                  <span className={`material-symbols-outlined text-[16px] ${plan.isActive ? 'text-status-success' : 'text-text-muted'}`}>
                    {plan.isActive ? 'wifi' : 'wifi_off'}
                  </span>
                  <span className={plan.isActive ? 'text-status-success font-medium' : 'text-text-muted'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {plan.description && (
                  <p className="text-sm text-text-muted italic pt-1">{plan.description}</p>
                )}
              </div>

              {/* CTA button */}
              <div className="px-5 pb-5">
                <button
                  onClick={() => handleEditPlan(plan)}
                  className="h-10 w-full bg-primary hover:bg-primary-hover text-white font-medium text-sm rounded-control transition-colors"
                >
                  Manage Plan
                </button>
              </div>
            </div>
          ))
        )}

        {/* "Add Plan" ghost card */}
        {!loading && (
          <button
            onClick={handleCreatePlan}
            className="rounded-card border-2 border-dashed border-border-subtle hover:border-primary/50 hover:bg-white bg-slate-50/60 flex flex-col items-center justify-center text-center transition-all min-h-[260px] cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-white border border-border-subtle group-hover:border-primary/30 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors shadow-sm mb-3">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </div>
            <span className="text-sm font-semibold text-text-primary">New Package</span>
            <span className="text-xs text-text-muted mt-1 max-w-[160px]">Define bandwidth speeds, quotas, and billing tiers</span>
          </button>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PlanModal
          plan={editingPlan}
          onClose={() => setShowModal(false)}
          onSuccess={fetchPlans}
        />
      )}
    </div>
  )
}

export default PlansManagement
