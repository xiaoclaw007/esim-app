import { Logo } from './Logo'

const cols = [
  {
    h: 'Destinations',
    items: ['Japan', 'Spain', 'United States', 'Thailand', 'Europe regional', 'Global plan'],
  },
  { h: 'Company', items: ['About', 'Careers', 'Press', 'Affiliates'] },
  { h: 'Support', items: ['Help center', 'Compatibility', 'Contact us', 'Status'] },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div style={{ marginBottom: 16 }}>
            <Logo />
          </div>
          <p className="muted" style={{ fontSize: 14, maxWidth: '36ch', margin: 0 }}>
            Data that travels with you. eSIMs for 132 countries, installed in 60 seconds.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <h4>{c.h}</h4>
            <ul>
              {c.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="footer-meta">
        <span>© 2026 Nimvoy · Global eSIM</span>
        <span>EN · USD</span>
      </div>
    </footer>
  )
}
