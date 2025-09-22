// src/localRates.ts
import { RatesLSR, RatesPromo } from './types'

export const ratesLSR: RatesLSR = {
  alta: { adulto: 155000, nino: 90000, infante: 0 },
  baja: { adulto: 145000, nino: 80000, infante: 0 }
}

export const transportPerPerson = 25000

export const ratesPromo: RatesPromo = {
  FM: { adulto: 28000, nino: 28000, infante: 28000 },
  CM: { adulto: 15000, nino: 15000, infante: 15000 }
}
