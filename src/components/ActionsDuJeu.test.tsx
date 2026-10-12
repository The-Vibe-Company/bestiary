import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const garde = vi.hoisted(() => ({
  joueurConnecte: vi.fn(),
  stocksALHeure: vi.fn(async () => [
    { id: "viande", nom: "Viande", famille: "nourriture", quantite: "100.000000", limite: "1000.000000", parHeure: "8.000000", entretienParHeure: "0.000000", sources: [] },
    { id: "vegetaux", nom: "Végétaux", famille: "nourriture", quantite: "1999.800000", limite: "1000.000000", parHeure: "14.000000", entretienParHeure: "0.000000", sources: [] },
    { id: "bois", nom: "Bois", famille: "materiaux", quantite: "12500.400000", limite: "1000.000000", parHeure: "4.000000", entretienParHeure: "0.000000", sources: [] },
    { id: "pierre", nom: "Pierre", famille: "materiaux", quantite: "0.999999", limite: "1000.000000", parHeure: "4.000000", entretienParHeure: "0.000000", sources: [] },
  ]),
  habitantsALHeure: vi.fn(async () => 3),
  recitsNonLusALHeure: vi.fn(async () => 0),
  voyageursALHeure: vi.fn(async () => 0),
  sansMetierALHeure: vi.fn(async () => 0),
  entretienALHeure: vi.fn(async () => "6.000000"),
  famineImminenteALHeure: vi.fn(async (): Promise<number | null> => null),
  famineALHeure: vi.fn(async (): Promise<number | null> => null),
}));
vi.mock("@/comptes/garde", () => garde);
// US-0321 : le vrai avertissement, observé pour voir ce que la barre lui confie.
const famine = vi.hoisted(() => ({ FamineImminente: vi.fn() }));
vi.mock("./FamineImminente", async (original) => {
  const { FamineImminente } = await original<typeof import("./FamineImminente")>();
  famine.FamineImminente.mockImplementation(FamineImminente);
  return famine;
});
vi.mock("@/comptes/deconnexion", () => ({ seDeconnecter: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/jeu/habitants" }));
vi.mock("next/server", async (original) => ({ ...(await original<object>()), connection: async () => {} }));

import { ActionsDuJeu } from "./ActionsDuJeu";

describe("actions du joueur dans la barre, sur les pages du jeu", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    garde.joueurConnecte.mockReset();
    garde.stocksALHeure.mockClear();
    garde.habitantsALHeure.mockClear();
    garde.recitsNonLusALHeure.mockClear();
    garde.voyageursALHeure.mockClear();
    garde.sansMetierALHeure.mockClear();
    garde.entretienALHeure.mockClear();
    garde.famineImminenteALHeure.mockClear();
    garde.famineALHeure.mockClear();
    famine.FamineImminente.mockClear();
  });
  const joueur = (chef: { nomDeChef: string | null; territoireId?: number | null; recitLu?: boolean }) =>
    garde.joueurConnecte.mockResolvedValue({ compte: { id: 7, email: "nom@exemple.fr" }, territoireId: null, recitLu: false, ...chef });

  const rendu = async () => {
    const element = await ActionsDuJeu();
    return element ? renderToStaticMarkup(element) : "";
  };

  it("montre le nom de chef, qui ouvre le menu (US-0140)", async () => {
    joueur({ nomDeChef: "Ourse" });
    const html = await rendu();
    expect(html).toMatch(/<button[^>]*aria-haspopup="menu"[^>]*>.*Ourse/);
    expect(html).not.toContain("nom@exemple.fr");
  });

  it("garde « Se déconnecter » seul tant que le joueur n'a pas de nom", async () => {
    joueur({ nomDeChef: null });
    expect(await rendu()).toMatch(/<button[^>]*>Se déconnecter<\/button>/);
  });

  it("montre ses quatre ressources, dans l'ordre, avant son nom, une fois entré dans son Foyer (US-0203)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    const html = await rendu();
    expect(garde.stocksALHeure).toHaveBeenCalledWith(12);
    const ressources = [...html.matchAll(/<img[^>]*alt="([^"]+)"[^>]*\/> <span[^>]*>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]);
    expect(ressources).toEqual([
      ["Viande", "100"],
      ["Végétaux", "1\u00a0999"],
      ["Bois", "12\u00a0500"],
      ["Pierre", "0"],
    ]);
    expect(html).toMatch(/<div[^>]*aria-label="Ressources"/);
    expect(html.indexOf("Ressources")).toBeLessThan(html.indexOf("Ourse"));
  });

  it("ne les montre pas avant le récit d'arrivée, ni sans Territoire", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    expect(await rendu()).not.toContain("Ressources");
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: false });
    expect(await rendu()).not.toContain("Ressources");
    expect(garde.stocksALHeure).not.toHaveBeenCalled();
  });

  it("compte ses Habitants juste après ses ressources, dans la même bande, en lien vers leur page (US-0304)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    const html = await rendu();
    expect(garde.habitantsALHeure).toHaveBeenCalledWith(12);
    // Le groupe des ressources se ferme, le compteur suit, la bande se ferme, puis vient le nom du chef.
    const compteur = html.match(/<\/ul><\/div><div[^>]*><a ([^>]*)><img[^>]*alt="Habitants"[^>]*\/><span[^>]*>([^<]+)<\/span><\/a><\/div><\/div><div[^>]*><button[^>]*aria-haspopup="menu"/);
    expect(compteur?.[2]).toBe("3");
    expect(compteur?.[1]).toMatch(/href="\/jeu\/habitants"/);
    expect(compteur?.[1]).toMatch(/aria-label="3 Habitants"/);
  });

  it("ne compte pas ses Habitants avant le récit d'arrivée, ni sans Territoire (US-0304)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    expect(await rendu()).not.toContain("Habitant");
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: true });
    expect(await rendu()).not.toContain("Habitant");
    joueur({ nomDeChef: null });
    expect(await rendu()).not.toContain("Habitant");
    expect(garde.habitantsALHeure).not.toHaveBeenCalled();
  });

  it("pose la navigation du jeu, à côté du logo, une fois entré dans son Foyer (US-0302)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    const html = await rendu();
    const nav = html.match(/<nav[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
    const liens = [...nav.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => [m[2].replace(/<[^>]+>/g, ""), m[1].match(/href="([^"]+)"/)?.[1], /aria-current="page"/.test(m[1])]);
    expect(liens).toEqual([
      ["Foyer", "/jeu", false],
      ["Carte", "/jeu/carte", false],
      ["Expéditions", "/jeu/expeditions/nouvelle", false],
      ["Réserve", "/jeu/reserve", false],
      ["Habitants", "/jeu/habitants", true],
      ["Récits", "/jeu/recits", false],
    ]);
    expect(html.indexOf("<nav")).toBeLessThan(html.indexOf("Ressources"));
  });

  it("compte ses Récits non lus sur l'entrée « Récits » de la navigation (US-0324)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    garde.recitsNonLusALHeure.mockResolvedValueOnce(2);
    const html = await rendu();
    expect(garde.recitsNonLusALHeure).toHaveBeenCalledWith(12);
    const recits = html.match(/<a ([^>]*href="\/jeu\/recits"[^>]*)>(.*?)<\/a>/);
    expect(recits?.[1]).toMatch(/aria-label="Récits, 2 non lus"/);
    expect(recits?.[2]).toMatch(/^<span[^>]*>Récits<\/span><span[^>]*aria-hidden="true"[^>]*>2<\/span>$/);
  });

  it("ne compte pas ses Récits avant le récit d'arrivée, ni sans Territoire (US-0324)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    await rendu();
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: true });
    await rendu();
    joueur({ nomDeChef: null });
    await rendu();
    expect(garde.recitsNonLusALHeure).not.toHaveBeenCalled();
  });

  it("signale sur l'entrée « Habitants » de la navigation les Voyageurs qui attendent aux portes (US-0332)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    garde.voyageursALHeure.mockResolvedValueOnce(2);
    const html = await rendu();
    expect(garde.voyageursALHeure).toHaveBeenCalledWith(12);
    const habitants = html.match(/<a ([^>]*href="\/jeu\/habitants"[^>]*)>(.*?)<\/a>/);
    expect(habitants?.[1]).toMatch(/aria-label="Habitants, 2 Voyageurs attendent"/);
    expect(habitants?.[2]).toMatch(/^<span[^>]*>Habitants<\/span><span[^>]*aria-hidden="true"[^>]*><\/span>$/);
  });

  it("dessine le repère en petit point citron, le même dans la barre sur ordinateur et dans l'onglet sur mobile (US-0332)", () => {
    const css = readFileSync(join(process.cwd(), "src/components/BarreHaut.module.css"), "utf8");
    const repere = css.match(/\n\.repere \{([^}]*)\}/)?.[1] ?? "";
    expect(repere).toContain("background: var(--citron);");
    expect(repere).toContain("border-radius: 999px;");
    expect(repere).toMatch(/width: 8px;[^}]*height: 8px;/);
    // Rien ne le cache ni ne le change sur mobile : il suit le nom de l'onglet.
    expect(css.slice(css.indexOf("@media (max-width: 820px)"))).not.toContain(".repere");
  });

  it("ne met pas de repère quand personne n'attend aux portes (US-0332)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    const html = await rendu();
    expect(html.match(/<a ([^>]*href="\/jeu\/habitants"[^>]*)>(.*?)<\/a>/)?.[2]).toMatch(/^<span[^>]*>Habitants<\/span>$/);
  });

  it("signale du même repère sur l'entrée « Habitants » les Habitants sans Métier, comptés avec le reste (US-0313)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    garde.sansMetierALHeure.mockResolvedValueOnce(2);
    garde.voyageursALHeure.mockResolvedValueOnce(1);
    const html = await rendu();
    expect(garde.sansMetierALHeure).toHaveBeenCalledWith(12);
    const habitants = html.match(/<a ([^>]*href="\/jeu\/habitants"[^>]*)>(.*?)<\/a>/);
    expect(habitants?.[1]).toMatch(/aria-label="Habitants, 2 sans Métier, un Voyageur attend"/);
    expect(habitants?.[2]).toMatch(/^<span[^>]*>Habitants<\/span><span[^>]*aria-hidden="true"[^>]*><\/span>$/);
  });

  it("lit les Habitants sans Métier en même temps que les Stocks, les Habitants, les Récits et les Voyageurs (US-0313)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
    const lectures: string[] = [];
    let finir = () => {};
    garde.stocksALHeure.mockImplementationOnce(async () => {
      lectures.push("stocks");
      await new Promise<void>((fin) => (finir = fin));
      return [];
    });
    garde.sansMetierALHeure.mockImplementationOnce(async () => (lectures.push("sans Métier"), 0));
    const rendue = rendu();
    await vi.waitFor(() => expect(lectures).toEqual(["stocks", "sans Métier"]));
    finir();
    await rendue;
  });

  it("ne compte pas les Habitants sans Métier avant le récit d'arrivée, ni sans Territoire (US-0313)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    await rendu();
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: true });
    await rendu();
    joueur({ nomDeChef: null });
    await rendu();
    expect(garde.sansMetierALHeure).not.toHaveBeenCalled();
  });

  it("ne compte pas les Voyageurs avant le récit d'arrivée, ni sans Territoire (US-0332)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    await rendu();
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: true });
    await rendu();
    joueur({ nomDeChef: null });
    await rendu();
    expect(garde.voyageursALHeure).not.toHaveBeenCalled();
  });

  it("n'a pas de navigation sans Territoire, avant le récit d'arrivée, ni sans nom de chef (US-0302)", async () => {
    joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
    expect(await rendu()).not.toContain("<nav");
    joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: false });
    expect(await rendu()).not.toContain("<nav");
    joueur({ nomDeChef: null });
    expect(await rendu()).not.toContain("<nav");
  });

  describe("l'avertissement « famine imminente » (US-0321)", () => {
    /** Les Stocks d'un Foyer en prairie, la Viande à `viande` et les Végétaux à `vegetaux`, sans Entretien pris sur eux. */
    const nourriture = (viande: string, vegetaux: string) => [
      { id: "viande", nom: "Viande", famille: "nourriture", quantite: viande, limite: "1000.000000", parHeure: "8.000000", entretienParHeure: "0.000000", sources: [] },
      { id: "vegetaux", nom: "Végétaux", famille: "nourriture", quantite: vegetaux, limite: "1000.000000", parHeure: "14.000000", entretienParHeure: "0.000000", sources: [] },
    ];
    /** L'avertissement, tel qu'il est écrit. */
    const avertissement = (html: string) => html.match(/<a ([^>]*data-alerte-famine[^>]*)>(.*?)<\/a>/);

    it("paraît au bas de la barre quand la Nourriture ne couvre plus que 12 heures d'Entretien, et mène à la page Habitants", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      // Douze Habitants en prairie : la Viande se vide en 2 h 30, puis les Végétaux, montés à 12,5, en 6 h 15.
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("10.000000", "7.500000"));
      garde.entretienALHeure.mockResolvedValueOnce("24.000000");
      const html = await rendu();
      expect(garde.entretienALHeure).toHaveBeenCalledWith(12);
      const lu = avertissement(html);
      expect(lu?.[1]).toMatch(/href="\/jeu\/habitants"/);
      expect(lu?.[2].replace(/<[^>]+>/g, "|").split("|").filter((t) => t.trim())).toEqual(["Famine imminente", " depuis un instant", "Nourriture pour encore 8 h", "Voir"]);
      // Après le nom du chef : c'est la dernière chose de la barre.
      expect(html.indexOf("data-alerte-famine")).toBeGreaterThan(html.indexOf("Ourse"));
      expect(html).toMatch(/<\/a>$/);
    });

    it("confie à l'avertissement le temps que tiendra la Nourriture et la vitesse du jeu, pour qu'il paraisse page ouverte", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      // 13 h 45 : pas encore sous le seuil, mais il le passera.
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("20.000000", "7.500000"));
      garde.entretienALHeure.mockResolvedValueOnce("24.000000");
      const html = await rendu();
      expect(avertissement(html)).toBeNull();
      const { heures, vitesse } = famine.FamineImminente.mock.lastCall?.[0] ?? {};
      expect(heures).toBeCloseTo(13.75, 9);
      expect(vitesse).toBe(1);
    });

    it("ne dit rien quand la Nourriture est assurée", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("10.000000", "7.500000"));
      garde.entretienALHeure.mockResolvedValueOnce("22.000000");
      expect(avertissement(await rendu())).toBeNull();
      expect(famine.FamineImminente).not.toHaveBeenCalled();
    });

    it("lit l'Entretien en même temps que les Stocks et le reste de la barre", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      const lectures: string[] = [];
      let finir = () => {};
      garde.stocksALHeure.mockImplementationOnce(async () => {
        lectures.push("stocks");
        await new Promise<void>((fin) => (finir = fin));
        return [];
      });
      garde.entretienALHeure.mockImplementationOnce(async () => (lectures.push("entretien"), "0.000000"));
      const rendue = rendu();
      await vi.waitFor(() => expect(lectures).toEqual(["stocks", "entretien"]));
      finir();
      await rendue;
    });

    it("dit depuis quand la famine est imminente, comme le Territoire le retient après le rattrapage (US-0322)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("10.000000", "7.500000"));
      garde.entretienALHeure.mockResolvedValueOnce("24.000000");
      garde.famineImminenteALHeure.mockResolvedValueOnce(3.25);
      const html = await rendu();
      expect(garde.famineImminenteALHeure).toHaveBeenCalledWith(12);
      expect(famine.FamineImminente.mock.lastCall?.[0]).toMatchObject({ depuis: 3.25 });
      expect(avertissement(html)?.[2].replace(/<[^>]+>/g, "")).toBe("Famine imminente depuis 3\u00a0h Nourriture pour encore 8\u00a0h Voir");
    });

    it("lit depuis quand en même temps que les Stocks et le reste de la barre (US-0322)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      const lectures: string[] = [];
      let finir = () => {};
      garde.stocksALHeure.mockImplementationOnce(async () => {
        lectures.push("stocks");
        await new Promise<void>((fin) => (finir = fin));
        return [];
      });
      garde.famineImminenteALHeure.mockImplementationOnce(async () => (lectures.push("famine imminente"), null));
      const rendue = rendu();
      await vi.waitFor(() => expect(lectures).toEqual(["stocks", "famine imminente"]));
      finir();
      await rendue;
    });

    it("repart des nouvelles valeurs quand le Territoire retient la famine imminente : la clé change avec elle (US-0322)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      const cle = async (depuis: number | null) => {
        garde.stocksALHeure.mockResolvedValueOnce(nourriture("10.000000", "7.500000"));
        garde.entretienALHeure.mockResolvedValueOnce("24.000000");
        garde.famineImminenteALHeure.mockResolvedValueOnce(depuis);
        const element = await ActionsDuJeu();
        const enfants = (element as { props: { children: { type: unknown; key: string | null }[] } }).props.children;
        return enfants.find((enfant) => enfant?.type === famine.FamineImminente)?.key;
      };
      expect(await cle(null)).not.toBe(await cle(0.5));
    });

    it("retire l'avertissement dès que la Nourriture est assurée, même retenu par le Territoire (US-0323)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("10.000000", "7.500000"));
      garde.entretienALHeure.mockResolvedValueOnce("22.000000");
      garde.famineImminenteALHeure.mockResolvedValueOnce(2);
      expect(avertissement(await rendu())).toBeNull();
      expect(famine.FamineImminente).not.toHaveBeenCalled();
    });

    it("garde l'avertissement retenu entre 12 et 13 heures de Nourriture, le retire au-delà (US-0323)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      // Douze Habitants : la Viande et les Végétaux tiennent ensemble la moitié de leur somme, en heures.
      const avec = async (viande: string, depuis: number | null) => {
        garde.stocksALHeure.mockResolvedValueOnce(nourriture(viande, "7.500000"));
        garde.entretienALHeure.mockResolvedValueOnce("24.000000");
        garde.famineImminenteALHeure.mockResolvedValueOnce(depuis);
        return avertissement(await rendu())?.[2].replace(/<[^>]+>/g, "") ?? null;
      };
      expect(await avec("17.500000", 2)).toBe("Famine imminente depuis 2 h Nourriture pour encore 12 h Voir");
      expect(await avec("17.500000", null)).toBeNull();
      expect(await avec("19.500000", 2)).toBeNull();
    });

    it("ne lit pas l'Entretien avant le récit d'arrivée, ni sans Territoire", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: false });
      await rendu();
      joueur({ nomDeChef: "Ourse", territoireId: null, recitLu: true });
      await rendu();
      joueur({ nomDeChef: null });
      await rendu();
      expect(garde.entretienALHeure).not.toHaveBeenCalled();
      expect(garde.famineImminenteALHeure).not.toHaveBeenCalled();
      expect(garde.famineALHeure).not.toHaveBeenCalled();
    });

    it("dit « Famine » quand le Territoire est en Famine, depuis quand il la retient après le rattrapage (US-0325)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("0.000000", "0.000000"));
      garde.entretienALHeure.mockResolvedValueOnce("40.000000");
      garde.famineImminenteALHeure.mockResolvedValueOnce(14);
      garde.famineALHeure.mockResolvedValueOnce(2);
      const html = await rendu();
      expect(garde.famineALHeure).toHaveBeenCalledWith(12);
      expect(famine.FamineImminente.mock.lastCall?.[0]).toMatchObject({ heures: 0, famine: 2 });
      expect(avertissement(html)?.[2].replace(/<[^>]+>/g, "")).toBe("Famine depuis 2 h Voir");
      expect(avertissement(html)?.[1]).toMatch(/data-famine=""/);
    });

    it("ôte « Famine » de la barre une fois la Famine finie : rien quand la Nourriture est assurée, la famine imminente sinon (US-0328)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      // Onze Habitants, les deux Stocks vides : la production paie tout juste l'Entretien.
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("0.000000", "0.000000"));
      garde.entretienALHeure.mockResolvedValueOnce("22.000000");
      garde.famineImminenteALHeure.mockResolvedValueOnce(14);
      expect(avertissement(await rendu())).toBeNull();
      // De la Nourriture ajoutée : 5 h, la famine imminente reprend selon ses règles.
      garde.stocksALHeure.mockResolvedValueOnce(nourriture("0.000000", "90.000000"));
      garde.entretienALHeure.mockResolvedValueOnce("40.000000");
      garde.famineImminenteALHeure.mockResolvedValueOnce(14);
      const html = await rendu();
      expect(avertissement(html)?.[2].replace(/<[^>]+>/g, "")).toBe("Famine imminente depuis 14 h Nourriture pour encore 5 h Voir");
      expect(avertissement(html)?.[1]).not.toMatch(/data-famine/);
    });

    it("lit depuis quand en même temps que les Stocks et le reste de la barre, et repart des nouvelles valeurs quand la Famine commence (US-0325)", async () => {
      joueur({ nomDeChef: "Ourse", territoireId: 12, recitLu: true });
      const lectures: string[] = [];
      let finir = () => {};
      garde.stocksALHeure.mockImplementationOnce(async () => {
        lectures.push("stocks");
        await new Promise<void>((fin) => (finir = fin));
        return [];
      });
      garde.famineALHeure.mockImplementationOnce(async () => (lectures.push("famine"), null));
      const rendue = rendu();
      await vi.waitFor(() => expect(lectures).toEqual(["stocks", "famine"]));
      finir();
      await rendue;
      const cle = async (depuis: number | null) => {
        garde.stocksALHeure.mockResolvedValueOnce(nourriture("0.000000", "0.000000"));
        garde.entretienALHeure.mockResolvedValueOnce("40.000000");
        garde.famineALHeure.mockResolvedValueOnce(depuis);
        const element = await ActionsDuJeu();
        const enfants = (element as { props: { children: { type: unknown; key: string | null }[] } }).props.children;
        return enfants.find((enfant) => enfant?.type === famine.FamineImminente)?.key;
      };
      expect(await cle(null)).not.toBe(await cle(0.5));
    });
  });

  it("ne montre rien sans session", async () => {
    garde.joueurConnecte.mockResolvedValue(null);
    expect(await rendu()).toBe("");
  });

  it("ne montre rien en production tant que l'entrée du jeu est fermée", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await rendu()).toBe("");
    expect(garde.joueurConnecte).not.toHaveBeenCalled();
  });
});
