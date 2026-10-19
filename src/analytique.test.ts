import { describe, expect, it } from "vitest";
import { CLE_POSTHOG_PUBLIQUE, masquerLesJetons, pageAJeton, RELAIS_POSTHOG, reglagesPostHog } from "./analytique";

describe("réglages de la mesure d'audience", () => {
  it("ne mesure rien hors du jeu construit sans clé", () => {
    expect(reglagesPostHog({ production: false })).toBeNull();
    expect(reglagesPostHog({ cle: " ", production: false })).toBeNull();
  });

  it("mesure en local quand la clé est donnée", () => {
    expect(reglagesPostHog({ cle: "phc_essai", production: false })).toEqual({ cle: "phc_essai", hote: RELAIS_POSTHOG });
  });

  it("prend la clé publique du projet dans le jeu construit, et passe par le relais du jeu", () => {
    expect(reglagesPostHog({ production: true })).toEqual({ cle: CLE_POSTHOG_PUBLIQUE, hote: RELAIS_POSTHOG });
  });

  it("suit la clé et l'adresse données", () => {
    expect(reglagesPostHog({ cle: "phc_autre", hote: "https://eu.i.posthog.com", production: true })).toEqual({
      cle: "phc_autre",
      hote: "https://eu.i.posthog.com",
    });
  });
});

describe("les jetons secrets des adresses, masqués avant tout envoi", () => {
  it("masque le jeton d'une page de réinitialisation ou de confirmation, où qu'il soit dans l'événement", () => {
    const quand = new Date("2026-10-15T10:00:00Z");
    expect(
      masquerLesJetons({
        event: "$pageview",
        timestamp: quand,
        properties: {
          $current_url: "https://bestia-2.vercel.app/reinitialiser/Ab-12_cd?x=1#h",
          $pathname: "/confirmer/Zz9-_",
          $referrer: "https://bestia-2.vercel.app/confirmer/Zz9-_/",
          liste: ["/reinitialiser/Ab-12_cd", 3, null],
        },
        $set_once: { $initial_current_url: "https://bestia-2.vercel.app/reinitialiser/Ab-12_cd" },
      }),
    ).toEqual({
      event: "$pageview",
      timestamp: quand,
      properties: {
        $current_url: "https://bestia-2.vercel.app/reinitialiser/:jeton?x=1#h",
        $pathname: "/confirmer/:jeton",
        $referrer: "https://bestia-2.vercel.app/confirmer/:jeton/",
        liste: ["/reinitialiser/:jeton", 3, null],
      },
      $set_once: { $initial_current_url: "https://bestia-2.vercel.app/reinitialiser/:jeton" },
    });
  });

  it("masque aussi un jeton dans une clé, comme les adresses des cartes de chaleur", () => {
    expect(masquerLesJetons({ "https://bestia-2.vercel.app/reinitialiser/Ab-12_cd": [{ x: 1 }] })).toEqual({
      "https://bestia-2.vercel.app/reinitialiser/:jeton": [{ x: 1 }],
    });
  });

  it("reconnaît les pages à jeton, où la mesure ne démarre pas", () => {
    expect(pageAJeton("/reinitialiser/Ab-12_cd")).toBe(true);
    expect(pageAJeton("/confirmer/Zz9-_")).toBe(true);
    for (const chemin of ["/", "/jeu", "/connexion", "/mot-de-passe-oublie", "/reinitialiser"]) expect(pageAJeton(chemin)).toBe(false);
  });

  it("laisse les autres adresses telles quelles", () => {
    for (const adresse of ["https://bestia-2.vercel.app/jeu/reserve/pigeon", "/connexion?suite=/jeu", "/mot-de-passe-oublie"]) {
      expect(masquerLesJetons(adresse)).toBe(adresse);
    }
  });
});
