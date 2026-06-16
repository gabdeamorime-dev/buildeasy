#!/usr/bin/env python3
"""BuildEasy — smoke E2E (serveur dev déjà lancé sur :5195)."""
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:5195"
ERRORS = []


def login(page, email, password):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.get_by_placeholder("Email").fill(email)
    page.get_by_placeholder("Mot de passe").fill(password)
    page.get_by_role("button", name="Se connecter").click()
    page.wait_for_timeout(800)


def logout(page):
    page.get_by_role("button", name="Plus").click()
    page.wait_for_timeout(400)
    page.get_by_role("button", name="Se déconnecter").click()
    page.wait_for_timeout(500)
    expect(page.get_by_placeholder("Email")).to_be_visible()


def nav(page, label):
    page.get_by_role("button", name=label, exact=True).click()
    page.wait_for_timeout(500)


def main():
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})

        page.on("pageerror", lambda e: ERRORS.append(str(e)))

        # ── 1. Admin login + dashboard ──
        login(page, "admin@buildeasy.eu", "admin123")
        expect(page.get_by_text("Bonjour")).to_be_visible(timeout=5000)
        results.append("✓ Login admin")

        # ── 2. Créer chantier ──
        nav(page, "Chantiers")
        page.get_by_role("button", name="Créer").click()
        page.get_by_placeholder("Ex : Rénovation appartement T3...").fill("E2E Chantier Test")
        page.get_by_placeholder("Nom du client").fill("E2E Client")
        page.get_by_role("button", name="Créer le chantier").click()
        page.wait_for_timeout(600)
        expect(page.get_by_text("E2E Chantier Test")).to_be_visible()
        results.append("✓ Création chantier")

        # ── 3. Créer avenant sur ce chantier ──
        nav(page, "Accueil")
        page.get_by_role("button", name="Avenant").click()
        page.wait_for_timeout(400)
        page.locator("select.inp").first.select_option(label="E2E Chantier Test — E2E Client")
        page.get_by_placeholder("Désignation courte des travaux").fill("E2E Avenant test")
        page.locator("textarea.inp-a").fill("Description E2E")
        page.locator('input.inp[type="number"]').last.fill("1500")
        page.get_by_role("button", name="Soumettre au MOA").click()
        page.wait_for_timeout(600)
        results.append("✓ Création avenant")

        # ── 4. Vérifier avenant dans module ──
        nav(page, "Plus")
        page.get_by_role("button", name="Avenants").click()
        page.wait_for_timeout(500)
        expect(page.get_by_text("E2E Avenant test")).to_be_visible()
        results.append("✓ Avenant visible dans module")

        # ── 5. Punch list — prendre en charge ──
        nav(page, "Plus")
        page.get_by_role("button", name="Punch list").click()
        page.wait_for_timeout(500)
        btn = page.get_by_role("button", name="▶ Prendre en charge").first
        if btn.is_visible():
            btn.click()
            page.wait_for_timeout(400)
            results.append("✓ Punch — prise en charge")
        else:
            results.append("~ Punch — rien à prendre en charge")

        # ── 6. Tâches — pas de crash ──
        nav(page, "Tâches")
        expect(page.locator("body")).to_contain_text("Tâche")
        results.append("✓ Écran Tâches")

        # ── 7. Messages — pas de crash ──
        nav(page, "Messages")
        page.wait_for_timeout(400)
        results.append("✓ Écran Messages")

        # ── 8. Finances ──
        nav(page, "Plus")
        page.get_by_role("button", name="Finances").click()
        page.wait_for_timeout(500)
        results.append("✓ Écran Finances")

        logout(page)
        results.append("✓ Déconnexion admin")

        # ── 9. Chef — chantiers filtrés ──
        login(page, "chef@buildeasy.eu", "chef123")
        nav(page, "Chantiers")
        expect(page.get_by_text("Rénovation Villa Dupont")).to_be_visible()
        # Martin (chId 2) ne devrait pas être visible pour chef chIds [1,5]
        expect(page.get_by_text("Extension Pavillon Martin")).not_to_be_visible()
        results.append("✓ Chef — filtrage chIds OK")
        logout(page)

        # ── 10. Client — signer avenant ──
        login(page, "client@buildeasy.eu", "client123")
        nav(page, "Plus")
        page.get_by_role("button", name="Avenants").click()
        page.wait_for_timeout(500)
        sign_btn = page.get_by_role("button", name="Signer").first
        if sign_btn.is_visible():
            sign_btn.click()
            page.wait_for_timeout(400)
            results.append("✓ Client — signature avenant")
        else:
            results.append("~ Client — aucun avenant à signer")
        logout(page)

        # ── 11. Compte vierge — état vide ──
        login(page, "demo1@buildeasy.eu", "buildeasy")
        page.wait_for_timeout(800)
        nav(page, "Chantiers")
        expect(page.get_by_text("Aucun chantier")).to_be_visible()
        results.append("✓ Compte vierge — état vide")
        logout(page)

        browser.close()

    print("\n".join(results))
    if ERRORS:
        print("\n❌ ERREURS JS:")
        for e in ERRORS:
            print(" ", e)
        raise SystemExit(1)
    print(f"\n✅ {len(results)} tests OK — 0 erreur JS")


if __name__ == "__main__":
    main()
