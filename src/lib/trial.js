/** Jours d'essai gratuit Starter (UI + DB + Stripe). */
export const TRIAL_DAYS = 15

export function trialSignupSubtitle() {
  return `${TRIAL_DAYS} jours d'essai gratuit · Plan Starter`
}

export function trialPaymentHint() {
  return `Essai ${TRIAL_DAYS} jours sans engagement — enregistrez votre carte après la création du compte (aucun prélèvement avant la fin de l'essai).`
}
