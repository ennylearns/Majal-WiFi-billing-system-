import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Copy,
  Check,
  Terminal,
  Loader2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

interface ProvisioningScriptModalProps {
  isOpen: boolean
  onClose: () => void
  router: {
    id: string
    name: string
    location?: string
  } | null
}

const ProvisioningScriptModal: React.FC<ProvisioningScriptModalProps> = ({
  isOpen,
  onClose,
  router,
}) => {
  const [script, setScript] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<boolean>(false)

  const fetchScript = useCallback(async (routerId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminAPI.getProvisionScript(routerId)
      const scriptContent = res.data?.script || res.script || ''
      if (scriptContent) {
        setScript(scriptContent)
      } else {
        setError('Empty script returned from server')
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to load provisioning script'
      setError(errMsg)
      toast.error('Failed to load provisioning script')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && router?.id) {
      setCopied(false)
      fetchScript(router.id)
    } else {
      setScript('')
      setError(null)
      setCopied(false)
    }
  }, [isOpen, router?.id, fetchScript])

  if (!isOpen || !router) return null

  const handleCopy = async () => {
    if (!script) return
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      toast.success('Provisioning script copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-indigo-50/20 to-purple-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md text-white flex-shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Router Provisioning Script
              </h2>
              <p className="text-xs text-gray-500">
                Setup config for <span className="font-semibold text-gray-700">{router.name}</span>
                {router.location && (
                  <span className="ml-1 text-gray-400">({router.location})</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* 3-Step Winbox Instructions */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white p-4 rounded-xl border border-indigo-100/80">
            <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Winbox Setup Instructions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="flex items-start gap-2.5 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-indigo-50 shadow-sm">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  1
                </span>
                <div>
                  <span className="font-semibold text-gray-800 block">Step 1: Connect</span>
                  <span className="text-gray-600 leading-snug">
                    Open <strong className="font-medium text-gray-900">Winbox</strong> and connect to your MikroTik router.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-indigo-50 shadow-sm">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  2
                </span>
                <div>
                  <span className="font-semibold text-gray-800 block">Step 2: Terminal</span>
                  <span className="text-gray-600 leading-snug">
                    In the left navigation menu, open <strong className="font-medium text-gray-900">New Terminal</strong>.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-indigo-50 shadow-sm">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  3
                </span>
                <div>
                  <span className="font-semibold text-gray-800 block">Step 3: Paste & Run</span>
                  <span className="text-gray-600 leading-snug">
                    Paste the script below into the terminal and press <strong className="font-medium text-gray-900">Enter</strong>.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Script Content / Loading / Error */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500 bg-gray-50/50 rounded-xl border border-gray-100">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Loading provisioning script…</span>
            </div>
          ) : error ? (
            <div className="py-12 px-6 flex flex-col items-center justify-center gap-3 text-center bg-red-50/50 rounded-xl border border-red-100">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="text-sm font-medium text-red-800">Failed to load provisioning script</p>
              <p className="text-xs text-red-600 max-w-md">{error}</p>
              <button
                onClick={() => fetchScript(router.id)}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-700">Generated RouterOS v7 Script</span>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-medium rounded-full">
                    Idempotent
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shadow-sm ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy Script'}
                </button>
              </div>

              {/* Monospace Code Box */}
              <div className="relative group bg-gray-950 rounded-xl border border-gray-800 overflow-hidden shadow-inner">
                <pre className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto overflow-y-auto max-h-72 leading-relaxed selection:bg-indigo-500 selection:text-white">
                  <code>{script}</code>
                </pre>
              </div>
              <p className="text-[11px] text-gray-500 italic">
                * Note: The script configures WireGuard tunnel, restricted API user, walled garden domains, and captive portal redirect.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Click copy, then paste directly into Winbox Terminal.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              disabled={!script || loading}
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                copied
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProvisioningScriptModal
