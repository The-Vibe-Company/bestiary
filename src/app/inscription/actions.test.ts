import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_DEJA_UTILISEE, EMAIL_INVALIDE, EMAIL_VIDE } from "@/comptes/email";
import { MOT_DE_PASSE_TROP_COURT, MOT_DE_PASSE_TROP_LONG } from "@/comptes/mot-de-passe";
import { CHAMP_PIEGE, ETAT_INITIAL, INSCRIPTIONS_FREINEES } from "./etat";

// La création freinée a ses propres tests sur base (src/comptes/inscription.db.test.ts) ; ici, on
// regarde ce que l'envoi du formulaire en fait.
const inscription = vi.hoisted(() => ({ inscrireCompte: vi.fn() }));
vi.mock("@/comptes/inscription", () => inscription);
const POOL = vi.hoisted(() => ({ pool: "de test" }));
vi.mock("@/db", () => ({ getPool: () => POOL }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) }));
// « after » lance sa tâche une fois la réponse partie ; ici, on la garde pour l'observer.
const apres = vi.hoisted(() => ({ taches: [] as (() => unknown)[] }));
vi.mock("next/server", () => ({ after: (tache: () => unknown) => apres.taches.push(tache) }));
const courrier = vi.hoisted(() => ({ envoyerLienConfirmation: vi.fn(async () => true) }));
vi.mock("@/emails/confirmation", () => courrier);
// US-0123 : la session s'ouvre dès la création, comme à une connexion normale.
const FIN = new Date("2026-11-02T12:00:00Z");
const sessions = vi.hoisted(() => ({ ouvrirSession: vi.fn() }));
vi.mock("@/comptes/session", () => sessions);
const connexion = vi.hoisted(() => ({ noterConnexion: vi.fn(async () => {}) }));
vi.mock("@/comptes/connexion", () => connexion);
const cookie = vi.hoisted(() => ({ poserCookieSession: vi.fn(async () => {}) }));
vi.mock("@/comptes/cookie-session", () => cookie);

import { inscrire } from "./actions";

const envoi = (email: string, motDePasse = "une phrase de passe", piege = "") => {
  const donnees = new FormData();
  donnees.set("email", email);
  donnees.set("motDePasse", motDePasse);
  donnees.set(CHAMP_PIEGE, piege);
  return inscrire(ETAT_INITIAL, donnees);
};

