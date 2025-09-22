export const CLP = (n:number)=> new Intl.NumberFormat('es-CL', {style:'currency', currency:'CLP', maximumFractionDigits:0}).format(n||0)
export const nInt = (v:any)=> Number.isFinite(Number(v)) ? Number(v) : 0
export const esc = (v:any)=> String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
export const nowISO = ()=> new Date().toISOString()

export function getSeason(dateStr:string){
  if(!dateStr) return 'baja' as const
  const d = new Date(dateStr)
  const altaStart = new Date('2026-01-01')
  const altaEnd   = new Date('2026-02-28')
  const bajaAStart= new Date('2025-10-01')
  const bajaAEnd  = new Date('2025-12-31')
  const bajaBStart= new Date('2026-03-01')
  const bajaBEnd  = new Date('2026-04-30')
  if(d >= altaStart && d <= altaEnd) return 'alta'
  if((d >= bajaAStart && d <= bajaAEnd) || (d >= bajaBStart && d <= bajaBEnd)) return 'baja'
  return 'baja'
}

/** CSV helpers */
function csvEscape(val:any){
  const s = String(val ?? '')
  if(s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replace(/"/g,'""')}"`
  return s
}
export function downloadCSV(filename:string, rows: any[], headers?: string[]){
  if(!rows.length && !headers){ alert('No hay datos para exportar.'); return }
  const keys = headers ?? Object.keys(rows[0] ?? {})
  const lines = [
    keys.join(','), ...rows.map(r => keys.map(k => csvEscape((r as any)[k])).join(','))
  ].join('\n')
  const blob = new Blob([lines], {type:'text/csv;charset=utf-8;'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
