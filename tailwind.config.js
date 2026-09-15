/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb', // Electric Cobalt Blue
          600: '#1d4ed8',
          700: '#1e40af',
        },
        workshop: {
          canvas: '#f8fafc', // Muted Pearl Canvas
          card: '#ffffff', // Crisp White Card
          border: '#e2e8f0', // Subtle Titanium Border
          borderHover: '#cbd5e1',
          sidebar: '#0f172a', // Dark Graphite Sidebar
          textDark: '#0f172a',
          textMuted: '#64748b',
          textLight: '#94a3b8',
        },
        status: {
          mint: '#059669', // Resolved / Todo bajo control
          mintBg: '#ecfdf5',
          mintBorder: '#a7f3d0',
          amber: '#d97706', // Exception / Necesita tu aprobación
          amberBg: '#fffbeb',
          amberBorder: '#fde68a',
          rose: '#dc2626', // Real Fault
          roseBg: '#fef2f2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
