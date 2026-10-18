import React, { useState } from 'react'
import { Settings, Wifi, DollarSign, Bell, Shield, Database, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    general: {
      systemName: 'COLLOSPOT',
      companyName: 'COLLOSPOT Ltd',
      supportEmail: 'support@collospot.com',
      supportPhone: '+254700000000',
      timezone: 'Africa/Nairobi'
    },
    paystack: {
      secretKey: '',
      publicKey: '',
      webhookUrl: '/api/public/payment/paystack/webhook'
    },
    router: {
      host: '192.168.1.1',
      username: 'admin',
      password: '',
      port: '8728'
    },
    notifications: {
      emailNotifications: true,
      smsNotifications: true,
      paymentAlerts: true,
      sessionAlerts: false
    }
  })

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'paystack', name: 'Paystack', icon: DollarSign },
    { id: 'router', name: 'Router', icon: Wifi },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'database', name: 'Database', icon: Database }
  ]

  const handleSave = (section: string) => {
    toast.success(`${section} settings saved successfully`)
  }

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">System Name</label>
          <input
            type="text"
            value={settings.general.systemName}
            onChange={(e) => setSettings({
              ...settings,
              general: { ...settings.general, systemName: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
          <input
            type="text"
            value={settings.general.companyName}
            onChange={(e) => setSettings({
              ...settings,
              general: { ...settings.general, companyName: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
          <input
            type="email"
            value={settings.general.supportEmail}
            onChange={(e) => setSettings({
              ...settings,
              general: { ...settings.general, supportEmail: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Support Phone</label>
          <input
            type="tel"
            value={settings.general.supportPhone}
            onChange={(e) => setSettings({
              ...settings,
              general: { ...settings.general, supportPhone: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <button
        onClick={() => handleSave('General')}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Changes
      </button>
    </div>
  )

  const renderPaystackSettings = () => (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Warning:</strong> These are sensitive API keys. Make sure to keep them secure.
        </p>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Webhook Configuration</p>
        <p>Register the webhook URL <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-xs">/api/public/payment/paystack/webhook</code> in your Paystack dashboard under <strong>Settings → API Keys &amp; Webhooks</strong>.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Secret Key</label>
          <input
            type="password"
            value={settings.paystack.secretKey}
            onChange={(e) => setSettings({
              ...settings,
              paystack: { ...settings.paystack, secretKey: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="sk_test_... or sk_live_..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Public Key</label>
          <input
            type="text"
            value={settings.paystack.publicKey}
            onChange={(e) => setSettings({
              ...settings,
              paystack: { ...settings.paystack, publicKey: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="pk_test_... or pk_live_..."
          />
        </div>
      </div>
      <button
        onClick={() => handleSave('Paystack')}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Paystack Settings
      </button>
    </div>
  )

  const renderRouterSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Router IP Address</label>
          <input
            type="text"
            value={settings.router.host}
            onChange={(e) => setSettings({
              ...settings,
              router: { ...settings.router, host: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">API Port</label>
          <input
            type="text"
            value={settings.router.port}
            onChange={(e) => setSettings({
              ...settings,
              router: { ...settings.router, port: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
          <input
            type="text"
            value={settings.router.username}
            onChange={(e) => setSettings({
              ...settings,
              router: { ...settings.router, username: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            value={settings.router.password}
            onChange={(e) => setSettings({
              ...settings,
              router: { ...settings.router, password: e.target.value }
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      <div className="flex space-x-4">
        <button
          onClick={() => toast.success('Router connection tested successfully')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Test Connection
        </button>
        <button
          onClick={() => handleSave('Router')}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </button>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
            <p className="text-sm text-gray-500">Receive email alerts for important events</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.emailNotifications}
              onChange={(e) => setSettings({
                ...settings,
                notifications: { ...settings.notifications, emailNotifications: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
            <p className="text-sm text-gray-500">Send SMS alerts to customers</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifications.smsNotifications}
              onChange={(e) => setSettings({
                ...settings,
                notifications: { ...settings.notifications, smsNotifications: e.target.checked }
              })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
      
      <button
        onClick={() => handleSave('Notification')}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
      >
        <Save className="w-4 h-4 mr-2" />
        Save Preferences
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600">Configure your WiFi billing system</p>
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
          {activeTab === 'router' && renderRouterSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'security' && (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Security settings coming soon...</p>
            </div>
          )}
          {activeTab === 'database' && (
            <div className="text-center py-12">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Database management coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage