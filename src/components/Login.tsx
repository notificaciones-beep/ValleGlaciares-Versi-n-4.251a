import React, { useState } from 'react'
import { VendorKey } from '../types'
import { DEFAULT_PASSWORDS, VENDORS } from '../state'

const LS_VENDOR_OVERRIDES = 'vg_vendor_overrides'
function getEffectiveVendors(){
  const raw = localStorage.getItem(LS_VENDOR_OVERRIDES)
  const overrides = raw ? JSON.parse(raw) as Record<string, Partial<{ name:string; prefix:string; start:number; end:number }>> : {}

  // Base: SOLO 'javier' (que mostraremos como Admin por defecto)
  const merged: Record<string, { name:string; prefix:string; start:number; end:number }> = {} as any
  if ((VENDORS as any)['javier']) {
    merged['javier'] = { ...(VENDORS as any)['javier'] }
  }
  // renombre por defecto: si no hay override para 'javier', mostrar 'Admin'
  if (!overrides['javier']) overrides['javier'] = { name: 'Admin' }

  // aplicar overrides y AGREGAR NUEVOS (solo vienen de overrides, no del resto de VENDORS)
  for (const [key, ov] of Object.entries(overrides)) {
    const base = merged[key] || { name: key, prefix: (key[0]||'X').toUpperCase(), start: 1, end: 999 }
    merged[key] = { ...base, ...ov }
  }
  return merged
}


export default function Login({onLogin, getPwd}:{onLogin:(v:string)=>void, getPwd:(v:string)=>string}){
  const [vendor, setVendor] = useState<string>('javier')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')

  const [, force] = React.useReducer(x => x + 1, 0)
  React.useEffect(() => {
    const onStorage = () => force()
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function submit(e:React.FormEvent){
    e.preventDefault()
    if(pwd.trim() === getPwd(vendor)){
      localStorage.setItem('vg_vendor', vendor)
      onLogin(vendor)
    }else setErr('Contraseña incorrecta.')
  }

  return (
    <div style={{display:'grid',placeItems:'center',minHeight:'100vh',padding:16}}>
      <form style={{maxWidth:680,width:'100%',border:'1px solid #e5e7eb',borderRadius:12}} onSubmit={submit}>
        <div style={{padding:16}}>
          <h1 style={{marginTop:0}}>Ingresar</h1>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label>Vendedor</label>
              <select value={vendor} onChange={e=>setVendor(e.target.value)}>
              {Object.entries(getEffectiveVendors()).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.name} ({meta.prefix}{String(meta.start).padStart(4,'0')}–{meta.prefix}{String(meta.end).padStart(4,'0')})
                  </option>
                  ))}
                  </select>
                
                
            </div>
            <div>
              <label>Contraseña (demo: 1234)</label>
              <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••" />
            </div>
          </div>
          {err && <div style={{marginTop:10,color:'#b91c1c'}}>{err}</div>}
          <div style={{marginTop:12}}>
            <button type="submit">Entrar</button>
          </div>
        </div>
      </form>
    </div>
  )
}
