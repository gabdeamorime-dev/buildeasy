import { ModIcon, IcoAlert } from './icons.jsx'
import { safeHref } from '../lib/safeUrl.js'

export function EmptyState({ mod = 'empty', title, sub }) {
  return (
    <div className="empty">
      <div className="empty-icon"><ModIcon name={mod} size={28} /></div>
      <p className="empty-title">{title}</p>
      {sub && <p className="empty-sub">{sub}</p>}
    </div>
  )
}

export function QuickAction({ mod, title, sub, onClick, onKeyDown, label }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label || title}
      className="action-tile tap"
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="action-tile-icon"><ModIcon name={mod} size={20} /></div>
      <div className="action-tile-title">{title}</div>
      {sub && <div className="action-tile-sub">{sub}</div>}
    </div>
  )
}

export function CallTile({ label, tel, color }) {
  return (
    <a href={'tel:' + tel.replace(/\s/g, '')} className="call-tile" style={{ '--call-color': color }}>
      <span className="call-tile-num">{tel}</span>
      <span className="call-tile-lbl">{label}</span>
    </a>
  )
}

export function MetaRow({ label, value, href }) {
  const safe = safeHref(href)
  const inner = (
    <>
      <span className="meta-row-lbl">{label}</span>
      <span className="meta-row-val">{value}</span>
    </>
  )
  if (safe) {
    return (
      <a
        href={safe}
        className="meta-row meta-row-link"
        target={safe.startsWith('http') ? '_blank' : undefined}
        rel={safe.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {inner}
      </a>
    )
  }
  return <div className="meta-row">{inner}</div>
}

export function MetaGrid({ items, onNotify }) {
  return items.map((item) => {
        if (item.copy) {
          const lien = safeHref(item.lien)
          return (
            <div key={item.l} className="meta-row">
              <span className="meta-row-lbl">{item.l}</span>
              <div className="meta-row-actions">
                {lien
                  ? <a href={lien} className="meta-row-val meta-row-link-text">{item.v}</a>
                  : <span className="meta-row-val">{item.v}</span>}
                <button
                  type="button"
                  className="link-action"
                  onClick={() => navigator.clipboard?.writeText(item.copy).then(() => onNotify?.('Téléphone copié')).catch(() => {})}
                >
                  Copier
                </button>
              </div>
            </div>
          )
        }
        if (item.lien && !item.addr) {
          return <MetaRow key={item.l} label={item.l} value={item.v} href={item.lien} />
        }
        return <MetaRow key={item.l} label={item.l} value={item.v} />
  })
}

export function Notice({ type = 'warn', title, children }) {
  return (
    <div className={`notice notice-${type}`}>
      {title && <div className="notice-title">{title}</div>}
      {children}
    </div>
  )
}

export function ProtocolBanner({ title, sub }) {
  return (
    <div className="protocol-banner">
      <div className="protocol-banner-ico"><IcoAlert size={18} /></div>
      <div>
        <div className="protocol-banner-title">{title}</div>
        {sub && <div className="protocol-banner-sub">{sub}</div>}
      </div>
    </div>
  )
}

export function StatPct({ value, label = 'avancement' }) {
  return (
    <div className="stat-pct">
      <div className="stat-pct-val">{value}%</div>
      {label && <div className="stat-pct-lbl">{label}</div>}
    </div>
  )
}
