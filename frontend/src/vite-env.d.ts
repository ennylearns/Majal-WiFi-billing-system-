/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_BUSINESS_NAME?: string
  readonly VITE_SYSTEM_NAME?: string
  readonly VITE_COMPANY_NAME?: string
  readonly VITE_SUPPORT_EMAIL?: string
  readonly VITE_SUPPORT_PHONE?: string
  readonly VITE_TIMEZONE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
