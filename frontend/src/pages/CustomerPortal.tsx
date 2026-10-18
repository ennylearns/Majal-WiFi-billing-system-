import React, { useState, useEffect, useRef } from 'react'
import { Wifi, Check, Clock, Zap, CreditCard, Download, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDuration } from '../utils/formatters'
import { publicAPI } from '../services/api'
import toast from 'react-hot-toast'
import type { Plan } from '../types'

interface ConnectedSessionInfo {
  plan: string
  endTime?: string
}

const CustomerPortal: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [connectedSession, setConnectedSession] = useState<ConnectedSessionInfo | null>(null)
  const isPaymentConfirmedRef = useRef(false)

  useEffect(() => {
    fetchPlans()
  }, [])

  const fetchPlans = async () => {
    try {
      const response = await publicAPI.getPlans()
      if (response.success && response.data) {
        setPlans(response.data)
      }
    } catch (error) {
      toast.error('Failed to load plans')
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

  const PlanCard: React.FC<{ plan: Plan }> = ({ plan }) => (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
          <Wifi className="w-6 h-6 text-primary-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
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
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Wifi className="w-8 h-8 text-primary-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">COLLOSPOT</h1>
            </div>
            <p className="text-lg text-gray-600 mb-2">Smart WiFi Billing for the Modern Network</p>
            <p className="text-sm text-gray-500 italic">"Connect. Pay. Browse — Seamlessly."</p>

            {/* Connection Status */}
            <div className="mt-6 inline-flex items-center px-4 py-2 rounded-full bg-gray-100">
              <div
                className={`w-3 h-3 rounded-full mr-2 ${
                  connectionStatus === 'connected' ? 'bg-green-500 pulse-dot' : 'bg-gray-400'
                }`}
              ></div>
              <span className="text-sm font-medium">
                {connectionStatus === 'connected' ? 'Connected to Internet' : 'Not Connected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose Your Internet Plan</h2>
          <p className="text-gray-600">Select a plan, pay securely via Paystack, and get instant internet access</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

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