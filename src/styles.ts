import React from 'react'

export const th: React.CSSProperties = { textAlign:'left', padding:'8px 10px', borderBottom:'1px solid #e5e7eb', position:'sticky', top:0, background:'#fff', whiteSpace:'nowrap' }
export const td: React.CSSProperties = { padding:'6px 10px', borderBottom:'1px solid #f3f4f6', verticalAlign:'top', whiteSpace:'nowrap' }

export const overlayStyle: React.CSSProperties = {
  position:'fixed', inset:0, background:'rgba(0,0,0,.08)', display:'grid', placeItems:'center', zIndex:50
}
export const dialogStyle: React.CSSProperties = {
  background:'#fff', borderRadius:12, padding:16, minWidth:320, maxWidth:560, boxShadow:'0 10px 30px rgba(0,0,0,.08)'
}
