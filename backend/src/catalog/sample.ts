// sample.ts — an editable in-memory catalog for before Facebook is connected: everything works, nothing reaches Meta.
import { CatalogError, type CatalogBackend, type Commerce, type Product } from './types.js'

const P = (retailerId: string, name: string, price: number, brand: string, extra: Partial<Product> = {}): Product => ({
  retailerId, name, description: `${name} by ${brand}. Free delivery on orders above ₹999 and easy 7-day returns.`, price, currency: 'INR', salePrice: null,
  availability: 'in stock', condition: 'new', imageUrl: `https://picsum.photos/seed/${retailerId}/600/600`, url: `https://shop.example.com/products/${retailerId.toLowerCase()}`,
  brand, inventory: 50, reviewStatus: 'approved', reviewNote: '', ...extra,
})

const seed = (): Product[] => [
  P('SP001', 'Premium Wireless Earbuds', 6999, 'Sonic', { salePrice: 4999, inventory: 143 }),
  P('SP002', 'Organic Cotton T-Shirt', 1299, 'Terra', { salePrice: 799, inventory: 512 }),
  P('SP003', 'Stainless Steel Water Bottle', 1299, 'Hydra', { inventory: 89 }),
  P('SP004', 'Yoga Mat Pro', 3499, 'Zen', { salePrice: 2499, inventory: 34 }),
  P('SP005', 'Artisan Coffee Blend 250g', 649, 'Bean & Co', { inventory: 220 }),
  P('SP006', 'Leather Wallet Slim', 2199, 'Hide', { salePrice: 1599, inventory: 67 }),
  P('SP007', 'Smart LED Desk Lamp', 4499, 'Lumen', { salePrice: 3299, inventory: 0, availability: 'out of stock' }),
  P('SP008', 'Running Shoes Pro X', 7999, 'Stride', { salePrice: 5499, inventory: 18 }),
  P('SP009', 'Bluetooth Speaker Mini', 2999, 'Sonic', { inventory: 76, reviewStatus: 'pending' }),
  P('SP010', 'Ceramic Dinner Set (16 pc)', 5499, 'Terra', { inventory: 12, reviewStatus: 'rejected', reviewNote: 'The image shows promotional text, which catalogs do not allow.' }),
  P('SP011', 'Notebook Set (3 pack)', 399, 'Paperly', { inventory: 300 }),
  P('SP012', 'Refurbished Phone Stand', 899, 'Grip', { condition: 'refurbished', inventory: 9 }),
]

export function createSampleCatalog(): CatalogBackend {
  const catalog = { id: 'sample-catalog', name: 'Sample store catalog' }
  let products = seed()
  let connected = false
  const commerce: Commerce = { isCatalogVisible: false, isCartEnabled: true }
  const extra: { id: string; name: string }[] = []
  const phone = { id: 'sample-phone', display: '+91 98765 43210', name: 'Sample business' }
  const known = (catalogId: string) => catalogId === catalog.id || extra.some((x) => x.id === catalogId)
  const count = () => products.length

  return {
    mode: 'sample',
    async catalogs() {
      return { catalogs: [{ id: catalog.id, name: catalog.name, productCount: count(), vertical: 'commerce' }, ...extra.map((x) => ({ ...x, productCount: 0, vertical: 'commerce' }))], connectedId: connected ? catalog.id : null, canCreate: true }
    },
    async createCatalog(name) { const x = { id: `sample-${extra.length + 2}`, name }; extra.push(x); return { ...x, productCount: 0, vertical: 'commerce' } },
    async connectToWhatsApp(id) { if (!known(id)) throw new CatalogError('Catalog not found.', 404, 'not_found'); connected = true },
    async products(id) { if (!known(id)) throw new CatalogError('Catalog not found.', 404, 'not_found'); return { products: id === catalog.id ? products.map((p) => ({ ...p })) : [], truncated: false } },
    async write(id, ops) {
      if (id !== catalog.id) throw new CatalogError('Only the sample catalog can be edited in sample mode.', 400, 'sample_only')
      let sent = 0
      for (const { method, product: p } of ops) {
        const i = products.findIndex((x) => x.retailerId === p.retailerId)
        if (method === 'DELETE') { products = products.filter((x) => x.retailerId !== p.retailerId); sent++ }
        else if (i >= 0) { products[i] = { ...products[i]!, ...p, reviewStatus: method === 'UPDATE' && Object.keys(p).length > 2 ? 'pending' : products[i]!.reviewStatus }; sent++ }
        else if (method === 'CREATE' || method === 'UPDATE') { products.unshift({ ...P(p.retailerId, p.name ?? p.retailerId, p.price ?? 0, p.brand ?? ''), ...p, reviewStatus: 'pending' } as Product); sent++ }   // Meta also reviews every new or changed product
      }
      return { sent, errors: [], warnings: [] }
    },
    async phoneNumbers() { return [phone] },
    async commerce() { return { ...commerce } },
    async setCommerce(_p, patch) { Object.assign(commerce, patch); return { ...commerce } },
    async send(_p, m) {
      const ids = m.kind === 'product' ? [m.retailerId] : m.kind === 'products' ? m.retailerIds : m.thumbnailRetailerId ? [m.thumbnailRetailerId] : []
      const missing = ids.filter((id) => !products.some((p) => p.retailerId === id))
      if (missing.length === ids.length && ids.length) throw new CatalogError('None of those products are in the catalog, so the message was not sent.', 400, 'meta_error')
      if (m.kind === 'catalog' && !connected) throw new CatalogError('Connect the catalog to your WhatsApp number first (Settings tab).', 409, 'not_connected')
      return { id: null, simulated: true }
    },
  }
}
