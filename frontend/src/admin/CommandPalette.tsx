import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CrmIcon } from './components/CrmIcon'
import { adminApi, type AdminCustomerRow, type AdminOrderRow } from './api/admin'

interface PaletteProps {
  open: boolean
  onClose: () => void
}

interface PaletteRow {
  kind: 'order' | 'customer'
  id: string
  primary: string
  secondary: string
  amount?: string
  href: string
}

const dollars = (cents: number) => (cents / 100).toFixed(2)

export function CommandPalette({ open, onClose }: PaletteProps) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [customers, setCustomers] = useState<AdminCustomerRow[]>([])
  const [focus, setFocus] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Reset on open + focus the input.
  useEffect(() => {
    if (open) {
      setQ('')
      setFocus(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Lazy-load the search corpus on first open. We grab a generous slice and
  // filter client-side; for V1 the dataset is small.
  useEffect(() => {
    if (!open || orders.length || customers.length) return
    let cancelled = false
    Promise.all([adminApi.listOrders({ per_page: 200 }), adminApi.listCustomers({ per_page: 200 })])
      .then(([o, c]) => {
        if (cancelled) return
        setOrders(o.orders)
        setCustomers(c.customers)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, orders.length, customers.length])

  const rows: PaletteRow[] = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filterOrder = (o: AdminOrderRow) =>
      !needle ||
      o.reference.toLowerCase().includes(needle) ||
      o.email.toLowerCase().includes(needle) ||
      (o.user_name?.toLowerCase().includes(needle) ?? false) ||
      (o.plan_country?.toLowerCase().includes(needle) ?? false)
    const filterCust = (c: AdminCustomerRow) =>
      !needle || c.email.toLowerCase().includes(needle) || (c.name?.toLowerCase().includes(needle) ?? false)

    const oRows: PaletteRow[] = orders
      .filter(filterOrder)
      .slice(0, 6)
      .map((o) => ({
        kind: 'order',
        id: o.reference,
        primary: o.reference,
        secondary: `${o.user_name || o.email} · ${o.plan_name || o.plan_id}`,
        amount: `$${dollars(o.amount_cents)}`,
        href: `/admin/orders/${encodeURIComponent(o.reference)}`,
      }))
    const cRows: PaletteRow[] = customers
      .filter(filterCust)
      .slice(0, 6)
      .map((c) => ({
        kind: 'customer',
        id: c.id,
        primary: c.name || c.email,
        secondary: c.email,
        href: `/admin/customers?q=${encodeURIComponent(c.email)}`,
      }))
    return [...oRows, ...cRows]
  }, [q, orders, customers])

  // Reset focus when results change.
  useEffect(() => {
    setFocus(0)
  }, [q, rows.length])

  // Arrow key nav.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (!rows.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocus((f) => (f + 1) % rows.length)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocus((f) => (f - 1 + rows.length) % rows.length)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const r = rows[focus]
        if (r) {
          navigate(r.href)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rows, focus, navigate, onClose])

  if (!open) return null

  const ordersGroup = rows.filter((r) => r.kind === 'order')
  const customersGroup = rows.filter((r) => r.kind === 'customer')

  return (
    <div className="crm-cmdk-backdrop" onClick={onClose}>
      <div className="crm-cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="crm-cmdk-input-row">
          <CrmIcon name="search" size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search orders, customers…"
          />
          <span className="crm-kbd">esc</span>
        </div>

        <div className="crm-cmdk-body">
          {rows.length === 0 ? (
            <div className="crm-cmdk-empty">No matches.</div>
          ) : (
            <>
              {ordersGroup.length > 0 && (
                <div className="crm-cmdk-group">
                  <div className="crm-cmdk-group-h">Orders</div>
                  {ordersGroup.map((r, i) => (
                    <button
                      key={r.id}
                      className={`crm-cmdk-item ${focus === i ? 'focused' : ''}`}
                      onClick={() => {
                        navigate(r.href)
                        onClose()
                      }}
                      onMouseEnter={() => setFocus(i)}
                    >
                      <CrmIcon name="receipt" size={14} />
                      <span className="mono">{r.primary}</span>
                      <span className="dim sm">· {r.secondary}</span>
                      {r.amount && <span className="amt">{r.amount}</span>}
                    </button>
                  ))}
                </div>
              )}
              {customersGroup.length > 0 && (
                <div className="crm-cmdk-group">
                  <div className="crm-cmdk-group-h">Customers</div>
                  {customersGroup.map((r, i) => {
                    const idx = ordersGroup.length + i
                    return (
                      <button
                        key={r.id}
                        className={`crm-cmdk-item ${focus === idx ? 'focused' : ''}`}
                        onClick={() => {
                          navigate(r.href)
                          onClose()
                        }}
                        onMouseEnter={() => setFocus(idx)}
                      >
                        <CrmIcon name="users" size={14} />
                        <span>{r.primary}</span>
                        <span className="dim sm">· {r.secondary}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="crm-cmdk-foot">
          <span>
            <span className="crm-kbd">↑↓</span> navigate
          </span>
          <span>
            <span className="crm-kbd">↵</span> open
          </span>
          <span>
            <span className="crm-kbd">⌘K</span> toggle
          </span>
        </div>
      </div>
    </div>
  )
}
