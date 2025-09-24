import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'

// --- PANIC, SIN HOOKS (seguro a nivel de módulo) ---
if (typeof window !== 'undefined' && window.location.search.includes('panic=1')) {
  try {
    localStorage.removeItem('vg_vendor')
    localStorage.removeItem('vg_vendor_overrides')
    Object.keys(localStorage)
      .filter(k => /^sb-.*-auth-token$/.test(k))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
  window.location.replace(window.location.origin)
}
// --- fin PANIC ---

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
