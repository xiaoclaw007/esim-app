import { Link } from 'react-router-dom'
import { Logo } from './Logo'

// Items can be plain strings (placeholder) or { label, href } pairs.
// href starting with "/" is a SPA route, "mailto:" / "https:" stay external.
type FooterItem = string | { label: string; href: string }
interface FooterCol {
  h: string
  items: FooterItem[]
}

const cols: FooterCol[] = [
  { h: 'Company', items: [{ label: 'About', href: '/about' }] },
  {
    h: 'Support',
    items: [
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact us', href: 'mailto:support@nimvoy.com' },
    ],
  },
]

function FooterLink({ item }: { item: FooterItem }) {
  if (typeof item === 'string') return <li>{item}</li>
  if (item.href.startsWith('/')) {
    return (
      <li>
        <Link to={item.href}>{item.label}</Link>
      </li>
    )
  }
  return (
    <li>
      <a href={item.href}>{item.label}</a>
    </li>
  )
}

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
              {c.items.map((it, i) => (
                <FooterLink key={i} item={it} />
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
