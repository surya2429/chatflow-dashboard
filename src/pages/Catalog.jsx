import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Search, Upload, Edit3, Trash2, Eye, ShoppingBag,
  Package, Tag, DollarSign, CheckCircle2, X, Image,
  ToggleLeft, ToggleRight, ExternalLink, Link, Settings,
  AlertCircle, Globe, ChevronRight, BarChart2,
} from 'lucide-react'
import clsx from 'clsx'
import Select from '../components/Select'

const PRODUCTS = [
  { id: 'p1', name: 'Premium Wireless Headphones', price: 2999, category: 'Electronics', status: 'active', stock: 45, image: '🎧', sku: 'HDPH-001', currency: '₹' },
  { id: 'p2', name: 'Leather Wallet', price: 899, category: 'Accessories', status: 'active', stock: 120, image: '👛', sku: 'WALL-001', currency: '₹' },
  { id: 'p3', name: 'Running Shoes', price: 3499, category: 'Footwear', status: 'active', stock: 30, image: '👟', sku: 'SHOE-002', currency: '₹' },
  { id: 'p4', name: 'Smart Watch', price: 8999, category: 'Electronics', status: 'active', stock: 15, image: '⌚', sku: 'WTCH-001', currency: '₹' },
  { id: 'p5', name: 'Yoga Mat', price: 1299, category: 'Sports', status: 'inactive', stock: 0, image: '🧘', sku: 'YOGA-001', currency: '₹' },
  { id: 'p6', name: 'Coffee Mug', price: 499, category: 'Kitchen', status: 'active', stock: 200, image: '☕', sku: 'MUG-001', currency: '₹' },
]

const CATEGORIES = ['All', 'Electronics', 'Accessories', 'Footwear', 'Sports', 'Kitchen']

