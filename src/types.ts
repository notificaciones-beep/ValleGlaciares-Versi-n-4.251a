/** Tipos compartidos */

export type VendorKey = 'javier'|'vicente'|'eli'|'otro'

export type MedioPago = string
export type Payment = { medio: MedioPago, monto: number, comprobante?: string }
export type CategoriaLSR = 'adulto'|'nino'|'infante'

export type Passenger = {
  nombre:string, doc:string, nacionalidad:string, telefono:string, email:string,
  categoria: CategoriaLSR, capillas: boolean, grupo: string
}

export interface VoucherData {
  codigo: string
  vendedor: string
  fechaLSR: string
  fechaPromo?: string   // ← NUEVO: fecha Capillas de Mármol
  lsrSubtotal: number
  lsrDcto: number
  transporte: number
  totalLSR: number
  promoTipo?: 'FM' | 'CM'
  proveedor?: string    
  promoSubtotal: number
  promoDcto: number
  totalPromo: number
  totalCotizacion: number
  pagado: number
  saldo: number
  pasajeros: any[]
  observaciones?: string
}


export type BasePasajerosRow = {
  createdAt: string; estado: 'pre-reserva'|'reserva';
  vendedor: string; id: string; ng: string;
  nombre: string; doc: string; nacionalidad: string; telefono: string; email: string;
  lsr_categoria: CategoriaLSR; transporte: 'si'|'no';
  lsr_valor: number; transp_valor: number; lsr_descuento: number;
  cm_categoria?: 'adulto'|'infante'|''; proveedor?: string; fecha_cm?: string;
  cm_valor: number; cm_descuento: number;
  observaciones?: string; fecha_lsr?: string;
}

export type BasePagosRow = {
  createdAt: string; vendedor: string; id: string;
  medio: MedioPago; monto: number; comprobante?: string;
}

export type LocalDB = {
  base_pasajeros: BasePasajerosRow[];
  base_pagos: BasePagosRow[];
  history: { vendedor: VendorKey; id: string; snapshot: VoucherData; createdAt: string }[];
}

export type RatesLSR = Record<'alta'|'baja', { adulto:number, nino:number, infante:number }>
export type RatesPromo = Record<'FM'|'CM', { adulto:number, nino:number, infante:number }>
export type AdminRatesSeason = { adulto:number; nino:number; infante:number }
export type AdminRatesLSR = { alta:AdminRatesSeason; baja:AdminRatesSeason }
export type AdminTransport = { alta:number; baja:number }
export type AdminRatesPromo = { FM:AdminRatesSeason; CM:AdminRatesSeason }

export type EffectiveConfig = {
  bajaMonths: number[];
  altaMonths: number[];
  ratesLSR: AdminRatesLSR;
  transport: AdminTransport;
  ratesPromo: AdminRatesPromo;
  proveedores: string[];
  mediosPago: string[];
}

export type VendorOverride = Partial<{
  name:string; prefix:string; start:number; end:number
}>
export type VendorOverridesMap = Partial<Record<string, VendorOverride>>

