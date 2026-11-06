// types.ts — the Facebook / WhatsApp catalog section: what a product is, and what a catalog backend (live Meta or sample) can do.

export class CatalogError extends Error {
  constructor(message: string, public status = 400, public code = 'invalid_request', public fields?: Record<string, string>) { super(message) }
}

export const AVAILABILITY = ['in stock', 'out of stock'] as const
export const CONDITIONS = ['new', 'refurbished', 'used'] as const

export interface Product {
  retailerId: string            // the SKU / "Content ID": what WhatsApp messages refer to
  name: string
  description: string
  price: number                 // whole currency units (4999.5), never minor units
  currency: string
  salePrice: number | null
  availability: (typeof AVAILABILITY)[number]
  condition: (typeof CONDITIONS)[number]
  imageUrl: string
  url: string
  brand: string
  inventory: number | null
  reviewStatus: string          // approved | pending | rejected | outdated | '' (unknown)
  reviewNote: string
}

export interface CatalogInfo { id: string; name: string; productCount: number | null; vertical: string | null }
export interface PhoneNumber { id: string; display: string; name: string }
export interface Commerce { isCatalogVisible: boolean; isCartEnabled: boolean }

export type WriteOp = { method: 'CREATE' | 'UPDATE' | 'DELETE'; product: Partial<Product> & { retailerId: string } }
export interface BatchResult { sent: number; errors: { retailerId: string; message: string }[]; warnings: { retailerId: string; message: string }[] }

/** A WhatsApp message that shows catalog products (Cloud API "interactive" messages). */
export type OutMessage =
  | { kind: 'product'; to: string; catalogId: string; retailerId: string; body: string; footer: string }
  | { kind: 'products'; to: string; catalogId: string; retailerIds: string[]; header: string; body: string; footer: string; sectionTitle: string }
  | { kind: 'catalog'; to: string; body: string; footer: string; thumbnailRetailerId: string }

export interface CatalogBackend {
  mode: 'live' | 'sample'
  catalogs(): Promise<{ catalogs: CatalogInfo[]; connectedId: string | null; canCreate: boolean }>
  createCatalog(name: string): Promise<CatalogInfo>
  connectToWhatsApp(catalogId: string): Promise<void>
  products(catalogId: string): Promise<{ products: Product[]; truncated: boolean }>
  write(catalogId: string, ops: WriteOp[]): Promise<BatchResult>
  phoneNumbers(): Promise<PhoneNumber[]>
  commerce(phoneNumberId: string): Promise<Commerce>
  setCommerce(phoneNumberId: string, patch: Partial<Commerce>): Promise<Commerce>
  send(phoneNumberId: string, m: OutMessage): Promise<{ id: string | null; simulated: boolean }>
}