function ConnectCatalogBanner({ onConnect }) {
  return (
    <div className="card p-4 border-primary/20 bg-primary-50">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <ShoppingBag size={16} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">Connect WhatsApp Catalog</h3>
          <p className="text-sm text-slate-600 mt-1">
            Connect your Meta Commerce Manager catalog to enable product sharing, catalog messages, and in-chat shopping directly via WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={onConnect} className="btn-primary">
              <Link size={14} /> Connect Meta Catalog
            </button>
            <button className="btn-secondary">
              <Upload size={14} /> Import from CSV
            </button>
            <a href="#" className="btn-secondary">
              <ExternalLink size={14} /> Meta Commerce Manager
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductModal({ product, onClose }) {
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price || '')
  const [category, setCategory] = useState(product?.category || 'Electronics')
  const [desc, setDesc] = useState('')
  const [sku, setSku] = useState(product?.sku || '')

  return createPortal(
    <>
      <div className="side-panel-overlay" onClick={onClose}/>
      <div className="side-panel" style={{ width: 440 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border flex-shrink-0">
          <div>
            <h3 className="sp-title">{product ? 'Edit Product' : 'Add Product'}</h3>
            <p className="sp-sub">{product ? 'Update product details' : 'Add a new product to your catalog'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-slate-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Image upload */}
          <div>
            <label className="label">Product Image</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-4xl cursor-pointer hover:border-primary/40 transition-colors bg-slate-50">
                {product?.image || '📦'}
              </div>
              <div>
                <button className="btn-secondary text-xs"><Upload size={12} /> Upload Image</button>
                <p className="text-[10px] text-slate-400 mt-1">JPG, PNG up to 8MB. Min 500x500px</p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Product Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Premium Wireless Headphones" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Price *</label>
              <div className="flex">
                <span className="flex items-center px-3 bg-slate-50 border border-r-0 border-surface-border rounded-l-lg text-sm text-slate-500">₹</span>
                <input className="input rounded-l-none" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">SKU / Product ID</label>
              <input className="input" value={sku} onChange={e => setSku(e.target.value)} placeholder="PROD-001" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Category</label>
            <Select
              value={category}
              onChange={v => setCategory(v)}
              options={['Electronics', 'Accessories', 'Footwear', 'Sports', 'Kitchen', 'Fashion', 'Books', 'Other'].map(c => ({ value: c, label: c }))}
            />
          </div>

          <div className="form-group">
            <label className="label">Description</label>
            <textarea className="textarea" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe your product..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Stock</label>
              <input className="input" type="number" defaultValue={product?.stock || 0} />
            </div>
            <div className="form-group">
              <label className="label">Original Price (for discount)</label>
              <input className="input" type="number" placeholder="0.00" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Product URL</label>
            <input className="input" type="url" placeholder="https://yourstore.com/product/..." />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-surface-border">
            <div>
              <p className="text-sm font-medium text-slate-800">Active in Catalog</p>
              <p className="text-xs text-slate-500">Visible to customers on WhatsApp</p>
            </div>
            <button className="text-primary">
              <ToggleRight size={28} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          {product ? (
            <button className="btn-primary"><Edit3 size={13} /> Update Product</button>
          ) : (
            <button className="btn-primary"><Plus size={13} /> Add Product</button>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}

export default function Catalog() {
  const [connected, setConnected] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState(null)
  const [activeTab, setActiveTab] = useState('products')

  const filtered = PRODUCTS.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === 'All' || p.category === category
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalog & Commerce</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Manage your product catalog for WhatsApp shopping</p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <>
              <button className="btn-secondary"><Upload size={14} /> Sync from Meta</button>
              <button onClick={() => { setEditProduct(null); setShowModal(true) }} className="btn-primary">
                <Plus size={14} /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {!connected && (
        <ConnectCatalogBanner onConnect={() => setConnected(true)} />
      )}

      {connected && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Products', value: PRODUCTS.length, color: 'text-primary', bg: 'bg-primary-50', icon: Package },
              { label: 'Active',         value: PRODUCTS.filter(p => p.status === 'active').length, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
              { label: 'Out of Stock',   value: PRODUCTS.filter(p => p.stock === 0).length, color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle },
              { label: 'Catalog Views',  value: '4.2K', color: 'text-purple-600', bg: 'bg-purple-50', icon: Eye },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="card p-4 flex items-center gap-3">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', s.bg)}>
                    <Icon size={16} className={s.color} />
                  </div>
                  <div>
                    <p className={clsx('text-lg font-bold', s.color)}>{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {[['products', 'Products'], ['orders', 'Orders'], ['settings', 'Commerce Settings']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx('px-4 py-2 rounded-lg text-xs font-medium transition-colors',
                  activeTab === key ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'products' && (
            <>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" placeholder="Search products, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', category === cat ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-surface-border hover:border-primary/40')}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map(p => (
                  <div key={p.id} className="card overflow-hidden hover:border-primary/30 transition-all group">
                    {/* Image */}
                    <div className="bg-slate-50 h-36 flex items-center justify-center text-6xl border-b border-surface-border relative">
                      {p.image}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditProduct(p); setShowModal(true) }} className="p-1.5 rounded-lg bg-white border border-surface-border text-slate-500 hover:text-primary">
                          <Edit3 size={12} />
                        </button>
                        <button className="p-1.5 rounded-lg bg-white border border-surface-border text-slate-500 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {p.stock === 0 && (
                        <div className="absolute top-2 left-2 badge badge-red text-[10px]">Out of Stock</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-slate-900 text-sm leading-tight">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{p.sku} · {p.category}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="font-bold text-primary text-sm">{p.currency}{p.price.toLocaleString()}</p>
                        <span className={clsx('badge text-[10px]', p.status === 'active' ? 'badge-green' : 'badge-gray')}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Stock: {p.stock} units</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="card overflow-hidden overflow-x-auto">
              <div className="p-4 border-b border-surface-border">
                <h3 className="section-title">Recent Orders</h3>
              </div>
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr>
                    {['Order ID', 'Customer', 'Product', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {[
                    { id: '#3821', customer: 'Priya Sharma',  product: 'Smart Watch',   amount: '₹8,999', status: 'Delivered', date: 'Apr 15' },
                    { id: '#3820', customer: 'Rahul Mehta',   product: 'Leather Wallet', amount: '₹899',   status: 'Processing', date: 'Apr 14' },
                    { id: '#3819', customer: 'Anita Kapoor',  product: 'Running Shoes',  amount: '₹3,499', status: 'Shipped',   date: 'Apr 13' },
                    { id: '#3818', customer: 'Vikram Singh',  product: 'Coffee Mug',     amount: '₹499',   status: 'Cancelled', date: 'Apr 12' },
                  ].map(o => (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell font-mono text-primary">{o.id}</td>
                      <td className="table-cell font-medium text-slate-900">{o.customer}</td>
                      <td className="table-cell text-slate-600">{o.product}</td>
                      <td className="table-cell font-semibold text-slate-900">{o.amount}</td>
                      <td className="table-cell">
                        <span className={clsx('badge text-[10px]', {
                          'badge-green': o.status === 'Delivered',
                          'badge-blue':  o.status === 'Processing',
                          'badge-amber': o.status === 'Shipped',
                          'badge-red':   o.status === 'Cancelled',
                        })}>
                          {o.status}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500 text-xs">{o.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4 space-y-4">
                <h3 className="section-title">Commerce Settings</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Enable Product Catalog', desc: 'Allow customers to browse products', enabled: true },
                    { label: 'In-Chat Checkout', desc: 'Let customers order directly in chat', enabled: true },
                    { label: 'Cart Abandonment Alerts', desc: 'Alert agents when cart is abandoned', enabled: false },
                    { label: 'Stock Alerts', desc: 'Notify when product stock is low', enabled: true },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between py-3 border-b border-surface-border">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.desc}</p>
                      </div>
                      <button className={clsx('transition-colors', s.enabled ? 'text-primary' : 'text-slate-300')}>
                        {s.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-4 space-y-4">
                <h3 className="section-title">Catalog Connection</h3>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Catalog Connected</p>
                    <p className="text-xs text-emerald-600">Acme Products (ID: 123456789)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="form-group">
                    <label className="label">Business Account ID</label>
                    <input className="input text-xs font-mono" defaultValue="123456789012345" readOnly />
                  </div>
                  <div className="form-group">
                    <label className="label">Catalog ID</label>
                    <input className="input text-xs font-mono" defaultValue="987654321098765" readOnly />
                  </div>
                  <div className="form-group">
                    <label className="label">Currency</label>
                    <Select
                      options={[{ value: 'INR', label: 'INR (₹)' }, { value: 'USD', label: 'USD ($)' }]}
                      placeholder="INR (₹)"
                    />
                  </div>
                </div>
                <button className="btn-secondary w-full justify-center text-xs text-red-400 hover:text-red-600">
                  Disconnect Catalog
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showModal && <ProductModal product={editProduct} onClose={() => { setShowModal(false); setEditProduct(null) }} />}
    </div>
  )
}
