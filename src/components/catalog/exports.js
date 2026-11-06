/* The catalog as a table for ExportMenu. Columns are Meta's catalog feed names, so the CSV can be edited and imported again. */
const feedPrice = (n, c) => (n === null || n === undefined ? '' : `${Number.isInteger(n) ? n : n.toFixed(2)} ${c}`)

export function productsExportTable(products) {
  const cols = [['id', 'id'], ['title', 'title'], ['description', 'description'], ['availability', 'availability'], ['condition', 'condition'], ['price', 'price'], ['sale_price', 'sale_price'], ['link', 'link'], ['image_link', 'image_link'], ['brand', 'brand'], ['item_group_id', 'item_group_id'], ['size', 'size'], ['color', 'color'], ['quantity_to_sell_on_facebook', 'quantity_to_sell_on_facebook'], ['review_status', 'review_status (read only)'], ['review_note', 'review_note (read only)']]
  return {
    columns: cols.map(([key, label]) => ({ key, label })),
    rows: products.map((p) => ({
      id: p.retailerId, title: p.name, description: p.description, availability: p.availability, condition: p.condition,
      price: feedPrice(p.price, p.currency), sale_price: p.salePrice ? feedPrice(p.salePrice, p.currency) : '', link: p.url, image_link: p.imageUrl, brand: p.brand, item_group_id: p.groupId, size: p.size, color: p.color,
      quantity_to_sell_on_facebook: p.inventory ?? '', review_status: p.reviewStatus, review_note: p.reviewNote,
    })),
  }
}
