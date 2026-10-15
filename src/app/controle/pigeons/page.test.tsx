import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT, SIMULATION_DES_PIGEONS_EXPEDITIONS, SIMULATION_DES_PIGEONS_JOURS } from "@/reglages";
import type { SimulationDesPigeons } from "./simulation";

const entetes = vi.hoisted(() => ({ authorization: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(entetes.authorization ? { authorization: entetes.authorization } : {}),
}));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
const simulation = vi.hoisted(() => ({ simulerLesPigeons: vi.fn() }));
vi.mock("./simulation", async (original) => {
  const vraie = await original<typeof import("./simulation")>();
  simulation.simulerLesPigeons.mockImplementation(vraie.simulerLesPigeons);
  return { ...vraie, simulerLesPigeons: simulation.simulerLesPigeons };
});

import { proxy } from "@/proxy";
import Pigeons from "./page";

const MOT_DE_PASSE = "mot-de-passe-d-essai";
/** La page en HTML, ses espaces fines (« 10 000 ») rendues en espaces simples. */
const afficher = async () => renderToStaticMarkup(await Pigeons()).replaceAll(" ", " ").replaceAll(" ", " ");
const connecte = () => {
  entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
};
const nombre = (n: number) => n.toLocaleString("fr-FR").replaceAll(" ", " ");
const deux = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const un = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

describe("page de simulation des pigeons éclaireurs (US-0974)", () => {
  beforeEach(() => {
    vi.stubEnv("CONTROLE_MOT_DE_PASSE", MOT_DE_PASSE);
    simulation.simulerLesPigeons.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    entetes.authorization = null;
  });

  it("est inaccessible aux joueurs : le navigateur demande le mot de passe, et la page répond « introuvable » sans lui", async () => {
    const reponse = await proxy(new NextRequest("https://bestia.test/controle/pigeons"));
    expect(reponse?.status).toBe(401);
    await expect(Pigeons()).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it(
    "compare des Expéditions identiques sans et avec 1 à 6 Éclaireurs : Rencontres, écart, Cases révélées, et le résultat du contrôle en tête",
    async () => {
      connecte();
      const html = await afficher();
      const s = simulation.simulerLesPigeons.mock.results[0].value as SimulationDesPigeons;
      expect(html).toMatch(/<h1[^>]*>Pigeons éclaireurs<\/h1>/);
      expect(html).toMatch(/<a [^>]*href="\/controle"[^>]*>Contrôle<\/a>/);
      expect(html).toContain("Contrôle réussi");
      expect(html).toContain(
        `${nombre(SIMULATION_DES_PIGEONS_EXPEDITIONS)} Expéditions identiques sur ${SIMULATION_DES_PIGEONS_JOURS} jours · Séjour 4 h · Écart minimal : ${SIMULATION_DES_PIGEONS_ECART_MINIMAL_POURCENT} %`,
      );
      expect(html.indexOf("Contrôle réussi")).toBeLessThan(html.indexOf("<table"));
      expect(html).toMatch(/<th[^>]*>Éclaireurs<\/th><th[^>]*>Vue en plus<\/th><th[^>]*>Rencontres<\/th><th[^>]*>Écart<\/th><th[^>]*>Cases révélées<\/th><th[^>]*>En plus<\/th>/);
      expect(html).toContain(`<td>Aucun</td><td>—</td><td>${nombre(s.sans.rencontres)}</td><td>—</td><td>${un(s.sans.casesRevelees)}</td><td>—</td>`);
      expect(html).toContain(`<td>1</td><td>20 min</td><td>${nombre(s.lignes[0].rencontres)}</td><td>${deux(s.lignes[0].ecart)} %</td>`);
      expect(html).toContain(`<td>6</td><td>2 h</td><td>${nombre(s.lignes[5].rencontres)}</td>`);
      expect(html).toContain("<td>4</td><td>1 h 20</td>");
    },
    60_000,
  );

  it("dit pourquoi le contrôle échoue, et marque l'écart en cause", async () => {
    connecte();
    const echouee: SimulationDesPigeons = {
      expeditions: 10_000,
      jours: 365,
      sejourMinutes: 240,
      ecartMinimal: 5,
      sans: { rencontres: 4_000, casesRevelees: 27.6 },
      lignes: [
        { eclaireurs: 1, vueMinutes: 20, rayonEnPlus: 1, rencontres: 4_120, ecart: 3, casesRevelees: 51.1, casesEnPlus: 23.5, sousLEcart: true },
        { eclaireurs: 2, vueMinutes: 40, rayonEnPlus: 2, rencontres: 4_260, ecart: 6.5, casesRevelees: 80.6, casesEnPlus: 53, sousLEcart: false },
      ],
      reussie: false,
    };
    simulation.simulerLesPigeons.mockReturnValueOnce(echouee);
    const html = await afficher();
    expect(html).toContain("Contrôle échoué");
    expect(html).not.toContain("Contrôle réussi");
    expect(html).toContain("<li>1 Éclaireur : 3,00 % de Rencontres en plus, sous 5 %</li>");
    expect(html.match(/<td class="[^"]*echec[^"]*">/g)).toHaveLength(1);
  });
});
