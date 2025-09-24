import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function AuthLogin() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const signIn = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setMsg(null); setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) {
        setMsg('Credenciales inválidas. Revisa tu email y contraseña.')
        return
      }
      // ok: onAuthStateChange actualizará <App/>
    } catch (_e) {
      setMsg('No pudimos contactar al servidor de autenticación. Inténtalo nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const resetPass = async () => {
    if (!email) { setMsg('Escribe tu email y luego pulsa “Recuperar contraseña”.'); return }
    setMsg(null); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    setLoading(false)
    if (error) setMsg(error.message)
    else setMsg('Si el email existe, te enviamos un enlace para restablecer la contraseña.')
  }

  return (
    <div style={{minHeight:'70vh', display:'grid', placeItems:'center', padding:20, background:'#f6f7f9'}}>
      <form onSubmit={signIn} style={{width:360, maxWidth:'95%', background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, boxShadow:'0 6px 16px rgba(0,0,0,.05)'}}>
        <h2 style={{margin:'0 0 12px 0', color:'#0c3946'}}>Acceder a Valle Glaciares</h2>

        <label style={{display:'block', fontSize:13}}>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="tucorreo@ejemplo.com"
          style={{width:'100%', margin:'6px 0 12px 0', padding:10, borderRadius:8, border:'1px solid #cbd5e1'}} />

        <label style={{display:'block', fontSize:13}}>Contraseña</label>
        <input value={pass} onChange={e=>setPass(e.target.value)} type="password" required placeholder="••••••••"
          style={{width:'100%', margin:'6px 0 16px 0', padding:10, borderRadius:8, border:'1px solid #cbd5e1'}} />

        <button disabled={loading} type="submit"
          style={{width:'100%', padding:'10px 14px', borderRadius:10, background:'#0c3946', color:'#fff', fontWeight:700}}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>

        <div style={{marginTop:10, textAlign:'center'}}>
          <button type="button" onClick={resetPass}
            style={{background:'transparent', border:0, color:'#0c3946', textDecoration:'underline', cursor:'pointer'}}>
            Recuperar contraseña
          </button>
        </div>

        {msg && <div style={{marginTop:12, color:'#b91c1c', fontSize:13}}>{msg}</div>}
      </form>
    </div>
  )
}
