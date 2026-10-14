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
// US-0843 : l'éleveur libre aussi, lu sur base (src/monde/eleveur.db.test.ts) ; Brune d'abord.
const elevage = vi.hoisted(() => ({
  elevageAcquis: vi.fn(async () => false),
  eleveurLibre: vi.fn(async (): Promise<{ id: number; prenom: string } | null> => ({ id: 5, prenom: "Brune" })),
}));
vi.mock("@/monde/elevage", async (original) => ({ ...(await original<object>()), elevageAcquis: elevage.elevageAcquis, eleveurLibre: elevage.eleveurLibre }));
// US-0815 : le lancement, sur base (src/monde/lancer-un-elevage.db.test.ts) : ici, ce que l'action lui passe et ce qu'elle en dit.
const lancement = vi.hoisted(() => ({
  lancerUnElevage: vi.fn(async (_pool: unknown, _territoireId: number, _especeId: string, quantite: number): Promise<{ lance: { quantite: number; eleveur: string } } | { refus: string }> => ({
    lance: { quantite, eleveur: "Brune" },
  })),
}));
vi.mock("@/monde/lancer-un-elevage", async (original) => ({ ...(await original<object>()), lancerUnElevage: lancement.lancerUnElevage }));
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
const CLIC = vi.hoisted(() => new Date("2026-10-13T12:00:00Z"));
vi.mock("@/temps/horloge", async (original) => ({ ...(await original<object>()), maintenant: () => CLIC }));
vi.mock("@/temps/rattraper", () => ({ rattraper: vi.fn(async () => new Date()) }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));

import { ELEVAGE_SANS_COUPLE, ELEVAGE_SANS_ELEVEUR } from "@/monde/elevage";
import { NOURRITURE_MANQUANTE } from "@/monde/lancer-un-elevage";
import { elever } from "./actions";
import { QUANTITE_REFUSEE } from "./quantite";

/** US-0815 : ce que dit l'action d'un Élevage de `quantite` Bêtes lancé, confié à Brune. */
const LANCE = (quantite: number) => ({ refus: null, lance: { quantite, eleveur: "Brune" } });

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

  it("ne refuse pas l'Élevage d'une Espèce au Couple réuni : il le lance (US-0815)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    expect(await demander("poule")).toEqual(LANCE(1));
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
    for (const [quantite, n] of [["1", 1], ["12", 12], [" 3 ", 3]] as const) expect(await demander("poule", quantite)).toEqual(LANCE(n));
  });

  it("refuse d'abord l'Élevage sans Couple, quelle que soit la quantité", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    expect(await demander("pigeon", "0")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
  });
});

describe("demander un éleveur libre au lancement (US-0843)", () => {
  afterEach(() => {
    elevage.elevageAcquis.mockReset();
    elevage.eleveurLibre.mockReset();
    elevage.eleveurLibre.mockResolvedValue({ id: 5, prenom: "Brune" });
    cookie.jetonDeSession.mockReset();
  });

  const connecte = () => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
  };

  it("refuse, et dit pourquoi, l'Élevage d'une Espèce au Couple réuni sans éleveur libre au Territoire de la garde", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    elevage.eleveurLibre.mockResolvedValue(null);
    expect(await demander("poule")).toEqual({ refus: ELEVAGE_SANS_ELEVEUR });
    expect(elevage.eleveurLibre).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12);
    expect(ELEVAGE_SANS_ELEVEUR).toBe("Aucun éleveur libre.");
  });

  it("ne cherche pas d'éleveur pour une Espèce sans Couple : son refus passe d'abord", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    elevage.eleveurLibre.mockResolvedValue(null);
    expect(await demander("pigeon")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    expect(elevage.eleveurLibre).not.toHaveBeenCalled();
  });

  it("ne refuse pas quand un éleveur est libre : il lance l'Élevage (US-0815)", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    expect(await demander("poule")).toEqual(LANCE(1));
  });
});

describe("lancer l'Élevage (US-0815)", () => {
  afterEach(() => {
    elevage.elevageAcquis.mockReset();
    lancement.lancerUnElevage.mockClear();
    cache.refresh.mockReset();
    cookie.jetonDeSession.mockReset();
  });

  const connecte = () => {
    cookie.jetonDeSession.mockResolvedValue("jeton-de-session");
    session.compteDeLaSession.mockResolvedValue({ id: 7, email: "nom@exemple.fr" });
  };

  it("lance l'Élevage de la quantité choisie au Territoire de la garde, à l'heure du jeu du clic, puis relit la page et sa barre", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    const formulaire = new FormData();
    formulaire.set("espece", "poule");
    formulaire.set("quantite", "4");
    formulaire.set("territoire", "99");
    expect(await elever({ refus: null }, formulaire)).toEqual(LANCE(4));
    expect(lancement.lancerUnElevage).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, "poule", 4, CLIC);
    expect(cache.refresh).toHaveBeenCalledOnce();
  });

  it("dit le refus du lancement, relu au moment de payer, et relit la page", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(true);
    lancement.lancerUnElevage.mockResolvedValueOnce({ refus: NOURRITURE_MANQUANTE });
    expect(await demander("poule", "2")).toEqual({ refus: NOURRITURE_MANQUANTE });
    expect(cache.refresh).toHaveBeenCalledOnce();
  });

  it("ne lance rien pour une demande refusée d'avance : sans Couple, sans éleveur, ou d'une quantité refusée ; la page est relue quand même", async () => {
    connecte();
    elevage.elevageAcquis.mockResolvedValue(false);
    expect(await demander("pigeon")).toEqual({ refus: ELEVAGE_SANS_COUPLE });
    elevage.elevageAcquis.mockResolvedValue(true);
    expect(await demander("poule", "0")).toEqual({ refus: QUANTITE_REFUSEE });
    // Un autre appareil a occupé l'éleveur : la page relue le dira.
    elevage.eleveurLibre.mockResolvedValueOnce(null);
    expect(await demander("poule")).toEqual({ refus: ELEVAGE_SANS_ELEVEUR });
    expect(lancement.lancerUnElevage).not.toHaveBeenCalled();
    expect(cache.refresh).toHaveBeenCalledTimes(3);
  });
});

