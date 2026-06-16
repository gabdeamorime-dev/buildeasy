import './landing.css'

const ROLES = [
  { id: 'admin', tag: 'GÉRANT', color: '#2563EB', bg: '#EFF6FF', title: 'Gérant', desc: 'Pilotage global, finances, CRM, abonnement et équipes.' },
  { id: 'chef', tag: 'CHEF', color: '#0891B2', bg: '#ECFEFF', title: 'Chef de chantier', desc: 'Chantiers assignés, commandes, planning et validation terrain.' },
  { id: 'employe', tag: 'CPG', color: '#059669', bg: '#ECFDF5', title: 'Compagnon', desc: 'Pointage, tâches, punch list et communication chantier.' },
  { id: 'client', tag: 'MOA', color: '#D97706', bg: '#FFFBEB', title: 'Maître d\'ouvrage', desc: 'Suivi chantier, situations, avenants et transparence financière.' },
]

const FEATURES = [
  { icon: '🏗️', title: 'Chantiers & planning', desc: 'Avancement, tâches, météo, notes et affectation équipe en temps réel.' },
  { icon: '💶', title: 'Devis, factures & trésorerie', desc: 'Situations, relances, marges chantier et vision cash pour le gérant.' },
  { icon: '📦', title: 'Commandes & fournisseurs', desc: 'Achats chantier, réceptions et annuaire fournisseurs intégré.' },
  { icon: '🔧', title: 'Punch list & incidents', desc: 'Réserves, sécurité et suivi jusqu\'à clôture sur le terrain.' },
  { icon: '📱', title: 'Web + mobile', desc: 'Même app sur navigateur, iOS et Android via Capacitor.' },
  { icon: '🔐', title: 'Multi-tenant sécurisé', desc: 'Données isolées par entreprise avec rôles et permissions Supabase.' },
]

const PLANS = [
  { name: 'Starter', price: '80', desc: 'Artisans & petites équipes', feats: ['3 chantiers', '5 utilisateurs', 'Devis & factures'] },
  { name: 'Pro', price: '149', desc: 'PME en croissance', feats: ['Chantiers illimités', 'CRM & avenants', 'Planning équipe'], featured: true },
  { name: 'Entreprise', price: '249', desc: 'Structures multi-sites', feats: ['Multi-agence', 'Exports & API', 'Support prioritaire'] },
]

export default function LandingPage({ onEnterApp }) {
  return (
    <div className="landing">
      <nav className="lp-nav">
        <div className="lp-brand">
          <div className="lp-logo" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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

      <header className="lp-hero lp-fade-in">
        <div className="lp-hero-grid">
          <div>
            <div className="lp-badge">BTP · SaaS · France</div>
            <h1>Gérez vos chantiers <em>sans Excel</em> ni paperasse.</h1>
            <p className="lp-lead">
              BuildEasy centralise chantiers, équipes, devis, commandes et suivi client — pour le gérant, le chef de chantier, les compagnons et le maître d&apos;ouvrage.
            </p>
            <div className="lp-hero-cta">
              <button type="button" className="lp-btn lp-btn-primary" onClick={() => onEnterApp('signup')}>
                Démarrer — 14 jours gratuits
              </button>
              <button type="button" className="lp-btn lp-btn-outline" onClick={() => onEnterApp('login')}>
                Accéder à l&apos;application
              </button>
            </div>
            <div className="lp-trust">
              <span><strong>4 rôles</strong> connectés</span>
              <span><strong>Supabase</strong> sécurisé</span>
              <span><strong>Mobile</strong> iOS & Android</span>
            </div>
          </div>

          <div className="lp-preview" aria-hidden>
            <div className="lp-preview-bar">
              <span className="lp-dot lp-dot-r" />
              <span className="lp-dot lp-dot-y" />
              <span className="lp-dot lp-dot-g" />
            </div>
            <div className="lp-preview-body">
              <div className="lp-stat-row">
                <div className="lp-stat"><b style={{ color: '#2563EB' }}>5</b><span>Chantiers actifs</span></div>
                <div className="lp-stat"><b style={{ color: '#DC2626' }}>2</b><span>Alertes</span></div>
                <div className="lp-stat"><b style={{ color: '#059669' }}>6/6</b><span>Équipe</span></div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Villa Dupont — 68% avancement</div>
              <div style={{ height: 8, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg,#2563EB,#3b82f6)', borderRadius: 99 }} />
              </div>
              <div className="lp-role-pills">
                {ROLES.map((r) => (
                  <span key={r.id} className="lp-pill" style={{ background: r.bg, color: r.color }}>{r.tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="lp-section" id="fonctionnalites">
        <h2>Tout le métier, une seule app</h2>
        <p className="lp-section-lead">Du devis à la réception de chantier, chaque acteur voit uniquement ce qui le concerne.</p>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="lp-feature">
              <div className="lp-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-section" id="roles">
        <h2>4 profils, 1 plateforme</h2>
        <p className="lp-section-lead">Permissions adaptées à chaque métier du BTP.</p>
        <div className="lp-roles">
          {ROLES.map((r) => (
            <div key={r.id} className="lp-role">
              <span className="lp-role-tag" style={{ background: r.bg, color: r.color }}>{r.tag}</span>
              <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{r.title}</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--lp-muted)', lineHeight: 1.5 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" id="tarifs">
        <h2>Des offres simples</h2>
        <p className="lp-section-lead">Commencez en Starter, évoluez quand votre équipe grandit.</p>
        <div className="lp-pricing">
          {PLANS.map((p) => (
            <div key={p.name} className={`lp-price-card${p.featured ? ' featured' : ''}`}>
              <div style={{ fontWeight: 700, color: 'var(--lp-muted)', fontSize: 13 }}>{p.name}</div>
              <div className="lp-price">{p.price}€<small>/mois</small></div>
              <p style={{ fontSize: 13, color: 'var(--lp-muted)', margin: '0 0 14px' }}>{p.desc}</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--lp-muted)', lineHeight: 1.8 }}>
                {p.feats.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta-band">
        <h2>Prêt à digitaliser vos chantiers ?</h2>
        <p>Créez votre espace en 2 minutes ou testez avec un compte démo.</p>
        <button type="button" className="lp-btn lp-btn-outline" style={{ background: '#fff', border: 'none' }} onClick={() => onEnterApp('signup')}>
          Créer mon compte gérant
        </button>
      </section>

      <footer className="lp-footer">
        <p>© {new Date().getFullYear()} BuildEasy — Gestion de chantier BTP</p>
        <p style={{ marginTop: 8 }}>
          <button type="button" className="lp-btn lp-btn-ghost" style={{ padding: '8px 12px' }} onClick={() => onEnterApp('login')}>
            Ouvrir l&apos;application →
          </button>
        </p>
      </footer>
    </div>
  )
}
