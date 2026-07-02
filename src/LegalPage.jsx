import './landing.css'

const PAGES = {
  privacy: {
    title: 'Politique de confidentialité',
    sections: [
      {
        h: 'Qui sommes-nous ?',
        p: 'BuildEasy (eu.buildeasy.app) est une application de gestion de chantier BTP éditée pour les artisans et PME du bâtiment.',
      },
      {
        h: 'Données collectées',
        p: 'Selon votre utilisation : email et mot de passe (compte), nom et entreprise, données chantier (clients, devis, heures, messages, photos de chantier). En mode hors ligne, certaines données sont stockées sur votre appareil.',
      },
      {
        h: 'Finalités',
        p: 'Fourniture du service, synchronisation cloud optionnelle (Supabase), support client et facturation d\'abonnement.',
      },
      {
        h: 'Hébergement',
        p: 'Données cloud hébergées en Europe (Supabase). Les fichiers joints au chat sont stockés de manière privée par organisation.',
      },
      {
        h: 'Conservation',
        p: 'Tant que votre compte est actif. Vous pouvez demander la suppression en contactant support@buildeasy.eu.',
      },
      {
        h: 'Vos droits',
        p: 'Accès, rectification, suppression, portabilité (RGPD). Contact : support@buildeasy.eu.',
      },
      {
        h: 'Pas de revente',
        p: 'Nous ne vendons pas vos données. Pas de publicité ciblée. Pas de tracking publicitaire.',
      },
    ],
  },
  support: {
    title: 'Support BuildEasy',
    sections: [
      {
        h: 'Contact',
        p: 'Email : support@buildeasy.eu — Réponse sous 48 h ouvrées.',
      },
      {
        h: 'Application mobile',
        p: 'BuildEasy est disponible sur iPhone et iPad (iOS 15+). Installez depuis l\'App Store ou utilisez la version web sur buildeasy.vercel.app.',
      },
      {
        h: 'Connexion & essai',
        p: 'Créez un compte gérant depuis l\'application. Essai gratuit 15 jours sur le plan Starter. Besoin d\'aide à l\'onboarding ? Écrivez-nous.',
      },
      {
        h: 'Hors ligne',
        p: 'L\'application fonctionne sans réseau sur chantier. Les modifications se synchronisent automatiquement à la reconnexion.',
      },
      {
        h: 'Problèmes connus',
        p: 'Si l\'app ne se lance pas après mise à jour : fermez-la complètement et rouvrez-la. Sinon désinstallez/réinstallez depuis l\'App Store (vos données cloud sont conservées).',
      },
    ],
  },
}

export default function LegalPage({ kind = 'privacy', onBack }) {
  const page = PAGES[kind] || PAGES.privacy

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
        {onBack && (
          <button type="button" className="lp-btn lp-btn-ghost" onClick={onBack}>← Retour</button>
        )}
      </nav>
      <article className="lp-section" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>{page.title}</h1>
        {page.sections.map((s) => (
          <section key={s.h} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{s.h}</h2>
            <p style={{ color: 'var(--lp-muted)', lineHeight: 1.7, margin: 0 }}>{s.p}</p>
          </section>
        ))}
        <p style={{ fontSize: 13, color: 'var(--lp-muted)', marginTop: 32 }}>
          Dernière mise à jour : juin 2026 · © BuildEasy
        </p>
      </article>
    </div>
  )
}
