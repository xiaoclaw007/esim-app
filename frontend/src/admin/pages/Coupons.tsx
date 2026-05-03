import { useEffect, useState } from 'react'
import { CrmIcon } from '../components/CrmIcon'
import { adminApi, type AdminCouponRow, type AdminCouponCreate } from '../api/admin'
import { CouponDrawer } from './CouponDrawer'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

function valueLabel(c: AdminCouponRow): string {
  if (c.kind === 'percent') return `${c.value}% off`
  return `${dollars(c.value)} off`
}

export default function CrmCoupons() {
  const [rows, setRows] = useState<AdminCouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function reload() {
    setLoading(true)
    adminApi
      .listCoupons()
      .then((r) => {
        setRows(r)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  async function handleToggle(c: AdminCouponRow) {
    try {
      const updated = await adminApi.updateCoupon(c.id, { active: !c.active })
      setRows((prev) => prev.map((r) => (r.id === c.id ? updated : r)))
    } catch (e) {
      alert(`Failed to toggle: ${e instanceof Error ? e.message : e}`)
    }
  }

  async function handleCreate(body: AdminCouponCreate) {
    const created = await adminApi.createCoupon(body)
    setRows((prev) => [created, ...prev])
    setCreating(false)
  }

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">{rows.length.toLocaleString()} coupon{rows.length === 1 ? '' : 's'}</div>
          <h1>Coupons</h1>
        </div>
        <div className="crm-page-actions">
          <button className="crm-btn primary" onClick={() => setCreating(true)}>
            <CrmIcon name="plus" size={14} /> New coupon
          </button>
        </div>
      </div>

      {error && <div className="crm-empty"><strong>Couldn't load coupons</strong>{error}</div>}

      <div className="crm-card no-pad">
        {loading && rows.length === 0 ? (
          <div className="crm-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="crm-empty">
            <strong>No coupons yet</strong>
            Click "New coupon" to create your first one.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Type</th>
                <th>Value</th>
                <th style={{ textAlign: 'right' }}>Used</th>
                <th>Window</th>
                <th>Status</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} onClick={() => setOpenId(c.id)}>
                  <td className="mono"><strong>{c.code}</strong></td>
                  <td>{c.kind === 'percent' ? 'Percent off' : 'Fixed off'}</td>
                  <td>{valueLabel(c)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {c.uses}
                    {c.max_uses !== null && <span className="dim"> / {c.max_uses}</span>}
                  </td>
                  <td className="dim sm">
                    {c.valid_from || c.valid_until ? (
                      <>
                        {c.valid_from ? new Date(c.valid_from).toLocaleDateString() : '—'} →{' '}
                        {c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'never'}
                      </>
                    ) : (
                      'Always'
                    )}
                  </td>
                  <td>
                    <span className={`crm-pill ${c.active ? 'ok' : 'muted'}`}>
                      {c.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span
                      className={`crm-toggle ${c.active ? 'on' : ''}`}
                      onClick={() => handleToggle(c)}
                      role="switch"
                      aria-checked={c.active}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <CouponDrawer mode="create" onClose={() => setCreating(false)} onCreate={handleCreate} />
      )}
      {openId && (
        <CouponDrawer
          mode="detail"
          couponId={openId}
          onClose={() => setOpenId(null)}
          onChange={reload}
        />
      )}
    </div>
  )
}