describe("envoi du formulaire d'inscription", () => {
  beforeEach(() => {
    vi.stubEnv("EMPREINTE_RESEAU_SECRET", "secret-de-test");
    inscription.inscrireCompte.mockReset();
    inscription.inscrireCompte.mockResolvedValue({ statut: "cree", compteId: 7, email: "nom@exemple.fr", jetonConfirmation: "jeton123" });
    sessions.ouvrirSession.mockReset().mockResolvedValue({ jeton: "jeton-de-session", expireLe: FIN });
    connexion.noterConnexion.mockClear();
    cookie.poserCookieSession.mockClear();
    courrier.envoyerLienConfirmation.mockClear();
    apres.taches = [];
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["nom@", EMAIL_INVALIDE],
    ["nom.fr", EMAIL_INVALIDE],
    ["", EMAIL_VIDE],
  ])("refait la vérification du navigateur : « %s » est refusée", async (email, message) => {
    expect(await envoi(email)).toEqual({ erreurs: { email: message }, email });
  });

  it.each([
    ["trop court", "court", MOT_DE_PASSE_TROP_COURT],
    ["démesuré", "a".repeat(129), MOT_DE_PASSE_TROP_LONG],
  ])("refait la vérification du mot de passe : un mot de passe %s est refusé", async (_, motDePasse, message) => {
    expect(await envoi("nom@exemple.fr", motDePasse)).toEqual({ erreurs: { motDePasse: message }, email: "nom@exemple.fr" });
  });

  it("ne renvoie jamais le mot de passe au formulaire", async () => {
    expect(JSON.stringify(await envoi("nom@", "court-secret"))).not.toContain("court-secret");
  });

  it("crée le compte quand le formulaire est valide, avec l'empreinte de la connexion et jamais son adresse", async () => {
    expect(await envoi("Nom@Exemple.fr")).toEqual({ erreurs: {}, email: "Nom@Exemple.fr", cree: true, compteId: 7 });
    const [pool, demande] = inscription.inscrireCompte.mock.calls[0];
    expect(pool).toBe(POOL);
    expect(demande).toMatchObject({ email: "Nom@Exemple.fr", motDePasse: "une phrase de passe" });
    expect(demande.empreinteReseau).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(demande)).not.toContain("203.0.113.7");
  });

  it("envoie le lien de confirmation après la réponse, sans la faire attendre", async () => {
    await envoi("Nom@Exemple.fr");
    expect(courrier.envoyerLienConfirmation).not.toHaveBeenCalled();
    expect(apres.taches).toHaveLength(1);
    await apres.taches[0]();
    expect(courrier.envoyerLienConfirmation).toHaveBeenCalledWith("nom@exemple.fr", "jeton123");
  });

  it("n'envoie aucun lien quand rien n'est créé", async () => {
    inscription.inscrireCompte.mockResolvedValue({ statut: "deja-inscrite" });
    await envoi("nom@exemple.fr");
    expect(apres.taches).toHaveLength(0);
  });

  it("connecte le nouveau joueur dès la création, comme une connexion normale", async () => {
    await envoi("nom@exemple.fr");
    expect(sessions.ouvrirSession).toHaveBeenCalledWith(POOL, 7);
    expect(connexion.noterConnexion).toHaveBeenCalledWith(POOL, 7);
    expect(cookie.poserCookieSession).toHaveBeenCalledWith("jeton-de-session", FIN);
  });

  it.each([
    ["l'adresse a déjà un compte", { statut: "deja-inscrite" }],
    ["les inscriptions sont freinées", { statut: "freinee" }],
  ])("n'ouvre aucune session quand %s", async (_, resultat) => {
    inscription.inscrireCompte.mockResolvedValue(resultat);
    await envoi("nom@exemple.fr");
    expect(sessions.ouvrirSession).not.toHaveBeenCalled();
    expect(cookie.poserCookieSession).not.toHaveBeenCalled();
  });

  it("ne crée rien quand un champ est refusé", async () => {
    await envoi("nom@");
    await envoi("nom@exemple.fr", "court");
    expect(inscription.inscrireCompte).not.toHaveBeenCalled();
  });

  it("dit quand l'adresse a déjà un compte", async () => {
    inscription.inscrireCompte.mockResolvedValue({ statut: "deja-inscrite" });
    expect(await envoi("nom@exemple.fr")).toEqual({ erreurs: { email: EMAIL_DEJA_UTILISEE }, email: "nom@exemple.fr" });
  });

  it("refuse poliment au-delà de la limite de l'heure, sans dire comment contourner", async () => {
    inscription.inscrireCompte.mockResolvedValue({ statut: "freinee" });
    expect(await envoi("nom@exemple.fr")).toEqual({ erreurs: { general: INSCRIPTIONS_FREINEES }, email: "nom@exemple.fr" });
    expect(INSCRIPTIONS_FREINEES).not.toMatch(/connexion|adresse|réseau|heure|\d/i);
    expect(INSCRIPTIONS_FREINEES).not.toMatch(/\bIP\b/);
  });

  it("refuse un robot qui remplit le champ piège, sans rien créer", async () => {
    expect(await envoi("nom@exemple.fr", "une phrase de passe", "https://robot.exemple")).toEqual({
      erreurs: { general: INSCRIPTIONS_FREINEES },
      email: "nom@exemple.fr",
    });
    expect(inscription.inscrireCompte).not.toHaveBeenCalled();
  });

  it("n'écrit jamais le mot de passe dans un journal", async () => {
    const journal = (["log", "info", "warn", "error", "debug"] as const).map((niveau) => vi.spyOn(console, niveau));
    await envoi("nom@exemple.fr", "un secret bien gardé");
    await envoi("nom@", "un secret bien gardé");
    inscription.inscrireCompte.mockRejectedValue(new Error("base injoignable"));
    await envoi("nom@exemple.fr", "un secret bien gardé").catch(() => {});
    for (const espion of journal) expect(JSON.stringify(espion.mock.calls)).not.toContain("un secret bien gardé");
  });

  it("ne fait rien en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await envoi("nom@")).toEqual(ETAT_INITIAL);
    expect(inscription.inscrireCompte).not.toHaveBeenCalled();
  });
});
