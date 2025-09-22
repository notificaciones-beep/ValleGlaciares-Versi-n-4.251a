import { LocalDB, VendorKey } from './types'

export const LS_NEXTIDS = 'vg_nextIds'
export const LS_PASSWORDS = 'vg_passwords'
export const LS_DB = 'vg_db'
export const LS_VISOR_FECHA = 'vg_visor_fecha'
export const LS_VISOR_COLWIDTHS = 'vg_visor_colwidths'

export function loadJSON<T>(key:string, fallback:T): T {
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback }catch{ return fallback }
}
export function saveJSON(key:string, value:any){ try{ localStorage.setItem(key, JSON.stringify(value)) }catch{} }

export const VENDORS: Record<VendorKey, {name:string, prefix:string, start:number, end:number}> = {
  javier:  { name: 'Javier',  prefix: 'A', start: 1, end:1000 },
  vicente: { name: 'Vicente', prefix: 'B', start: 1, end:1000 },
  eli:     { name: 'Eli',     prefix: 'C', start: 1, end:1000 },
  otro:    { name: 'Otro',    prefix: 'D', start: 1, end:1000 },
}
export const DEFAULT_PASSWORDS: Record<VendorKey, string> = { javier:'1234', vicente:'1234', eli:'1234', otro:'1234' }
