import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Wifi, DollarSign, Bell, ArrowRight } from 'lucide-react'

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general')

  const generalConfig = {
    businessName: import.meta.env.VITE_BUSINESS_NAME || import.meta.env.VITE_SYSTEM_NAME || 'Majal ISP',
    companyName: import.meta.env.VITE_COMPANY_NAME || 'Majal ISP Ltd',
    supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@majalisp.com',
    supportPhone: import.meta.env.VITE_SUPPORT_PHONE || '+254700000000',
    timezone: import.meta.env.VITE_TIMEZONE || 'Africa/Nairobi'
  }

  const paystackConfig = {
    webhookUrl: import.meta.env.VITE_PAYSTACK_WEBHOOK_URL || '/api/public/payment/paystack/webhook',
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder',
    secretKey: '••••••••••••••••••••••••••••••••'
  }

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'paystack', name: 'Paystack', icon: DollarSign },
    { id: 'router', name: 'Router', icon: Wifi },
    { id: 'notifications', name: 'Notifications', icon: Bell }
  ]

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p>System configuration values are read-only and sourced from deployment environment variables.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">Business / System Name</label>
          <input
            id="businessName"
            type="text"
            readOnly
            value={generalConfig.businessName}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
          <input
            id="companyName"
            type="text"
            readOnly
            value={generalConfig.companyName}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="supportEmail" className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
          <input
            id="supportEmail"
            type="email"
            readOnly
            value={generalConfig.supportEmail}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="supportPhone" className="block text-sm font-medium text-gray-700 mb-2">Support Phone</label>
          <input
            id="supportPhone"
            type="tel"
            readOnly
            value={generalConfig.supportPhone}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
          <input
            id="timezone"
            type="text"
            readOnly
            value={generalConfig.timezone}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed focus:outline-none"
          />
        </div>
      </div>
    </div>
  )

  const renderPaystackSettings = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Webhook Configuration</p>
        <p>Register the webhook URL <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-xs">{paystackConfig.webhookUrl}</code> in your Paystack dashboard under <strong>Settings → API Keys &amp; Webhooks</strong>.</p>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p>Paystack integration values are configured via deployment environment variables. Secret key is masked and protected on the server.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="paystackPublicKey" className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
          <input
            id="paystackPublicKey"
            type="text"
            readOnly
            value={paystackConfig.publicKey}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed font-mono text-sm focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="paystackSecretKey" className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
          <input
            id="paystackSecretKey"
            type="text"
            readOnly
            value={paystackConfig.secretKey}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed font-mono text-sm focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="paystackWebhookUrl" className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
          <input
            id="paystackWebhookUrl"
            type="text"
            readOnly
            value={paystackConfig.webhookUrl}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed font-mono text-sm focus:outline-none"
          />
        </div>
      </div>
    </div>
  )

  const renderRouterTab = () => (
    <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-xl text-center space-y-4">
      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
        <Wifi className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Router Management</h3>
        <p className="text-sm text-gray-600 mt-1">
          Router configuration, credentials, status diagnostics, and provisioning scripts are managed centrally under Routers.
        </p>
      </div>
      <div>
        <Link
          to="/admin/routers"
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Go to Routers Management
          <ArrowRight className="w-4 h-4 ml-2" />
        </Link>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p>Notification channels are configured via server environment variables.</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
            <p className="text-sm text-gray-500">Alerts sent via configured SMTP provider</p>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
            Active (Env)
          </span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
            <p className="text-sm text-gray-500">Alerts sent via Africa's Talking provider</p>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
            Active (Env)
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Environment configuration and deployment settings</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'paystack' && renderPaystackSettings()}
          {activeTab === 'router' && renderRouterTab()}
          {activeTab === 'notifications' && renderNotificationSettings()}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
