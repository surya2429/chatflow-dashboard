// sample.ts — an editable in-memory catalog for before Facebook is connected: everything works, nothing reaches Meta.
import { matchFilter } from './common.js'
import { CatalogError, type CatalogBackend, type Commerce, type Product, type ProductSet, type SetFilter } from './types.js'

const P = (retailerId: string, name: string, price: number, brand: string, extra: Partial<Product> = {}): Product => ({
  retailerId, name, description: `${name} by ${brand}. Free delivery on orders above ₹999 and easy 7-day returns.`, price, currency: 'INR', salePrice: null,
  availability: 'in stock', condition: 'new', imageUrl: `https://picsum.photos/seed/${retailerId}/600/600`, url: `https://shop.example.com/products/${retailerId.toLowerCase()}`,
  brand, groupId: '', size: '', color: '', inventory: 50, reviewStatus: 'approved', reviewNote: '', ...extra,
})

const seed = (): Product[] => [
  P('SP001', 'Premium Wireless Earbuds', 6999, 'Sonic', { salePrice: 4999, inventory: 143 }),
  P('SP002', 'Organic Cotton T-Shirt (M)', 1299, 'Terra', { salePrice: 799, inventory: 512, groupId: 'TSHIRT', size: 'M', color: 'White' }),
  P('SP002-S', 'Organic Cotton T-Shirt (S)', 1299, 'Terra', { salePrice: 799, inventory: 210, groupId: 'TSHIRT', size: 'S', color: 'White' }),
  P('SP002-L', 'Organic Cotton T-Shirt (L)', 1399, 'Terra', { salePrice: 899, inventory: 0, availability: 'out of stock', groupId: 'TSHIRT', size: 'L', color: 'White' }),
  P('SP003', 'Stainless Steel Water Bottle', 1299, 'Hydra', { inventory: 89 }),
  P('SP004', 'Yoga Mat Pro', 3499, 'Zen', { salePrice: 2499, inventory: 34 }),
  P('SP005', 'Artisan Coffee Blend 250g', 649, 'Bean & Co', { inventory: 220 }),
  P('SP006', 'Leather Wallet Slim', 2199, 'Hide', { salePrice: 1599, inventory: 67 }),
  P('SP007', 'Smart LED Desk Lamp', 4499, 'Lumen', { salePrice: 3299, inventory: 0, availability: 'out of stock' }),
  P('SP008', 'Running Shoes Pro X (9)', 7999, 'Stride', { salePrice: 5499, inventory: 18, groupId: 'SHOES', size: '9', color: 'Black' }),
  P('SP008-8', 'Running Shoes Pro X (8)', 7999, 'Stride', { salePrice: 5499, inventory: 6, groupId: 'SHOES', size: '8', color: 'Black' }),
  P('SP008-10', 'Running Shoes Pro X (10)', 8499, 'Stride', { salePrice: 5999, inventory: 11, groupId: 'SHOES', size: '10', color: 'Black' }),
  P('SP009', 'Bluetooth Speaker Mini', 2999, 'Sonic', { inventory: 76, reviewStatus: 'pending' }),
  P('SP010', 'Ceramic Dinner Set (16 pc)', 5499, 'Terra', { inventory: 12, reviewStatus: 'rejected', reviewNote: 'The image shows promotional text, which catalogs do not allow.' }),
  P('SP011', 'Notebook Set (3 pack)', 399, 'Paperly', { inventory: 300 }),
  P('SP012', 'Refurbished Phone Stand', 899, 'Grip', { condition: 'refurbished', inventory: 9 }),
]

export function createSampleCatalog(): CatalogBackend {
  const catalog = { id: 'sample-catalog', name: 'Sample store catalog' }
  let products = seed()
  let connected = false
  let sets: (ProductSet & { filter: SetFilter })[] = [{ id: 'set-all', name: 'All Products', productCount: 0, filter: {} }]
  const commerce: Commerce = { isCatalogVisible: false, isCartEnabled: true }
  const extra: { id: string; name: string }[] = []
  const phone = { id: 'sample-phone', display: '+91 98765 43210', name: 'Sample business' }
  const known = (catalogId: string) => catalogId === catalog.id || extra.some((x) => x.id === catalogId) || sets.some((x) => x.id === catalogId)
  const count = () => products.length

  return {
    mode: 'sample',
    async catalogs() {
      return { catalogs: [{ id: catalog.id, name: catalog.name, productCount: count(), vertical: 'commerce' }, ...extra.map((x) => ({ ...x, productCount: 0, vertical: 'commerce' }))], connectedId: connected ? catalog.id : null, canCreate: true }
    },
    async createCatalog(name) { const x = { id: `sample-${extra.length + 2}`, name }; extra.push(x); return { ...x, productCount: 0, vertical: 'commerce' } },
    async connectToWhatsApp(id) { if (!known(id)) throw new CatalogError('Catalog not found.', 404, 'not_found'); connected = true },
    async products(id) {
      if (!known(id)) throw new CatalogError('Catalog not found.', 404, 'not_found')
      const set = sets.find((x) => x.id === id)
      const list = set ? products.filter((p) => matchFilter(p, set.filter)) : id === catalog.id ? products : []
      return { products: list.map((p) => ({ ...p })), truncated: false }
    },
    async sets(id) { if (!known(id)) throw new CatalogError('Catalog not found.', 404, 'not_found'); return sets.map(({ filter, ...x }) => ({ ...x, productCount: products.filter((p) => matchFilter(p, filter)).length })) },
    async createSet(_id, name, filter) { const x = { id: `set-${sets.length + 1}-${Date.now() % 1e5}`, name, productCount: null, filter }; sets.push(x); return { id: x.id, name, productCount: products.filter((p) => matchFilter(p, filter)).length } },
    async deleteSet(id) { if (id === 'set-all') throw new CatalogError('The All Products set can’t be deleted.', 400, 'invalid_request'); sets = sets.filter((x) => x.id !== id) },
    async write(id, ops, opts = {}) {
      if (id !== catalog.id) throw new CatalogError('Only the sample catalog can be edited in sample mode.', 400, 'sample_only')
      let sent = 0
      const errors: { retailerId: string; message: string }[] = []
      for (const { method, product: p } of ops) {
        const i = products.findIndex((x) => x.retailerId === p.retailerId)
        if (method === 'DELETE') { products = products.filter((x) => x.retailerId !== p.retailerId); sent++ }
        else if (i >= 0) { products[i] = { ...products[i]!, ...p, reviewStatus: method === 'UPDATE' && Object.keys(p).length > 2 ? 'pending' : products[i]!.reviewStatus }; sent++ }
        else if (method === 'UPDATE' && opts.allowUpsert === false) errors.push({ retailerId: p.retailerId, message: 'No product with this SKU in the catalog.' })
        else if (method === 'CREATE' || method === 'UPDATE') { products.unshift({ ...P(p.retailerId, p.name ?? p.retailerId, p.price ?? 0, p.brand ?? ''), ...p, reviewStatus: 'pending' } as Product); sent++ }   // Meta also reviews every new or changed product
      }
      return { sent, errors, warnings: [] }
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
