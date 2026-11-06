/* Products that share an item_group_id are variants (sizes, colours) of one item; the table shows them as one row you can open.
   A product with no group id is a group of one. */
const SEVERITY = { rejected: 4, outdated: 3, pending: 2, approved: 1, '': 0 }
const unit = (p) => p.salePrice || p.price

export function groupProducts(products) {
  const byKey = new Map()
  for (const p of products) {
    const key = p.groupId || `sku:${p.retailerId}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(p)
  }
  return [...byKey.entries()].map(([key, items]) => {
    const prices = items.map(unit)
    const first = items[0]
    return {
      key, items, isGroup: items.length > 1, groupId: first.groupId,
      name: first.name, image: items.find((i) => i.imageUrl)?.imageUrl || '', brand: first.brand, currency: first.currency,
      min: Math.min(...prices), max: Math.max(...prices),
      inStock: items.filter((i) => i.availability === 'in stock').length,
      status: items.reduce((w, i) => ((SEVERITY[i.reviewStatus] ?? 0) > (SEVERITY[w] ?? 0) ? i.reviewStatus : w), items[0].reviewStatus),
    }
  })
}
