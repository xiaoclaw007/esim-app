import { useEffect, useState } from 'react'
import { adminApi, type AdminCountryRow, type AdminPlanRow } from '../api/admin'

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function CrmCatalog() {
  const [countries, setCountries] = useState<AdminCountryRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [plans, setPlans] = useState<AdminPlanRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(false)

  useEffect(() => {
    let cancelled = false
    adminApi
      .listCountries()
      .then((c) => {
        if (cancelled) return
        setCountries(c)
        if (c.length && !selected) setSelected(c[0].code)
      })
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [selected])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setLoadingPlans(true)
    adminApi
      .listPlans(selected)
      .then((p) => !cancelled && setPlans(p))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoadingPlans(false))
    return () => {
      cancelled = true
    }
  }, [selected])

  return (
    <div className="crm-page">
      <div className="crm-page-head">
        <div>
          <div className="crm-eyebrow">{countries.length} destination{countries.length === 1 ? '' : 's'}</div>
          <h1>Catalog</h1>
        </div>
      </div>

      {error && <div className="crm-empty"><strong>Couldn't load catalog</strong>{error}</div>}

      <div className="crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-h">
            <h3>Countries</h3>
            <span className="dim sm">{plans.length} plans for {selected}</span>
          </div>
          <div className="crm-country-grid">
            {countries.map((c) => (
              <button
                key={c.code}
                className={`crm-country-tile ${selected === c.code ? 'active' : ''}`}
                onClick={() => setSelected(c.code)}
              >
                <span className="flag">{c.flag}</span>
                <div>
                  <div className="name">{c.name}</div>
                  <div className="sub">{c.plan_count} plan{c.plan_count === 1 ? '' : 's'}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="crm-card no-pad">
          <div className="crm-card-h" style={{ padding: '14px 18px 10px' }}>
            <h3>{selected} plans</h3>
            <span className="dim sm">read-only</span>
          </div>
          {loadingPlans && plans.length === 0 ? (
            <div className="crm-empty">Loading…</div>
          ) : plans.length === 0 ? (
            <div className="crm-empty">No plans for this destination.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Data</th>
                  <th>Days</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Sold (30d)</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} style={{ cursor: 'default' }}>
                    <td>
                      <div>{p.name}</div>
                      <div className="dim sm mono">{p.joytel_sku}</div>
                    </td>
                    <td className="num">{p.data_gb >= 999 ? 'Unlimited' : `${p.data_gb} GB`}</td>
                    <td className="num">{p.validity_days}</td>
                    <td className="num" style={{ textAlign: 'right' }}>{dollars(p.price_cents)}</td>
                    <td className="num dim" style={{ textAlign: 'right' }}>{p.sold_30d}</td>
                    <td>
                      <span className={`crm-toggle ${p.active ? 'on' : ''}`} aria-label={p.active ? 'Active' : 'Inactive'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
