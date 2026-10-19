import axios from 'axios'
import type { 
  ApiResponse, 
  Plan, 
  PaymentRequest, 
  PaymentStatusResponse, 
  ConnectionRequest,
  User,
  DashboardStats,
  Session,
  Payment,
  PaginatedResponse,
  PaymentInitiateData,
  Router,
  PublicRouter,
  CreateRouterData,
  TestConnectionResponse,
  ProvisionScriptResponse
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

// Create axios instances
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

const privateApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Add auth token to private requests
privateApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
privateApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user')
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  }
)

// Public API (Customer Portal)
export const publicAPI = {
  // Routers
  getRouters: (): Promise<ApiResponse<PublicRouter[]>> =>
    publicApi.get('/public/routers').then(res => res.data),

  // Plans
  getPlans: (params?: { routerId?: string; router?: string }): Promise<ApiResponse<Plan[]>> =>
    publicApi.get('/public/plans', { params }).then(res => res.data),

  // User registration/login
  register: (data: {
    phone: string
    email?: string
    firstName?: string
    lastName?: string
  }): Promise<ApiResponse<{ user: User; token: string }>> =>
    publicApi.post('/public/register', data).then(res => res.data),

  login: (data: { phone: string }): Promise<ApiResponse<{ user: User; token: string }>> =>
    publicApi.post('/public/login', data).then(res => res.data),

  // Payments
  makePayment: (data: PaymentRequest): Promise<ApiResponse<PaymentInitiateData> & { reference?: string; access_code?: string }> =>
    publicApi.post('/public/payment', data).then(res => res.data),

  getPaymentStatus: (checkoutRequestId: string): Promise<ApiResponse<PaymentStatusResponse>> =>
    publicApi.get(`/public/payment/status/${checkoutRequestId}`).then(res => res.data),

  // Connection
  connect: (data: ConnectionRequest): Promise<ApiResponse<{ message: string; session: any }>> =>
    publicApi.post('/public/connect', data).then(res => res.data),
}

// Private API (Admin Dashboard)
export const adminAPI = {
  // Auth
  login: (data: { email: string; password: string }): Promise<ApiResponse<{ user: User; token: string }>> =>
    privateApi.post('/auth/admin/login', data).then(res => res.data),

  getProfile: (): Promise<ApiResponse<User>> =>
    privateApi.get('/auth/me').then(res => res.data),

  updateProfile: (data: Partial<User>): Promise<ApiResponse<User>> =>
    privateApi.put('/auth/profile', data).then(res => res.data),

  // Dashboard
  getDashboardStats: (): Promise<ApiResponse<DashboardStats>> =>
    privateApi.get('/admin/dashboard').then(res => res.data),

  // Users
  getUsers: (params?: {
    page?: number
    limit?: number
    search?: string
  }): Promise<ApiResponse<PaginatedResponse<User>>> =>
    privateApi.get('/admin/users', { params }).then(res => res.data),

  // Plans
  getPlans: (): Promise<ApiResponse<Plan[]>> =>
    privateApi.get('/admin/plans').then(res => res.data),

  createPlan: (data: Omit<Plan, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>): Promise<ApiResponse<Plan>> =>
    privateApi.post('/admin/plans', data).then(res => res.data),

  updatePlan: (id: string, data: Partial<Plan>): Promise<ApiResponse<Plan>> =>
    privateApi.put(`/admin/plans/${id}`, data).then(res => res.data),

  deletePlan: (id: string): Promise<ApiResponse<{ message: string }>> =>
    privateApi.delete(`/admin/plans/${id}`).then(res => res.data),

  // Sessions
  getSessions: (params?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<ApiResponse<PaginatedResponse<Session>>> =>
    privateApi.get('/admin/sessions', { params }).then(res => res.data),

  terminateSession: (id: string): Promise<ApiResponse<{ message: string }>> =>
    privateApi.post(`/admin/sessions/${id}/terminate`).then(res => res.data),

  // Payments
  getPayments: (params?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<ApiResponse<PaginatedResponse<Payment>>> =>
    privateApi.get('/admin/payments', { params }).then(res => res.data),

  // Routers
  getRouters: (): Promise<ApiResponse<Router[]>> =>
    privateApi.get('/admin/routers').then(res => res.data),

  createRouter: (data: CreateRouterData): Promise<ApiResponse<Router>> =>
    privateApi.post('/admin/routers', data).then(res => res.data),

  updateRouter: (id: string, data: Partial<Omit<Router, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ApiResponse<Router>> =>
    privateApi.put(`/admin/routers/${id}`, data).then(res => res.data),

  deleteRouter: (id: string): Promise<ApiResponse<{ message: string }>> =>
    privateApi.delete(`/admin/routers/${id}`).then(res => res.data),

  getProvisionScript: (id: string): Promise<ProvisionScriptResponse> =>
    privateApi.get(`/admin/routers/${id}/provision-script`).then(res => res.data),

  testRouterConnection: (id: string): Promise<TestConnectionResponse> =>
    privateApi.post(`/admin/routers/${id}/test-connection`).then(res => res.data),

  // Legacy single-router status
  getRouterStatus: (): Promise<ApiResponse<{ activeUsers: number; users: any[] }>> =>
    privateApi.get('/admin/router/status').then(res => res.data),
}

// User API (Authenticated customers)
export const userAPI = {
  getSessions: (): Promise<ApiResponse<Session[]>> =>
    privateApi.get('/sessions').then(res => res.data),

  getPayments: (): Promise<ApiResponse<Payment[]>> =>
    privateApi.get('/payments').then(res => res.data),

  getPayment: (id: string): Promise<ApiResponse<Payment>> =>
    privateApi.get(`/payments/${id}`).then(res => res.data),
}

export default { publicAPI, adminAPI, userAPI }