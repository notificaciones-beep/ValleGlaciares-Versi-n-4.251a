import React from 'react'

type State = { hasError: boolean; err?: any }
type Props = React.PropsWithChildren & { label?: string }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, err: null }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, err: error }
  }

  componentDidCatch(error: any, info: any) {
    console.error(`[VG] UI crash capturado (${this.props.label || 'root'})`, error, info)
  }

  handleReset = () => {
    try {
      // Botón de pánico local (solo borra lo mínimo)
      localStorage.removeItem('vg_vendor')
      // Si quieres: limpiar cachés específicas del módulo
    } catch {}
    location.replace(location.origin)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:16, border:'1px solid #fbbf24', background:'#fff7ed', borderRadius:10, margin:'8px 0'}}>
          <div style={{fontWeight:700, color:'#92400e'}}>
            Ocurrió un problema al mostrar esta sección{this.props.label ? `: ${this.props.label}` : ''}.
          </div>
          <div style={{fontSize:13, color:'#92400e', marginTop:6}}>
            Puedes continuar usando el resto de la app o
            <button onClick={this.handleReset} style={{marginLeft:8, padding:'4px 8px'}}>Reintentar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
