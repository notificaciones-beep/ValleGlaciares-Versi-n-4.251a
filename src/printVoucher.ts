import { VoucherData } from './types'
import { CLP, esc } from './utils'

export function printVoucher(v: VoucherData){
  // FIX: map((p,i)=> `...`)  — sin paréntesis extra
  const rows = v.pasajeros.map((p, i)=> `
    <tr>
      <td>${i+1}</td>
      <td>${esc(p.nombre) || '-'}</td>
      <td>${esc(p.doc) || '-'}</td>
      <td>${esc(p.nacionalidad) || '-'}</td>
      <td>${esc(p.telefono) || '-'}</td>
      <td>${esc(p.email) || '-'}</td>
      <td>${esc(p.categoria)}</td>
      <td>${p.capillas ? 'Sí' : 'No'}</td>
      <td>${esc(p.grupo || '-')}</td>
    </tr>
  `).join('')

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Voucher ${esc(v.codigo)}</title>
<style>
  body{font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:18px;}
  h1{font-size:18px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .tot{margin-top:10px;border-top:1px solid #ddd;padding-top:8px}
</style></head>
<body>
  <h1>ValleGlaciares · Voucher de Reserva</h1>
  <div class="grid">
    <div><b>Código:</b> ${esc(v.codigo)}</div>
    <div><b>Vendedor:</b> ${esc(v.vendedor)}</div>
    <div><b>Fecha LSR:</b> ${esc(v.fechaLSR || "(por definir)")}</div>
  </div>

  <div class="tot">
    <div><b>Laguna San Rafael</b></div>
    <div>Subtotal LSR: ${CLP(v.lsrSubtotal)}</div>
    <div>Dcto. LSR: - ${CLP(v.lsrDcto)}</div>
    <div>Transporte: ${CLP(v.transporte)}</div>
    <div><b>Total LSR:</b> ${CLP(v.totalLSR)}</div>
  </div>

  <div class="tot">
    <div><b>Capillas de Mármol ${v.promoTipo ? "(" + v.promoTipo + ")" : ""}</b></div>
    <div>Subtotal Capillas: ${CLP(v.promoSubtotal)}</div>
    <div>Dcto. Capillas: - ${CLP(v.promoDcto)}</div>
    <div><b>Total Capillas:</b> ${CLP(v.totalPromo)}</div>
  </div>

  <div class="tot">
    <div><b>Total Cotización:</b> ${CLP(v.totalCotizacion)}</div>
    <div>Pagado: ${CLP(v.pagado)}</div>
    <div><b>Saldo:</b> ${CLP(v.saldo)}</div>
  </div>
  ${v.observaciones ? `<div class="tot"><b>Observaciones:</b> ${esc(v.observaciones)}</div>` : ''}

  <h1>Pasajeros</h1>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Nombre</th><th>Doc</th><th>Nacionalidad</th><th>Teléfono</th><th>Email</th><th>LSR</th><th>Capillas</th><th>Grupo</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <script>window.addEventListener('load',()=>{ window.print(); });</script>
</body></html>`;

  const w = window.open('', '_blank')
  if(!w){ alert('Tu navegador bloqueó la ventana de impresión. Habilita pop-ups para este sitio.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
