import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChoixDuDepart, Depart } from "@/expeditions/depart";

const garde = vi.hoisted(() => ({ exigerCompte: vi.fn() }));
vi.mock("@/comptes/garde", () => garde);
vi.mock("@/db", () => ({ getPool: () => ({}) }));
// Le départ lui-même, sur base (src/expeditions/depart.db.test.ts) : ici, ce que l'action lui confie.
const depart = vi.hoisted(() => ({ lancerLExpedition: vi.fn(async (): Promise<Depart> => ({ expeditionId: 5 })) }));
vi.mock("@/expeditions/depart", () => depart);
const INSTANT = new Date("2026-10-09T07:42:13.250Z");
vi.mock("@/temps/horloge", () => ({ maintenant: () => INSTANT }));
const cache = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/cache", () => cache);
const navigation = vi.hoisted(() => ({
  RedirectType: { push: "push", replace: "replace" },
  redirect: vi.fn((chemin: string, type = "push") => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${type};${chemin};303;` });
  }),
}));
vi.mock("next/navigation", () => navigation);

import { partir } from "./actions";

/** Le formulaire de départ tel que l'écran l'envoie : chaque champ, autant de fois qu'il est dit. */
const formulaire = (champs: [string, string][]) => {
  const donnees = new FormData();
  for (const [nom, valeur] of champs) donnees.append(nom, valeur);
  return donnees;
};
/** Une forêt à 7 Cases, deux explorateurs, trois souris et une poule, et 4 h de séjour. */
const COMPLET: [string, string][] = [
  ["q", "3"],
  ["r", "-5"],
  ["explorateurs", "2"],
  ["escorte", "souris.3"],
  ["escorte", "poule.1"],
  ["sejour", "240"],
];
/** Ce que l'action confie au départ pour le formulaire COMPLET. */
const CHOIX: ChoixDuDepart = {
  destination: { q: 3, r: -5 },
  explorateurs: 2,
  escorte: new Map([
    ["souris", 3],
    ["poule", 1],
  ]),
  eclaireurs: new Map(),
  sejourMinutes: 240,
};
/** Un formulaire COMPLET, sauf le champ `nom`, remplacé par les `valeurs` (aucune : retiré). */
const sauf = (nom: string, ...valeurs: string[]) => formulaire([...COMPLET.filter(([n]) => n !== nom), ...valeurs.map((v): [string, string] => [nom, v])]);

describe("lancer l'Expédition depuis l'écran (US-0911)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    garde.exigerCompte.mockReset();
    depart.lancerLExpedition.mockClear();
    cache.refresh.mockClear();
    navigation.redirect.mockClear();
  });
  const connecte = () => garde.exigerCompte.mockResolvedValue({ id: 7, email: "nom@exemple.fr", nomDeChef: "Ourse", territoireId: 12, recitLu: true });

  it("passe par la garde, fait partir l'Expédition choisie à l'heure du jeu, puis mène à la liste des Expéditions en cours", async () => {
    connecte();
    await expect(partir({ refus: null }, formulaire(COMPLET))).rejects.toMatchObject({ digest: expect.stringContaining(";/jeu/expeditions;") });
    expect(garde.exigerCompte).toHaveBeenCalledWith("/jeu/expeditions/nouvelle");
    expect(depart.lancerLExpedition).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, CHOIX, INSTANT);
    // À la place de l'écran dans l'historique : un retour arrière ne ramène pas au formulaire, prêt à repartir.
    expect(navigation.redirect).toHaveBeenCalledExactlyOnceWith("/jeu/expeditions", "replace");
  });

  it("part sans escorte quand le formulaire n'en dit rien (US-0909)", async () => {
    connecte();
    await expect(partir({ refus: null }, sauf("escorte"))).rejects.toThrow("NEXT_REDIRECT");
    expect(depart.lancerLExpedition).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, { ...CHOIX, escorte: new Map() }, INSTANT);
  });

  it("dit le refus du départ sous « Partir », et relit l'écran, qui montre ce qui reste libre", async () => {
    connecte();
    depart.lancerLExpedition.mockResolvedValueOnce({ refus: "Départ refusé : un explorateur n'est plus libre." });
    expect(await partir({ refus: null }, formulaire(COMPLET))).toEqual({ refus: "Départ refusé : un explorateur n'est plus libre." });
    expect(cache.refresh).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("s'arrête à la garde sans session : rien ne part", async () => {
    garde.exigerCompte.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/connexion;307;" }));
    await expect(partir({ refus: null }, formulaire(COMPLET))).rejects.toMatchObject({ digest: expect.stringContaining("/connexion") });
    expect(depart.lancerLExpedition).not.toHaveBeenCalled();
  });

  it("ne fait rien tant que l'entrée du jeu est fermée en production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    connecte();
    expect(await partir({ refus: null }, formulaire(COMPLET))).toEqual({ refus: null });
    expect(garde.exigerCompte).not.toHaveBeenCalled();
    expect(depart.lancerLExpedition).not.toHaveBeenCalled();
  });

  it("ne fait rien pour un chef encore sans Territoire", async () => {
    garde.exigerCompte.mockResolvedValue({ territoireId: null });
    expect(await partir({ refus: null }, formulaire(COMPLET))).toEqual({ refus: null });
    expect(depart.lancerLExpedition).not.toHaveBeenCalled();
  });

  it.each([
    ["sans destination", sauf("q")],
    ["une destination mal dite", sauf("r", "-5.5")],
    ["une destination que la base ne tiendrait pas", sauf("q", "9999999999")],
    ["sans explorateur", sauf("explorateurs")],
    ["des explorateurs mal dits", sauf("explorateurs", "deux")],
    ["un séjour qu'on n'aurait pas pu choisir", sauf("sejour", "45")],
    ["sans séjour", sauf("sejour")],
    ["une escorte mal dite", sauf("escorte", "souris.trois")],
    ["une Espèce mal écrite", sauf("escorte", "Souris.3")],
    ["des Éclaireurs mal dits (US-0976)", sauf("eclaireurs", "pigeon")],
  ])("ne fait rien d'un formulaire que l'écran n'enverrait pas : %s", async (_, donnees) => {
    connecte();
    expect(await partir({ refus: null }, donnees)).toEqual({ refus: null });
    expect(depart.lancerLExpedition).not.toHaveBeenCalled();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("garde la première fois qu'une Espèce est dite, et laisse au départ de compter les Bêtes à zéro ou de trop", async () => {
    connecte();
    await expect(partir({ refus: null }, sauf("escorte", "souris.3", "souris.9", "poule.0"))).rejects.toThrow("NEXT_REDIRECT");
    expect(depart.lancerLExpedition).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      12,
      {
        ...CHOIX,
        escorte: new Map([
          ["souris", 3],
          ["poule", 0],
        ]),
      },
      INSTANT,
    );
  });

  it("confie au départ les Éclaireurs que l'écran envoie, à côté de l'escorte, la première fois qu'une Espèce est dite (US-0976)", async () => {
    connecte();
    await expect(partir({ refus: null }, sauf("eclaireurs", "pigeon.2", "pigeon.5"))).rejects.toThrow("NEXT_REDIRECT");
    expect(depart.lancerLExpedition).toHaveBeenCalledExactlyOnceWith(expect.anything(), 12, { ...CHOIX, eclaireurs: new Map([["pigeon", 2]]) }, INSTANT);
  });
});
