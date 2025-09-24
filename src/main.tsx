import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ErrorBoundary'   // ⬅️ NUEVO

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>                          {/* ⬅️ ENVOLTORIO */}
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
