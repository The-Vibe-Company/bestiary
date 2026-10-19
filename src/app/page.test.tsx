import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Connexion from "./connexion/page";
import Inscription from "./inscription/page";
import MotDePasseOublie from "./mot-de-passe-oublie/page";
import Accueil from "./page";

describe("entrée du jeu sur la page d'accueil", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("se lit dans cet ordre, le même sur un téléphone : le Monde, la devise, les entrées, puis les espèces à découvrir", () => {
    const html = renderToStaticMarkup(<Accueil />);
    const ordre = ["Le monde de Bestia", "Un monde sauvage, des bêtes à apprivoiser.", "Faites votre sac", "Créer un compte", "2000+", "Deux explorateurs"].map((t) => html.indexOf(t));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((x, y) => x - y)).toEqual(ordre);
  });

  it("montre « Créer un compte » vers l'inscription et « Se connecter » vers la connexion", () => {
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).toMatch(/<a [^>]*href="\/inscription"[^>]*>Créer un compte<\/a>/);
    expect(html).toMatch(/<a [^>]*href="\/connexion"[^>]*>Se connecter<\/a>/);
    expect(html).toContain("Faites votre sac : l&#x27;aventure vous attend.");
    expect(html).not.toContain("Ouverture prochaine");
  });

  it("laisse « Ouverture prochaine » à leur place en production, tant que l'inscription ne marche pas", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = renderToStaticMarkup(<Accueil />);
    expect(html).toContain("Ouverture prochaine");
    expect(html).not.toContain('href="/inscription"');
    expect(html).not.toContain('href="/connexion"');
  });

  it.each([
    ["inscription", Inscription, "Créer un compte"],
    ["connexion", Connexion, "Se connecter"],
    ["mot de passe oublié", MotDePasseOublie, "Mot de passe oublié"],
  ])("la page de %s répond, et reste introuvable en production", async (_, Page, titre) => {
    // La page de connexion lit ses paramètres (US-0121) : elle est asynchrone.
    const rendre = async () =>
      renderToStaticMarkup(await (Page as (p: { searchParams: Promise<object> }) => ReactNode)({ searchParams: Promise.resolve({}) }));
    const html = await rendre();
    expect(html).toContain("<h1");
    expect(html).toContain(titre);
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(rendre()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("dit à la connexion qu'une session a expiré, seulement quand elle arrive de là", async () => {
    const rendre = async (parametres: object) => renderToStaticMarkup(await Connexion({ searchParams: Promise.resolve(parametres) }));
    expect(await rendre({ expiree: "1", suite: "/jeu" })).toContain("Votre session a expiré, reconnectez-vous");
    expect(await rendre({})).not.toContain("Votre session a expiré");
  });

  it("garde dans la connexion la page du jeu où revenir, après l'avoir vérifiée", async () => {
    const rendre = async (suite: string) => renderToStaticMarkup(await Connexion({ searchParams: Promise.resolve({ suite }) }));
    expect(await rendre("/jeu/territoire")).toContain('<input type="hidden" name="suite" value="/jeu/territoire"/>');
    expect(await rendre("https://pirate.exemple")).toContain('<input type="hidden" name="suite" value="/jeu"/>');
  });

});
