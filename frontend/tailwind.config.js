/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Legacy colour scales (kept until ticket 07 migration) ──────────────
        primary: {
          DEFAULT: '#175CD3',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },

        // ── Design-system surface tokens ───────────────────────────────────────
        'surface-canvas': '#F8FAFC',
        'surface-card':   '#FFFFFF',
        'surface-dim':    '#F1F5F9',

        // ── Border tokens ──────────────────────────────────────────────────────
        'border-subtle': '#E2E8F0',
        'border-strong': '#CBD5E1',

        // ── Text tokens ────────────────────────────────────────────────────────
        'text-primary':     '#0F172A',
        'text-secondary':   '#475569',
        'text-muted':       '#64748B',
        'text-placeholder': '#94A3B8',

        // ── Brand tokens ───────────────────────────────────────────────────────
        'primary-ds':        '#175CD3',
        'primary-hover':     '#154FB3',
        'primary-active':    '#0E3F96',
        'primary-light':     '#EFF6FF',

        // ── Semantic status tokens ─────────────────────────────────────────────
        'status-success':        '#16A34A',
        'status-success-bg':     '#F0FDF4',
        'status-success-border': '#BBF7D0',

        'status-danger':        '#DC2626',
        'status-danger-bg':     '#FEF2F2',
        'status-danger-border': '#FECACA',

        'status-warning':        '#D97706',
        'status-warning-bg':     '#FFFBEB',
        'status-warning-border': '#FDE68A',

        'status-neutral':        '#475467',
        'status-neutral-bg':     '#F1F5F9',
        'status-neutral-border': '#E2E8F0',
      },

      // ── Border radii ─────────────────────────────────────────────────────────
      borderRadius: {
        card:    '12px',
        control: '8px',
        badge:   '6px',
      },

      // ── Font families ─────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      // ── Box shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        card:       '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10), 0 2px 6px -1px rgb(0 0 0 / 0.07)',
        overlay:    '0 10px 24px -4px rgb(0 0 0 / 0.14), 0 4px 10px -3px rgb(0 0 0 / 0.08)',
      },

      // ── Existing animations (preserved) ───────────────────────────────────────
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
