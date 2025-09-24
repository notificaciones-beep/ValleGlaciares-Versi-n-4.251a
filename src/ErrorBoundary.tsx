import React from 'react'

type State = { hasError: boolean; err?: any }

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(err: any) { return { hasError: true, err } }
  componentDidCatch(err: any, info: any) { console.error('[VG] UI crash capturado', err, info) }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:20, fontFamily:'system-ui'}}>
          <h3>Ups, algo falló</h3>
          <p>Por favor recarga la página. Si persiste, usa el botón de “panic” que limpia la sesión.</p>
          <button onClick={()=>{
            try {
              localStorage.removeItem('vg_vendor')
              localStorage.removeItem('vg_vendor_overrides')
              Object.keys(localStorage).filter(k=>/^sb-.*-auth-token$/.test(k)).forEach(k=>localStorage.removeItem(k))
            } catch {}
            location.replace(location.origin)
          }}>Limpiar sesión y recargar</button>
        </div>
      )
    }
    return this.props.children
  }
}
