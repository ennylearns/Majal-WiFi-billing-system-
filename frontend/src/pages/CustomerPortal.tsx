import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { formatCurrency, formatDuration } from '../utils/formatters'
import { publicAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { Plan, PublicRouter, TrialStatus } from '../types'
import { useTrialCountdown } from '../hooks/useTrialCountdown'

interface ConnectedSessionInfo {
  plan: string
  endTime?: string
}

const CustomerPortal: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [routers, setRouters] = useState<PublicRouter[]>([])
  const [selectedRouter, setSelectedRouter] = useState<PublicRouter | null>(null)
  const [isChangingLocation, setIsChangingLocation] = useState(false)
  const [unrecognizedParam, setUnrecognizedParam] = useState<string | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [connectedSession, setConnectedSession] = useState<ConnectedSessionInfo | null>(null)
  const isPaymentConfirmedRef = useRef(false)

  // Trial state & client parameters forwarded by captive portal redirect
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
  const [trialLoading, setTrialLoading] = useState(false)
  const [trialExpiredBanner, setTrialExpiredBanner] = useState(false)

  // Ref to allow the countdown banner CTA to scroll to plans
  const plansSectionRef = useRef<HTMLDivElement>(null)

  const clientMac = searchParams.get('mac') || searchParams.get('macAddress')
  const clientIp = searchParams.get('ip') || searchParams.get('ipAddress')

  const rawRouterParam = searchParams.get('routerId') || searchParams.get('router')

  // Called by the countdown when it reaches 00:00
  const handleTrialExpired = useCallback(() => {
    setTrialExpiredBanner(true)
    setConnectionStatus('disconnected')
    setConnectedSession(null)
  }, [])

  // Active trial endTime (null when no active trial)
  const activeTrialEndTime =
    trialStatus?.status === 'ACTIVE' ? trialStatus.session?.endTime ?? null : null

  const countdown = useTrialCountdown(activeTrialEndTime, handleTrialExpired)

  // If the portal loads with an already-expired session (server says ACTIVE but
  // the endTime is in the past), immediately show the expired banner.
  useEffect(() => {
    if (countdown.isExpired && trialStatus?.status === 'ACTIVE') {
      setTrialExpiredBanner(true)
      setConnectionStatus('disconnected')
      setConnectedSession(null)
    }
  }, [countdown.isExpired, trialStatus?.status])

  useEffect(() => {
    loadPortalData()
  }, [rawRouterParam])

  useEffect(() => {
    if (clientMac) {
      publicAPI
        .getTrialStatus(clientMac)
        .then((res) => {
          if (res.success && res.data) {
            setTrialStatus(res.data)
            if (res.data.status === 'ACTIVE' && res.data.session) {
              setConnectionStatus('connected')
              setConnectedSession({
                plan: '10-Minute Free Trial',
                endTime: res.data.session.endTime,
              })
            } else if (res.data.status === 'COOLDOWN') {
              // If the trial ended and we're in cooldown, show expired banner
              // only when the portal is freshly loaded (no live session)
              const endedWithinCooldown = !res.data.session
              if (endedWithinCooldown) {
                setTrialExpiredBanner(true)
              }
            }
          }
        })
        .catch(() => {
          // Ignore error on background trial status check
        })
    }
  }, [clientMac])

  const loadPortalData = async () => {
    try {
      setLoadingData(true)
      const [routersRes, plansRes] = await Promise.all([
        publicAPI.getRouters().catch(() => ({ success: false, data: [] })),
        publicAPI.getPlans().catch(() => ({ success: false, data: [] }))
      ])

      const loadedPlans: Plan[] = plansRes.success && plansRes.data ? plansRes.data : []
      setPlans(loadedPlans)

      let loadedRouters: PublicRouter[] = routersRes.success && routersRes.data ? routersRes.data : []
      if (loadedRouters.length === 0) {
        // Fallback: extract unique routers from plans
        const map = new Map<string, PublicRouter>()
        for (const p of loadedPlans) {
          if (p.router) {
            map.set(p.router.id, {
              id: p.router.id,
              name: p.router.name,
              location: p.router.location
            })
          }
        }
        loadedRouters = Array.from(map.values())
      }
      setRouters(loadedRouters)

      if (rawRouterParam && rawRouterParam.trim() !== '') {
        const q = rawRouterParam.trim().toLowerCase()
        const match = loadedRouters.find(r =>
          r.id.toLowerCase() === q ||
          r.name.toLowerCase() === q ||
          r.location.toLowerCase() === q
        )

        if (match) {
          setSelectedRouter(match)
          setUnrecognizedParam(null)
          setIsChangingLocation(false)
        } else {
          setSelectedRouter(null)
          setUnrecognizedParam(rawRouterParam.trim())
          setIsChangingLocation(true)
        }
      } else {
        setSelectedRouter(null)
        setUnrecognizedParam(null)
        setIsChangingLocation(true)
      }
    } catch (error) {
      toast.error('Failed to load plans')
    } finally {
      setLoadingData(false)
    }
  }

  const handleSelectLocation = (routerId: string) => {
    const chosen = routers.find(r => r.id === routerId)
    if (chosen) {
      setSelectedRouter(chosen)
      setUnrecognizedParam(null)
      setIsChangingLocation(false)
      setSearchParams({ routerId: chosen.id })
    }
  }

  const handlePay = async (plan: Plan) => {
    setSelectedPlan(plan)
    setShowPayment(true)
    setPaymentStatus('initiating')
    setLoading(true)
    isPaymentConfirmedRef.current = false

    try {
      const response = await publicAPI.makePayment({
        planId: plan.id,
        amount: plan.price,
        macAddress: clientMac || undefined,
      })

      const reference = response.data?.reference || (response as any).reference
      const accessCode = response.data?.access_code || (response as any).access_code

      if (!reference) {
        throw new Error('No payment reference returned from server')
      }

      openPaystackPopup(reference, accessCode, plan)
    } catch (error: any) {
      setLoading(false)
      setPaymentStatus(null)
      setShowPayment(false)
      toast.error(error.response?.data?.error || error.message || 'Payment initiation failed')
    }
  }

  const openPaystackPopup = (reference: string, accessCode: string | undefined, plan: Plan) => {
    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || ''
    const PaystackClass = (window as any).PaystackPop

    const handleSuccess = (transaction: any) => {
      isPaymentConfirmedRef.current = true
      setPaymentStatus('verifying')
      setLoading(true)
      const txnRef = transaction?.reference || reference
      pollPaymentStatus(txnRef, plan)
    }

    const handleClose = () => {
      if (!isPaymentConfirmedRef.current) {
        setLoading(false)
        setPaymentStatus('cancelled')
        toast.error('Payment cancelled — try again')
      }
    }

    if (PaystackClass) {
      if (typeof PaystackClass.setup === 'function') {
        const handler = PaystackClass.setup({
          key: publicKey,
          email: 'customer@collospot.com',
          amount: Math.round(plan.price * 100),
          ref: reference,
          access_code: accessCode,
          callback: (transaction: any) => {
            handleSuccess(transaction)
          },
          onSuccess: (transaction: any) => {
            handleSuccess(transaction)
          },
          onClose: () => {
            handleClose()
          }
        })
        handler.openIframe()
      } else {
        const popup = new PaystackClass()
        popup.checkout({
          key: publicKey,
          accessCode: accessCode,
          reference: reference,
          onSuccess: (transaction: any) => {
            handleSuccess(transaction)
          },
          onCancel: () => {
            handleClose()
          },
          onClose: () => {
            handleClose()
          }
        })
      }
    } else {
      // In development or if script blocked, allow polling fallback or show error
      setLoading(false)
      setPaymentStatus('cancelled')
      toast.error('Paystack popup unavailable. Please ensure online connectivity.')
    }
  }

  const pollPaymentStatus = async (reference: string, plan: Plan) => {
    const maxAttempts = 30
    let attempts = 0

    const poll = async () => {
      try {
        const response = await publicAPI.getPaymentStatus(reference)

        if (response.success && response.data) {
          const { status, sessionToken } = response.data

          if (status === 'completed') {
            isPaymentConfirmedRef.current = true
            setPaymentStatus('completed')
            setLoading(false)
            toast.success('Payment confirmed!')
            setTrialExpiredBanner(false) // dismiss expired-trial banner on successful purchase
            setTrialStatus(null) // dismiss trial countdown banner and clear trial state immediately

            if (sessionToken) {
              await connectToInternet(sessionToken, plan)
            } else {
              const defaultExpiry = new Date(Date.now() + plan.duration * 3600 * 1000).toISOString()
              markPaidSessionConnected(plan.name, defaultExpiry)
            }
            return
          } else if (status === 'failed') {
            setPaymentStatus('failed')
            setLoading(false)
            toast.error('Payment failed. Please try again.')
            return
          }
        }

        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 10000)
        } else {
          setPaymentStatus('timeout')
          setLoading(false)
          toast.error('Payment verification timed out. Please contact support.')
        }
      } catch (error) {
        if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 10000)
        } else {
          setPaymentStatus('failed')
          setLoading(false)
          toast.error('Unable to verify payment status')
        }
      }
    }

    poll()
  }

  const markPaidSessionConnected = (planName: string, endTime: string) => {
    setConnectionStatus('connected')
    setPaymentStatus('connected')
    setTrialStatus(null)
    setConnectedSession({
      plan: planName,
      endTime,
    })
  }

  const isTrialSession = (session: ConnectedSessionInfo | null): boolean =>
    session?.plan === '10-Minute Free Trial'

  const connectToInternet = async (sessionToken: string, plan: Plan) => {
    const defaultExpiry = new Date(Date.now() + plan.duration * 3600 * 1000).toISOString()
    try {
      const response = await publicAPI.connect({ sessionToken })
      const sessionPlan = response.data?.session?.plan || plan.name
      const sessionEndTime = response.data?.session?.endTime || defaultExpiry
      markPaidSessionConnected(sessionPlan, sessionEndTime)
      toast.success('Connected to internet successfully!')
    } catch (error) {
      // Session exists even if MikroTik disconnects
      markPaidSessionConnected(plan.name, defaultExpiry)
    }
  }

  const handleStartTrial = async () => {
    if (!selectedRouter) {
      toast.error('Please select your hotspot location first')
      return
    }

    if (!clientMac) {
      toast.error('Device MAC address not detected from hotspot redirect')
      return
    }

    try {
      setTrialLoading(true)
      const res = await publicAPI.startTrial({
        routerId: selectedRouter.id,
        macAddress: clientMac,
        ipAddress: clientIp || undefined,
      })

      if (res.success && res.data) {
        // Authorize session at hotspot gateway
        await publicAPI.connect({ sessionToken: res.data.session.sessionToken }).catch(() => {})

        setConnectionStatus('connected')
        setPaymentStatus('connected')
        setConnectedSession({
          plan: '10-Minute Free Trial',
          endTime: res.data.session.endTime,
        })
        setShowPayment(true)
        toast.success('10-minute free trial activated!')
        setTrialStatus({
          status: 'ACTIVE',
          isEligible: false,
          inCooldown: false,
          session: res.data.session,
        })
      }
    } catch (err: any) {
      const resp = err.response?.data
      if (resp?.inCooldown) {
        setTrialStatus({
          status: 'COOLDOWN',
          isEligible: false,
          inCooldown: true,
          remainingHours: resp.remainingHours,
          remainingMinutes: resp.remainingMinutes,
          remainingSeconds: resp.remainingSeconds,
          cooldownEndsAt: resp.cooldownEndsAt,
        })
        toast.error(
          resp.error ||
            `Free trial in cooldown. Next trial available in ${resp.remainingHours ?? 0}h ${resp.remainingMinutes ?? 0}m.`
        )
      } else {
        toast.error(resp?.error || err.message || 'Failed to activate trial')
      }
    } finally {
      setTrialLoading(false)
    }
  }

  const scrollToPlans = () => {
    plansSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const formatExpiry = (dateStr?: string) => {
    if (!dateStr) return 'Active'
    try {
      const d = new Date(dateStr)
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    } catch {
      return dateStr
    }
  }

  const displayedPlans = selectedRouter
    ? plans.filter(p => p.routerId === selectedRouter.id || p.router?.id === selectedRouter.id)
    : []

  return (
    <div className="bg-surface-canvas text-text-primary font-sans antialiased min-h-screen flex flex-col justify-between">
      {/* Sticky Branded Header */}
      <header className="sticky top-0 w-full z-40 bg-surface-card border-b border-border-subtle">
        <div className="h-16 max-w-5xl mx-auto px-6 flex items-center justify-between">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  wifi
                </span>
              </div>
              <div className="flex items-baseline tracking-tight">
                <span className="text-lg font-bold text-text-primary">Majal</span>
                <span className="text-lg font-bold text-primary ml-0.5">ISP</span>
              </div>
            </div>
            <div className="h-4 w-px bg-border-subtle hidden sm:block"></div>
            <span className="text-sm font-semibold text-text-primary tracking-tight hidden sm:inline">
              Customer Hotspot
            </span>
          </div>

          {/* Network Location Pill & Actions */}
          <div className="flex items-center gap-4">
            <div className="bg-surface-dim border border-border-subtle rounded-control px-2.5 py-1 text-xs flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-status-success animate-pulse' : 'bg-status-success animate-pulse'}`}></span>
              <span className="text-text-secondary font-medium">
                {selectedRouter ? (selectedRouter.location || selectedRouter.name) : 'No Hotspot Selected'}
              </span>
              <button
                type="button"
                onClick={() => setIsChangingLocation(!isChangingLocation)}
                className="ml-1 text-primary hover:underline font-medium flex items-center gap-0.5"
              >
                <span>Change</span>
              </button>
            </div>
            <a
              className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
              href="tel:+254700000000"
            >
              <span className="material-symbols-outlined text-sm">help_outline</span>
              <span className="hidden md:inline">Support</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── Trial Countdown Banner ──────────────────────────────────────────── */}
      {trialStatus?.status === 'ACTIVE' && !countdown.isExpired && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Trial countdown"
          className={`sticky top-16 z-30 w-full border-b shadow-sm transition-colors duration-700 ${
            countdown.isWarning
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="max-w-5xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4">
            {/* Left: icon + message */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 ${
                  countdown.isWarning ? 'text-red-500' : 'text-amber-600'
                }`}
              >
                timer
              </span>
              <span
                className={`text-xs font-medium leading-snug ${
                  countdown.isWarning ? 'text-red-700' : 'text-amber-800'
                }`}
              >
                {countdown.isWarning
                  ? 'Trial ending soon — buy a plan to stay connected!'
                  : 'You\'re on a 10-minute free trial. Buy a plan before time runs out.'}
              </span>
            </div>

            {/* Center: countdown timer */}
            <span
              className={`font-mono font-bold tabular-nums text-lg shrink-0 ${
                countdown.isWarning ? 'text-red-600 animate-pulse' : 'text-amber-700'
              }`}
              data-testid="trial-countdown"
            >
              {countdown.display}
            </span>

            {/* Right: CTA */}
            <button
              type="button"
              onClick={scrollToPlans}
              className={`shrink-0 px-3 py-1.5 rounded-control text-xs font-semibold transition-colors shadow-sm ${
                countdown.isWarning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              View Plans
            </button>
          </div>
        </div>
      )}

      {/* ── Expired Trial Banner ────────────────────────────────────────────── */}
      {trialExpiredBanner && trialStatus?.status !== 'ELIGIBLE' && (
        <div
          role="alert"
          className="sticky top-16 z-30 w-full bg-status-danger-bg border-b border-status-danger-border shadow-sm"
        >
          <div className="max-w-5xl mx-auto px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-status-danger shrink-0">
                wifi_off
              </span>
              <div>
                <p className="text-sm font-semibold text-status-danger">
                  Your free trial has ended — internet access paused.
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  Purchase a plan below to restore your connection instantly.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToPlans}
              className="shrink-0 px-4 py-2 rounded-control bg-status-danger hover:opacity-90 text-white text-xs font-semibold transition-opacity shadow-sm"
            >
              Buy a Plan
            </button>
          </div>
        </div>
      )}

      {/* Collapsible Location Selector Drawer */}
      {isChangingLocation && (
        <div className="border-b border-border-subtle bg-surface-card py-4 shadow-inner animate-in fade-in duration-150">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between mb-3 text-xs text-text-muted">
              <span className="font-semibold uppercase tracking-wider micro-label">Select Access Point</span>
              {selectedRouter && (
                <span>
                  Active: <strong className="text-text-primary">{selectedRouter.location || selectedRouter.name}</strong>
                </span>
              )}
            </div>

            {routers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {routers.map((r) => {
                  const isSelected = selectedRouter?.id === r.id
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleSelectLocation(r.id)}
                      className={`p-3 rounded-control border text-left transition-all ${
                        isSelected
                          ? 'border-primary/50 bg-primary-light/50 ring-1 ring-primary/20'
                          : 'border-border-subtle hover:border-border-strong bg-surface-card'
                      }`}
                    >
                      <div className="font-semibold text-sm text-text-primary">{r.location || r.name}</div>
                      <div className="text-xs text-text-muted mt-0.5">{r.name}</div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted">No access points found.</p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Unrecognized router parameter warning notice */}
        {unrecognizedParam && (
          <div className="mb-6 p-4 bg-status-warning-bg border border-status-warning-border rounded-card flex items-start gap-3 text-status-warning shadow-card">
            <span className="material-symbols-outlined text-[20px] text-status-warning flex-shrink-0 mt-0.5">
              warning
            </span>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-sm text-text-primary">
                Unrecognized hotspot location: <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-text-primary">{unrecognizedParam}</span>
              </p>
              <p className="text-text-secondary mt-1">
                The router parameter provided does not match any active hotspot location. Please select your current location from the list above to view available plans.
              </p>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <section className="max-w-2xl mb-8">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight mb-2">
            Fast WiFi in seconds
          </h1>
          <p className="text-base text-text-secondary leading-relaxed">
            Select a pass, authorize payment instantly via M-Pesa or Card with Paystack, and browse without voucher codes.
          </p>
        </section>

        {/* Active Paid Plan Connection Banner */}
        {connectionStatus === 'connected' && connectedSession && !isTrialSession(connectedSession) && (
          <div
            data-testid="paid-plan-active-banner"
            className="mb-8 p-5 rounded-card border border-status-success-border bg-status-success-bg/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card"
          >
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">wifi</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-primary">Connected to Internet</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-badge bg-status-success text-white tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    Active Plan
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Plan: <span className="font-semibold text-text-primary">{connectedSession.plan}</span> • Expires:{' '}
                  <span className="font-mono tabular-nums text-text-primary">{formatExpiry(connectedSession.endTime)}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Free 10-Minute Trial Card */}
        {selectedRouter && !(connectionStatus === 'connected' && connectedSession && !isTrialSession(connectedSession)) && (
          <div className="mb-8 p-5 rounded-card border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">bolt</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-primary">10-Minute Free Trial</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-badge bg-primary text-white tracking-wide">
                    Free
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {trialStatus?.inCooldown
                    ? `Trial cooldown active for this device. Next free trial available in ${trialStatus.remainingHours ?? 0}h ${trialStatus.remainingMinutes ?? 0}m.`
                    : 'Test out our high-speed connection (2M/1M) for 10 minutes. No payment required.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              {trialStatus?.inCooldown ? (
                <div className="text-xs font-semibold text-text-muted bg-surface-dim border border-border-subtle px-3 py-2 rounded-control flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  <span>Available in {trialStatus.remainingHours ?? 0}h {trialStatus.remainingMinutes ?? 0}m</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTrial}
                  disabled={trialLoading || !selectedRouter}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-control bg-primary hover:bg-primary-hover text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                  {trialLoading ? (
                    <>
                      <div className="loading-spinner"></div>
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">wifi</span>
                      <span>Connect 10 Mins Free</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Plans Section */}
        <div ref={plansSectionRef}>
        {loadingData ? (
          <div className="text-center py-16">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-text-muted text-sm">Loading available plans...</p>
          </div>
        ) : !selectedRouter ? (
          <div className="text-center py-16 bg-surface-card rounded-card border border-dashed border-border-strong p-8 max-w-lg mx-auto shadow-card">
            <div className="w-14 h-14 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
              <span className="material-symbols-outlined text-[28px]">location_on</span>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Location Required</h3>
            <p className="text-sm text-text-secondary mb-6">
              Please choose your hotspot location above to see available internet plans and pricing.
            </p>
            <button
              type="button"
              onClick={() => setIsChangingLocation(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-sm font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
              Select Location
            </button>
          </div>
        ) : displayedPlans.length === 0 ? (
          <div className="text-center py-16 bg-surface-card rounded-card border border-dashed border-border-strong p-8 max-w-lg mx-auto shadow-card">
            <div className="w-14 h-14 bg-surface-dim rounded-full flex items-center justify-center mx-auto mb-4 text-text-muted">
              <span className="material-symbols-outlined text-[28px]">wifi_off</span>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">No Plans Available</h3>
            <p className="text-sm text-text-secondary mb-6">
              There are currently no active internet plans available for <strong>{selectedRouter.location || selectedRouter.name}</strong>.
            </p>
            <button
              type="button"
              onClick={() => setIsChangingLocation(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-control text-sm font-medium transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">edit_location</span>
              Change Location
            </button>
          </div>
        ) : (
          <section className="mb-14" ref={plansSectionRef}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {displayedPlans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`bg-surface-card rounded-card border shadow-card cursor-pointer transition-all hover:border-border-strong p-6 flex flex-col justify-between ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/[0.12]'
                        : 'border-border-subtle'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-semibold text-text-primary">{plan.name}</h2>
                        <span className="font-mono text-[11px] text-text-muted bg-surface-dim px-2 py-0.5 rounded-badge uppercase tracking-wider">
                          {formatDuration(plan.duration)}
                        </span>
                      </div>
                      <div className="mb-6">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-3xl font-bold tabular-nums text-text-primary tracking-tight">
                            {formatCurrency(plan.price)}
                          </span>
                          <span className="text-sm text-text-muted">/ {formatDuration(plan.duration)}</span>
                        </div>
                        {plan.description && (
                          <p className="text-xs text-text-secondary mt-2">{plan.description}</p>
                        )}
                      </div>

                      {/* Specs List */}
                      <dl className="space-y-3 pt-4 border-t border-border-subtle text-xs mb-8">
                        <div className="flex justify-between items-center py-1">
                          <dt className="text-text-muted">Download Speed</dt>
                          <dd className="font-medium text-text-primary font-mono tabular-nums">
                            {plan.speedLimit || 'Best Effort'}
                          </dd>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <dt className="text-text-muted">Data Cap</dt>
                          <dd className="font-medium text-text-primary">{plan.dataLimit || 'Unlimited'}</dd>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <dt className="text-text-muted">Validity</dt>
                          <dd className="font-medium text-text-primary">{formatDuration(plan.duration)}</dd>
                        </div>
                        {plan.router?.location && (
                          <div className="flex justify-between items-center py-1">
                            <dt className="text-text-muted">Location</dt>
                            <dd className="font-medium text-text-secondary">{plan.router.location}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handlePay(plan)
                      }}
                      disabled={loading}
                      className={
                        isSelected
                          ? 'w-full h-10 rounded-control bg-primary hover:bg-primary-hover text-white font-medium text-sm flex items-center justify-center transition-colors shadow-sm disabled:opacity-50'
                          : 'w-full h-10 rounded-control border border-border-subtle hover:bg-surface-dim text-text-primary font-medium text-sm flex items-center justify-center transition-colors disabled:opacity-50'
                      }
                    >
                      {loading && selectedPlan?.id === plan.id ? (
                        <>
                          <div className="loading-spinner mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>Pay {formatCurrency(plan.price)}</>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        </div>

        {/* Streamlined 'How It Works' Stepper */}
        <section className="border-t border-border-subtle pt-10 pb-4">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider micro-label mb-6">
            How it works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-full bg-surface-dim border border-border-subtle text-text-primary font-mono text-xs font-semibold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-semibold text-text-primary">Select plan</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Choose duration and bandwidth tailored to your session.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-full bg-surface-dim border border-border-subtle text-text-primary font-mono text-xs font-semibold flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-semibold text-text-primary">Enter phone</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Provide M-Pesa mobile number or card checkout email.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-full bg-surface-dim border border-border-subtle text-text-primary font-mono text-xs font-semibold flex items-center justify-center">
                  3
                </span>
                <span className="text-sm font-semibold text-text-primary">Confirm prompt</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Enter your M-Pesa PIN on your phone handset to authorize.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-full bg-status-success-bg border border-status-success-border text-status-success font-mono text-xs font-semibold flex items-center justify-center">
                  4
                </span>
                <span className="text-sm font-semibold text-text-primary">Connected</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Instant MAC address clearance without entering coupon codes.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Checkout / Payment Modal Dialog */}
      {showPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-surface-card rounded-card border border-border-subtle shadow-card p-6 max-w-sm w-full relative">
            <button
              onClick={() => {
                setShowPayment(false)
                if (paymentStatus === 'cancelled') {
                  setPaymentStatus(null)
                }
              }}
              className="absolute top-4 right-4 text-text-muted hover:text-text-primary p-1 rounded transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Initiating State */}
            {paymentStatus === 'initiating' && (
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider micro-label">
                    Checkout
                  </span>
                  <h4 className="text-lg font-bold text-text-primary mt-0.5">
                    {selectedPlan?.name || 'Internet Plan'}
                  </h4>
                  {selectedPlan && (
                    <p className="text-xs font-mono tabular-nums text-text-muted">
                      {formatCurrency(selectedPlan.price)} • {selectedPlan.speedLimit || 'Best Effort'}
                    </p>
                  )}
                </div>

                <div className="py-6 text-center">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
                  <h5 className="text-sm font-semibold text-text-primary mb-1">Opening Paystack Checkout</h5>
                  <p className="text-xs text-text-muted">Please complete payment in the Paystack window...</p>
                </div>
              </div>
            )}

            {/* Verifying / Polling State */}
            {paymentStatus === 'verifying' && (
              <div className="py-8 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3"></div>
                <h5 className="text-sm font-semibold text-text-primary mb-1">Confirming Payment</h5>
                <p className="text-xs text-text-muted">
                  Verifying your transaction with Paystack and connecting you...
                </p>
              </div>
            )}

            {/* Cancelled State */}
            {paymentStatus === 'cancelled' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[24px]">warning</span>
                </div>
                <h4 className="text-base font-bold text-text-primary mb-1">Payment Cancelled</h4>
                <p className="text-xs text-text-secondary mb-5">Payment was cancelled. You can try again when ready.</p>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full h-10 rounded-control bg-primary hover:bg-primary-hover text-white font-medium text-xs flex items-center justify-center transition-colors shadow-sm"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Success Screen: Internet Activated */}
            {(paymentStatus === 'completed' || paymentStatus === 'connected') && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-status-success-bg text-status-success flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[24px]">check</span>
                </div>
                <h4 className="text-base font-bold text-text-primary mb-1">Internet Activated</h4>
                <p className="text-xs text-text-muted mb-4">Device authentication successful.</p>

                <div className="w-full bg-surface-dim border border-border-subtle rounded-control p-3.5 mb-5 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Plan Name:</span>
                    <span className="font-semibold text-text-primary">
                      {connectedSession?.plan || selectedPlan?.name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Session Expiry:</span>
                    <span className="font-mono font-medium text-status-success tabular-nums">
                      {formatExpiry(connectedSession?.endTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Status:</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge border micro-label bg-status-success-bg border-status-success-border text-status-success">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
                      Active
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowPayment(false)
                    setSelectedPlan(null)
                  }}
                  className="w-full h-10 rounded-control bg-status-success hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1 transition-colors shadow-sm"
                >
                  Start Browsing
                </button>
              </div>
            )}

            {/* Failed State */}
            {paymentStatus === 'failed' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[24px]">error_outline</span>
                </div>
                <h4 className="text-base font-bold text-text-primary mb-1">Payment Failed</h4>
                <p className="text-xs text-text-secondary mb-5">Your payment could not be completed. Please try again.</p>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full h-10 rounded-control bg-primary hover:bg-primary-hover text-white font-medium text-xs flex items-center justify-center transition-colors shadow-sm"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Timeout State */}
            {paymentStatus === 'timeout' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-[24px]">schedule</span>
                </div>
                <h4 className="text-base font-bold text-text-primary mb-1">Payment Verification Timeout</h4>
                <p className="text-xs text-text-secondary mb-5">
                  We could not verify your payment immediately. If you were debited, your session will activate shortly.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full h-10 rounded-control bg-primary hover:bg-primary-hover text-white font-medium text-xs flex items-center justify-center transition-colors shadow-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single Clean Light Footer */}
      <footer className="w-full bg-surface-card border-t border-border-subtle py-4 text-xs text-text-muted mt-auto">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-badge border micro-label bg-status-success-bg border-status-success-border text-status-success">
              <span className="w-1.5 h-1.5 rounded-full bg-status-success"></span>
              Gateway Online
            </span>
            <span>© 2025 Majal Telecommunications Ltd.</span>
          </div>
          <div className="flex items-center gap-4 text-text-secondary">
            <a className="hover:text-primary transition-colors font-mono tabular-nums" href="tel:+254700000000">
              +254 700 000 000
            </a>
            <span className="text-border-subtle">•</span>
            <a className="hover:text-primary transition-colors" href="mailto:support@majalisp.com">
              support@majalisp.com
            </a>
            <span className="text-border-subtle">•</span>
            <Link to="/admin/login" className="hover:text-primary transition-colors font-medium">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default CustomerPortal
