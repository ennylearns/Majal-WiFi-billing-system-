import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wifi, Check, Clock, Zap, CreditCard, Download, AlertCircle, MapPin, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDuration } from '../utils/formatters'
import { publicAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { Plan, PublicRouter } from '../types'

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

  const rawRouterParam = searchParams.get('routerId') || searchParams.get('router')

  useEffect(() => {
    loadPortalData()
  }, [rawRouterParam])

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
        amount: plan.price
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

            if (sessionToken) {
              await connectToInternet(sessionToken, plan)
            } else {
              const defaultExpiry = new Date(Date.now() + plan.duration * 3600 * 1000).toISOString()
              setConnectedSession({
                plan: plan.name,
                endTime: defaultExpiry
              })
              setPaymentStatus('connected')
              setConnectionStatus('connected')
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

  const connectToInternet = async (sessionToken: string, plan: Plan) => {
    try {
      const response = await publicAPI.connect({ sessionToken })
      setConnectionStatus('connected')
      setPaymentStatus('connected')

      const sessionPlan = response.data?.session?.plan || plan.name
      const sessionEndTime = response.data?.session?.endTime || new Date(Date.now() + plan.duration * 3600 * 1000).toISOString()

      setConnectedSession({
        plan: sessionPlan,
        endTime: sessionEndTime
      })
      toast.success('Connected to internet successfully!')
    } catch (error) {
      // Session exists even if MikroTik disconnects
      setConnectionStatus('connected')
      setPaymentStatus('connected')
      setConnectedSession({
        plan: plan.name,
        endTime: new Date(Date.now() + plan.duration * 3600 * 1000).toISOString()
      })
    }
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

  const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
          <Wifi className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
        {plan.router?.location && (
          <div className="inline-flex items-center text-xs font-medium text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full mb-3">
            <MapPin className="w-3 h-3 mr-1" />
            {plan.router.location}
          </div>
        )}
        {plan.description && (
          <p className="text-gray-600 mb-4">{plan.description}</p>
        )}

        <div className="text-3xl font-bold text-primary-600 mb-4">
          {formatCurrency(plan.price)}
          <span className="text-sm text-gray-500 font-normal">/{formatDuration(plan.duration)}</span>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center text-sm text-gray-600">
            <Zap className="w-4 h-4 mr-2 text-green-500" />
            Speed: {plan.speedLimit}
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <Download className="w-4 h-4 mr-2 text-blue-500" />
            Data: {plan.dataLimit}
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <Clock className="w-4 h-4 mr-2 text-green-500" />
            Valid for {formatDuration(plan.duration)}
          </div>
        </div>

        <button
          onClick={() => handlePay(plan)}
          disabled={loading}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center"
        >
          {loading && selectedPlan?.id === plan.id ? (
            <>
              <div className="loading-spinner mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay {formatCurrency(plan.price)}
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Wifi className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">COLLOSPOT</h1>
            </div>
            <p className="text-lg text-gray-600 mb-2">Smart WiFi Billing for the Modern Network</p>
            <p className="text-sm text-gray-500 italic">"Connect. Pay. Browse — Seamlessly."</p>

            {/* Badges / Location Bar */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {/* Connection Status */}
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100">
                <div
                  className={`w-3 h-3 rounded-full mr-2 ${
                    connectionStatus === 'connected' ? 'bg-green-500 pulse-dot' : 'bg-gray-400'
                  }`}
                ></div>
                <span className="text-sm font-medium">
                  {connectionStatus === 'connected' ? 'Connected to Internet' : 'Not Connected'}
                </span>
              </div>

              {/* Active Location Display */}
              {selectedRouter && !isChangingLocation && (
                <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary-50 border border-primary-200 text-sm text-gray-700 shadow-sm">
                  <MapPin className="w-4 h-4 text-primary-600 mr-2 flex-shrink-0" />
                  <span>
                    Connected at: <strong className="text-gray-900 font-semibold">{selectedRouter.location || selectedRouter.name}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsChangingLocation(true)}
                    className="ml-3 text-xs font-semibold text-primary-600 hover:text-primary-800 underline transition-colors"
                  >
                    Change location
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Location Selector and Warning Banner */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Unrecognized router parameter warning notice */}
        {unrecognizedParam && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-3 text-amber-900 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">
                Unrecognized hotspot location: <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-amber-900">{unrecognizedParam}</span>
              </p>
              <p className="text-xs text-amber-700 mt-1">
                The router parameter provided does not match any active hotspot location. Please select your current location from the dropdown below to view available plans.
              </p>
            </div>
          </div>
        )}

        {/* Location selector dropdown: shown when missing, unrecognized, or user clicked "Change location" */}
        {(!selectedRouter || isChangingLocation) && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 text-gray-900 font-semibold text-base mb-1">
                  <MapPin className="w-5 h-5 text-primary-600" />
                  <span>Choose Your Hotspot Location</span>
                </div>
                <p className="text-xs text-gray-500">
                  Select where you are connected to view internet plans for your area.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <select
                  value={selectedRouter?.id || ''}
                  onChange={(e) => handleSelectLocation(e.target.value)}
                  className="w-full md:w-64 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900 shadow-sm"
                >
                  <option value="" disabled>-- Select a Location --</option>
                  {routers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.location ? `${r.location} (${r.name})` : r.name}
                    </option>
                  ))}
                </select>
                {selectedRouter && isChangingLocation && (
                  <button
                    type="button"
                    onClick={() => setIsChangingLocation(false)}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plans Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Internet Plan</h2>
          <p className="text-gray-600">
            {selectedRouter
              ? `Showing plans available for ${selectedRouter.location || selectedRouter.name}`
              : 'Select your location above to see available plans'}
          </p>
        </div>

        {loadingData ? (
          <div className="text-center py-16">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Loading available plans...</p>
          </div>
        ) : !selectedRouter ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-primary-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Location Required</h3>
            <p className="text-sm text-gray-600 mb-6">
              Please choose your hotspot location above to see available internet plans and pricing.
            </p>
          </div>
        ) : displayedPlans.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300 p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wifi className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No Plans Available</h3>
            <p className="text-sm text-gray-600 mb-6">
              There are currently no active internet plans available for <strong>{selectedRouter.location || selectedRouter.name}</strong>.
            </p>
            <button
              onClick={() => setIsChangingLocation(true)}
              className="inline-flex items-center px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium text-sm shadow-sm"
            >
              Change Location
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {displayedPlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )}

        {/* How it Works */}
        <div className="mt-16 bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-primary-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Choose Plan</h3>
              <p className="text-sm text-gray-600">Select the internet plan that suits your needs</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Pay Securely</h3>
              <p className="text-sm text-gray-600">Pay with card or bank transfer via Paystack</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Auto Connect</h3>
              <p className="text-sm text-gray-600">System automatically connects you to internet</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Start Browsing</h3>
              <p className="text-sm text-gray-600">Enjoy high-speed internet access immediately</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment / Status Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {paymentStatus === 'completed' || paymentStatus === 'connected'
                  ? 'Access Granted'
                  : 'Payment Checkout'}
              </h2>
              <button
                onClick={() => {
                  setShowPayment(false)
                  if (paymentStatus === 'cancelled') {
                    setPaymentStatus(null)
                  }
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Initiating State */}
            {paymentStatus === 'initiating' && (
              <div className="text-center py-8">
                <div className="loading-spinner mx-auto mb-4"></div>
                <h3 className="text-lg font-medium mb-2">Opening Paystack Checkout</h3>
                <p className="text-gray-600 mb-4">
                  Please complete payment in the Paystack window...
                </p>
                {selectedPlan && (
                  <div className="p-4 bg-gray-50 rounded-lg text-left">
                    <h4 className="font-semibold text-gray-900">{selectedPlan.name}</h4>
                    <p className="text-xl font-bold text-primary-600">{formatCurrency(selectedPlan.price)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Verifying / Polling State */}
            {paymentStatus === 'verifying' && (
              <div className="text-center py-8">
                <div className="loading-spinner mx-auto mb-4"></div>
                <h3 className="text-lg font-medium mb-2">Confirming Payment</h3>
                <p className="text-gray-600 mb-4">
                  Verifying your transaction with Paystack and connecting you...
                </p>
              </div>
            )}

            {/* Cancelled State */}
            {paymentStatus === 'cancelled' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">Payment Cancelled</h3>
                <p className="text-gray-600 mb-6 font-medium">Payment cancelled — try again</p>
                <button
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Success Screen: Plan Name & Session Expiry */}
            {(paymentStatus === 'completed' || paymentStatus === 'connected') && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Confirmed!</h3>
                <p className="text-gray-600 mb-6">You are now connected to the internet.</p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left mb-6 space-y-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-green-700 font-semibold block">
                      Plan Name
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      {connectedSession?.plan || selectedPlan?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wider text-green-700 font-semibold block">
                      Session Expiry
                    </span>
                    <span className="text-base font-medium text-green-900">
                      {formatExpiry(connectedSession?.endTime)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowPayment(false)
                    setSelectedPlan(null)
                  }}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Start Browsing
                </button>
              </div>
            )}

            {/* Failed State */}
            {paymentStatus === 'failed' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">Payment Failed</h3>
                <p className="text-gray-600 mb-6">Your payment could not be completed. Please try again.</p>
                <button
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Timeout State */}
            {paymentStatus === 'timeout' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">Payment Verification Timeout</h3>
                <p className="text-gray-600 mb-6">
                  We could not verify your payment immediately. If you were debited, your session will activate shortly.
                </p>
                <button
                  onClick={() => {
                    setPaymentStatus(null)
                    setShowPayment(false)
                  }}
                  className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Wifi className="w-6 h-6 text-primary-400 mr-2" />
              <span className="text-xl font-bold">COLLOSPOT</span>
            </div>
            <p className="text-gray-400 mb-4">Smart WiFi Billing for the Modern Network</p>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-400">
              <span>📞 Support: +254 700 000 000</span>
              <span>📧 support@collospot.com</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default CustomerPortal