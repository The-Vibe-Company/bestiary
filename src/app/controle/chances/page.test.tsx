import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIMULATION_DES_CHANCES_RENCONTRES } from "@/reglages";
import type { SimulationDesChances } from "./simulation";

const entetes = vi.hoisted(() => ({ authorization: null as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(entetes.authorization ? { authorization: entetes.authorization } : {}),
}));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));
vi.mock("@/db", () => ({ getPool: () => ({}) }));
const simulation = vi.hoisted(() => ({ simulerLesChances: vi.fn(), lireDesForces: vi.fn() }));
vi.mock("./simulation", async (original) => {
  const vraie = await original<typeof import("./simulation")>();
  simulation.simulerLesChances.mockImplementation(vraie.simulerLesChances);
  simulation.lireDesForces.mockImplementation(vraie.lireDesForces);
  return simulation;
});

import { proxy } from "@/proxy";
import Chances from "./page";

const MOT_DE_PASSE = "mot-de-passe-d-essai";
const ouvrir = (recherche: Record<string, string> = {}) => Chances({ params: Promise.resolve({}), searchParams: Promise.resolve(recherche) } as PageProps<"/controle/chances">);
/** La page en HTML, ses espaces fines (« 10 000 ») rendues en espaces simples. */
const afficher = async (recherche: Record<string, string> = {}) => renderToStaticMarkup(await ouvrir(recherche)).replaceAll(" ", " ").replaceAll(" ", " ");
const connecte = () => {
  entetes.authorization = `Basic ${Buffer.from(`dev:${MOT_DE_PASSE}`).toString("base64")}`;
};
const deuxDecimales = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Le bloc dont le titre est `titre`, jusqu'à la fin de son tableau. */
const bloc = (html: string, titre: string) => html.slice(html.indexOf(`>${titre}</h2>`), html.indexOf("</table>", html.indexOf(`>${titre}</h2>`)));

describe("page de simulation des chances (US-0968)", () => {
  beforeEach(() => {
    vi.stubEnv("CONTROLE_MOT_DE_PASSE", MOT_DE_PASSE);
    simulation.simulerLesChances.mockClear();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    entetes.authorization = null;
  });

  it("est inaccessible aux joueurs : le navigateur demande le mot de passe, et la page répond « introuvable » sans lui", async () => {
    const reponse = await proxy(new NextRequest("https://bestia.test/controle/chances?forces=1,3"));
    expect(reponse?.status).toBe(401);
    await expect(ouvrir({ forces: "1,3" })).rejects.toMatchObject({ digest: expect.stringContaining("404") });
  });

  it("simule d'emblée deux escortes de forces 1 et 3, puis trois de forces 1, 2 et 3, et donne le résultat du contrôle en tête", async () => {
    connecte();
    const html = await afficher();
    expect(simulation.simulerLesChances.mock.calls).toEqual([[{ forces: [1, 3] }], [{ forces: [1, 2, 3] }]]);
    expect(html).toContain("<h1");
    expect(html).toMatch(/<a [^>]*href="\/controle"[^>]*>Contrôle<\/a>/);
    expect(html).toContain("Contrôle réussi");
    expect(html).not.toContain("Contrôle échoué");
    expect(html).toContain(`${SIMULATION_DES_CHANCES_RENCONTRES.toLocaleString("fr-FR").replaceAll(" ", " ")} Rencontres par simulation · Tolérance : 2 points`);
    expect(html.indexOf("Contrôle réussi")).toBeLessThan(html.indexOf(">Forces 1 et 3</h2>"));
    expect(html.indexOf(">Forces 1 et 3</h2>")).toBeLessThan(html.indexOf(">Forces 1, 2 et 3</h2>"));
  });

  it("affiche un tableau par simulation : chaque escorte, sa force, ses victoires, sa part obtenue et sa part attendue", async () => {
    connecte();
    const html = await afficher();
    const [deux, trois] = simulation.simulerLesChances.mock.results.map((r) => r.value as SimulationDesChances);
    expect(html.match(/<table/g)).toHaveLength(2);
    expect(html).toMatch(/<th[^>]*>Escorte<\/th><th[^>]*>Force<\/th><th[^>]*>Victoires<\/th><th[^>]*>Obtenue<\/th><th[^>]*>Attendue<\/th>/);
    for (const [titre, s] of [
      ["Forces 1 et 3", deux],
      ["Forces 1, 2 et 3", trois],
    ] as const) {
      const tableau = bloc(html, titre);
      s.parts.forEach((p, i) => {
        const victoires = p.victoires.toLocaleString("fr-FR").replaceAll(" ", " ");
        expect(tableau).toContain(`<td>${"ABCDEFGH"[i]}</td><td>${p.force}</td><td>${victoires}</td><td>${deuxDecimales(p.obtenue)} %</td><td>${deuxDecimales(p.attendue)} %</td>`);
      });
    }
    // La plus faible des deux l'emporte environ une fois sur quatre.
    expect(bloc(html, "Forces 1 et 3")).toContain("<td>25,00 %</td>");
  });

  it("simule aussi les forces saisies, en plus des deux contrôles", async () => {
    connecte();
    const html = await afficher({ forces: "2, 5 9" });
    expect(simulation.simulerLesChances.mock.calls.at(-1)).toEqual([{ forces: [2, 5, 9] }]);
    expect(html).toMatch(/<input(?=[^>]*name="forces")(?=[^>]*value="2, 5 9")[^>]*aria-label="Forces des escortes"/);
    expect(html).toContain(">Forces 2, 5 et 9</h2>");
    expect(html.match(/<table/g)).toHaveLength(3);
  });

  it("refuse des forces qui n'en sont pas, en le disant sous le champ, et garde les deux contrôles", async () => {
    connecte();
    const html = await afficher({ forces: "abc" });
    expect(html).toContain("De 2 à 8 forces, des nombres entiers positifs ou nuls séparés par des virgules, pas « abc ».");
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(html.match(/<table/g)).toHaveLength(2);
  });

  it("dit pourquoi le contrôle échoue, et marque les parts en cause dans leur tableau", async () => {
    connecte();
    const echouee: SimulationDesChances = {
      forces: [1, 3],
      rencontres: 10_000,
      tolerance: 1,
      parts: [
        { force: 1, victoires: 2_310, obtenue: 23.1, attendue: 25, horsTolerance: true },
        { force: 3, victoires: 7_690, obtenue: 76.9, attendue: 75, horsTolerance: true },
      ],
      reussie: false,
    };
    simulation.simulerLesChances.mockReturnValueOnce(echouee);
    const html = await afficher();
    expect(html).toContain("Contrôle échoué");
    expect(html).not.toContain("Contrôle réussi");
    expect(html).toContain("<li>Forces 1 et 3 · A (force 1) : 23,10 % au lieu de 25,00 %</li>");
    expect(html).toContain("<li>Forces 1 et 3 · B (force 3) : 76,90 % au lieu de 75,00 %</li>");
    expect(html.match(/<td class="[^"]*echec[^"]*">/g)).toHaveLength(2);
  });
});
