import { afterEach, describe, expect, it, vi } from "vitest";

// La vraie garde, branchée sur une session simulée.
const cookie = vi.hoisted(() => ({ jetonDeSession: vi.fn() }));
vi.mock("@/comptes/cookie-session", () => cookie);
const session = vi.hoisted(() => ({ compteDeLaSession: vi.fn() }));
vi.mock("@/comptes/session", () => session);
const chefs = vi.hoisted(() => ({
  chefDuCompte: vi.fn(async () => ({ nom: "Ourse", territoireId: 12, recitLu: true })),
  naitreSurLaCouronne: vi.fn(async (): Promise<number | null> => null),
}));
vi.mock("@/chefs/chef", () => chefs);
// L'Élevage acquis, lu sur base (actions.db.test.ts) ; le message du refus reste le vrai.
const elevage = vi.hoisted(() => ({ elevageAcquis: vi.fn(async () => false) }));
vi.mock("@/monde/elevage", async (original) => ({ ...(await original<object>()), elevageAcquis: elevage.elevageAcquis }));
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));

import { ELEVAGE_SANS_COUPLE } from "@/monde/elevage";
import { elever } from "./actions";
import { QUANTITE_REFUSEE } from "./quantite";

/** Un Élevage demandé pour l'Espèce `espece`, comme le bloc « Élever » l'envoie (une Bête d'abord), ou par tout autre chemin. */
const demander = (espece: string | null, quantite: string | null = "1") => {
  const formulaire = new FormData();
  if (espece !== null) formulaire.set("espece", espece);
  if (quantite !== null) formulaire.set("quantite", quantite);
  return elever({ refus: null }, formulaire);
};

describe("refuser l'Élevage d'une Espèce sans Couple (US-0812)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    elevage.elevageAcquis.mockReset();
    cookie.jetonDeSession.mockReset();
  });

  const connecte = () => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
  };

  it("refuse l'Élevage d'une Espèce dont le joueur n'a pas réuni le Couple, et dit pourquoi", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    expect(await demander("pigeon")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    // Le Territoire vient de la garde, jamais du formulaire.
    expect(elevage.elevageAcquis).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "pigeon");
    expect(ELEVAGE_SANS_COUPLE).toBe("Pas d'Élevage sans Couple réuni.");
  });

  it("refuse de même une demande qui ne nomme pas une Espèce, sans rien lire", async () => {
    connecte();
    for (const espece of [null, "", "Poule et pigeon", "x".repeat(65)]) expect(await demander(espece)).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(elevage.elevageAcquis).not.toHaveBeenCalled();
  });

  it("refuse une demande forgée qui nomme deux Espèces, sans rien lire", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    const formulaire = new FormData();
    formulaire.append("espece", "poule");
    formulaire.append("espece", "pigeon");
    expect(await elever({ refus: null }, formulaire)).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(elevage.elevageAcquis).not.toHaveBeenCalled();
  });

  it("ne croit pas un Territoire écrit dans le formulaire : seul celui de la garde compte", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    const formulaire = new FormData();
    formulaire.set("espece", "poule");
    for (const champ of ["territoire", "territoireId", "territoire_id"]) formulaire.set(champ, "99");
    expect(await elever({ refus: null }, formulaire)).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(elevage.elevageAcquis).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "poule");
  });

  it("ne refuse pas l'Élevage d'une Espèce au Couple réuni : son lancement arrive avec US-0815", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    expect(await demander("poule")).toEqual({ refus: null });
  });

  it("renvoie vers la connexion sans session, sans rien lire", async () => {
    cookie.jetonDeSession.mockResolvedValue(undefined);
    await expect(demander("poule")).rejects.toMatchObject({ digest: expect.stringContaining("/connexion") });
    expect(elevage.elevageAcquis).not.toHaveBeenCalled();
  });

  it("ne fait rien en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await demander("poule")).toEqual({ refus: null });
    expect(cookie.jetonDeSession).not.toHaveBeenCalled();
  });
});

describe("refuser une quantité nulle, négative ou non entière (US-0813)", () => {
  afterEach(() => {
    elevage.elevageAcquis.mockReset();
    cookie.jetonDeSession.mockReset();
  });

  const connecte = () => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
  };

  it("refuse, avec un message clair, une quantité qui n'est pas un nombre entier d'au moins 1, même hors du bloc", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    for (const quantite of [null, "", "0", "-2", "2.5", "2,5", "1e3", "deux"]) expect(await demander("poule", quantite)).toEqual({ refus: QUANTITE_REFUSEE });
    const formulaire = new FormData();
    formulaire.set("espece", "poule");
    formulaire.append("quantite", "2");
    formulaire.append("quantite", "3");
    expect(await elever({ refus: null }, formulaire)).toEqual({ refus: QUANTITE_REFUSEE });
    expect(QUANTITE_REFUSEE).toBe("La quantité doit être un nombre entier, d'au moins 1.");
  });

  it("accepte une quantité entière d'au moins 1", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    for (const quantite of ["1", "12", " 3 "]) expect(await demander("poule", quantite)).toEqual({ refus: null });
  });

  it("refuse d'abord l'Élevage sans Couple, quelle que soit la quantité", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    expect(await demander("pigeon", "0")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
  });
});

