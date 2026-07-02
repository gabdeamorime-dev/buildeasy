import './landing.css'
import { useEffect } from 'react'
import { persistReferralCode } from './lib/auth.js'

const ROLES = [
  { id: 'admin', tag: 'GÉRANT', color: '#152238', bg: '#eef1f6', title: 'Gérant', desc: 'Pilotage, finances, CRM et équipes.' },
  { id: 'chef', tag: 'CHEF', color: '#0e7490', bg: '#ecfeff', title: 'Chef de chantier', desc: 'Chantiers, commandes et validation terrain.' },
  { id: 'employe', tag: 'CPG', color: '#047857', bg: '#ecfdf5', title: 'Compagnon', desc: 'Pointage, tâches et punch list.' },
  { id: 'client', tag: 'MOA', color: '#b45309', bg: '#fffbeb', title: 'Maître d\'ouvrage', desc: 'Suivi chantier et transparence financière.' },
]

const FEATURES = [
  { title: 'Chantiers & planning', desc: 'Avancement, tâches, météo et affectation équipe en temps réel.' },
  { title: 'Devis, factures & trésorerie', desc: 'Situations, relances et vision cash pour le gérant.' },
  { title: 'Commandes & fournisseurs', desc: 'Achats chantier, réceptions et annuaire intégré.' },
  { title: 'Punch list & incidents', desc: 'Réserves, sécurité et suivi jusqu\'à clôture.' },
  { title: 'Web + mobile', desc: 'Navigateur, iOS et Android via Capacitor.' },
  { title: 'Multi-tenant sécurisé', desc: 'Données isolées par entreprise avec rôles Supabase.' },
]

const PLANS = [
  { name: 'Starter', price: '80', desc: 'Artisans & petites équipes', feats: ['3 chantiers', '5 utilisateurs', 'Devis & factures'] },
  { name: 'Pro', price: '149', desc: 'PME en croissance', feats: ['Chantiers illimités', 'CRM & avenants', 'Planning équipe'], featured: true },
  { name: 'Entreprise', price: '249', desc: 'Structures multi-sites', feats: ['Multi-agence', 'Exports & API', 'Support prioritaire'] },
]

export default function LandingPage({ onEnterApp }) {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) persistReferralCode(ref)
  }, [])

  return (
    <div className="landing">
      <nav className="lp-nav">
        <div className="lp-brand">
          <div className="lp-logo" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          BuildEasy
        </div>
        <div className="lp-nav-actions">
          <button type="button" className="lp-btn lp-btn-ghost" onClick={() => onEnterApp('login')}>Connexion</button>
          <button type="button" className="lp-btn lp-btn-primary" onClick={() => onEnterApp('signup')}>Essai gratuit</button>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="lp-hero-grid">
          <div>
            <div className="lp-badge">BTP · SaaS · France</div>
            <h1>Gérez vos chantiers <em>sans Excel</em> ni paperasse.</h1>
            <p className="lp-lead">
              Chantiers, équipes, devis et suivi client — une application pour gérants, chefs, compagnons et maîtres d&apos;ouvrage.
            </p>
            <div className="lp-hero-cta">
              <button type="button" className="lp-btn lp-btn-primary" onClick={() => onEnterApp('signup')}>
                Démarrer — 15 jours gratuits
              </button>
              <button type="button" className="lp-btn lp-btn-outline" onClick={() => onEnterApp('login')}>
                Accéder à l&apos;application
              </button>
            </div>
            <div className="lp-trust">
              <span>4 rôles connectés</span>
              <span>Données sécurisées</span>
              <span>iOS & Android</span>
            </div>
          </div>

          <div className="lp-preview" aria-hidden>
            <div className="lp-preview-bar">
              <span className="lp-dot" />
              <span className="lp-dot" />
              <span className="lp-dot" />
            </div>
            <div className="lp-preview-body">
              <div className="lp-stat-row">
                <div className="lp-stat"><b style={{ color: '#152238' }}>5</b><span>Actifs</span></div>
                <div className="lp-stat"><b style={{ color: '#b91c1c' }}>2</b><span>Alertes</span></div>
                <div className="lp-stat"><b style={{ color: '#047857' }}>6/6</b><span>Équipe</span></div>
              </div>
              <div className="lp-progress-label">Villa Dupont — 68%</div>
              <div className="lp-progress-track">
                <div className="lp-progress-fill" />
              </div>
              <div className="lp-role-pills">
                {ROLES.map((r) => (
                  <span key={r.id} className="lp-pill" style={{ background: r.bg, color: r.color, borderColor: r.color + '33' }}>{r.tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="lp-section" id="fonctionnalites">
        <h2>Fonctionnalités</h2>
        <p className="lp-section-lead">Du devis à la réception, chaque acteur voit ce qui le concerne.</p>
        <div className="lp-features">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="lp-feature">
              <div className="lp-feature-num">{String(i + 1).padStart(2, '0')}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="roles">
        <h2>4 profils, 1 plateforme</h2>
        <p className="lp-section-lead">Permissions adaptées à chaque métier.</p>
        <div className="lp-roles">
          {ROLES.map((r) => (
            <div key={r.id} className="lp-role">
              <span className="lp-role-tag" style={{ background: r.bg, color: r.color, borderColor: r.color + '33' }}>{r.tag}</span>
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="tarifs">
        <h2>Tarifs</h2>
        <p className="lp-section-lead">Commencez en Starter, évoluez avec votre équipe.</p>
        <div className="lp-pricing">
          {PLANS.map((p) => (
            <div key={p.name} className={`lp-price-card${p.featured ? ' featured' : ''}`}>
              <div className="lp-price-label">{p.name}</div>
              <div className="lp-price">{p.price}€<small>/mois</small></div>
              <p style={{ fontSize: 13, color: 'var(--lp-muted)', margin: '0 0 14px' }}>{p.desc}</p>
              <ul className="lp-price-feats">
                {p.feats.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>Prêt à digitaliser vos chantiers ?</h2>
        <p>Créez votre espace en 2 minutes ou testez avec un compte démo.</p>
        <button type="button" className="lp-btn lp-btn-on-dark" onClick={() => onEnterApp('signup')}>
          Créer mon compte gérant
        </button>
      </section>

      <footer className="lp-footer">
        <p>© {new Date().getFullYear()} BuildEasy — Gestion de chantier BTP</p>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="lp-btn lp-btn-ghost" style={{ padding: '8px 12px' }} onClick={() => onEnterApp('login')}>
            Ouvrir l&apos;application
          </button>
        </p>
      </footer>
    </div>
  )
}
