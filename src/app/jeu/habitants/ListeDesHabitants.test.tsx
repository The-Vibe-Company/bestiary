// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Les actions serveur, tenues en suspens jusqu'à ce que le test les laisse finir. */
const actions = vi.hoisted(() => {
  const enCours: Array<() => void> = [];
  const enSuspens = () => new Promise<void>((finir) => enCours.push(finir));
  return {
    enCours,
    donnerUnMetier: vi.fn(enSuspens),
    retirerLeMetier: vi.fn(enSuspens),
    renvoyerUnHabitant: vi.fn(enSuspens),
    ajouterAuMetier: vi.fn(enSuspens),
    retirerDuMetier: vi.fn(enSuspens),
  };
});
vi.mock("./actions", () => actions);

/**
 * US-0314 : Next.js relie window.history.replaceState à useSearchParams ; la simulation fait de même :
 * la liste relit l'adresse à chaque changement, sans recharger la page.
 */
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const abonnes = new Set<() => void>();
  const remplacer = window.history.replaceState.bind(window.history);
  window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
    remplacer(...args);
    abonnes.forEach((prevenir) => prevenir());
  };
  const suivre = (prevenir: () => void) => {
    abonnes.add(prevenir);
    return () => abonnes.delete(prevenir);
  };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(suivre, () => window.location.search)) };
});

import { TAILLES_DE_MEDAILLON } from "@/components/Medaillon";
import { type HabitantAffiche, ListeDesHabitants, type MetierAuChoix, type MetierDuTableau } from "./ListeDesHabitants";

/** L'adresse de la page Habitants, avec `recherche` (« ?metier=bucheron ») : un rechargement, ou un lien. */
const ouvrir = (recherche = "") => window.history.replaceState(null, "", `/jeu/habitants${recherche}`);

const METIERS: MetierAuChoix[] = [
  ["explorateur", "Explorateur"],
  ["chasseur", "Chasseur"],
  ["cueilleur", "Cueilleur"],
  ["bucheron", "Bûcheron"],
  ["mineur", "Mineur"],
  ["chercheur", "Chercheur"],
  ["batisseur", "Bâtisseur"],
  ["eleveur", "Éleveur"],
].map(([id, nom]) => ({ id, nom, icone: `/illustrations/metiers/${id}.webp` }));

const HABITANTS: HabitantAffiche[] = [
  { id: 40, prenom: "Arno", metier: null, etat: "libre" },
  { id: 41, prenom: "Brune", metier: null, etat: "libre" },
  { id: 42, prenom: "Cael", metier: "Chasseur", etat: "libre" },
];

/** Laisse finir les actions en suspens : React attend qu'elles aient toutes fini pour clore leurs transitions. */
const finirLesActions = () => act(async () => actions.enCours.splice(0).forEach((finir) => finir()));

afterEach(async () => {
  await finirLesActions();
  cleanup();
  for (const action of [actions.donnerUnMetier, actions.retirerLeMetier, actions.renvoyerUnHabitant, actions.ajouterAuMetier, actions.retirerDuMetier]) action.mockClear();
  ouvrir();
});

/** Ce qu'un élément dit à un lecteur d'écran : ses morceaux de texte, sans ce qui ne sert qu'aux yeux, séparés d'une espace. */
function nom(element: Element) {
  const morceaux: string[] = [];
  const lire = (noeud: Node) => {
    if (noeud.nodeType === Node.TEXT_NODE) morceaux.push((noeud.textContent ?? "").trim());
    else if (!(noeud as Element).hasAttribute("aria-hidden")) noeud.childNodes.forEach(lire);
  };
  lire(element);
  return morceaux.filter(Boolean).join(" ");
}
/** US-0309 : la rangée des compteurs, dans le rail. */
const rangeeDesEffectifs = () => screen.getByRole("list", { name: "Effectifs par Métier" });
/** US-0309 : chaque compteur tel qu'on l'entend : « Bûcheron 2 » ; « Tous » (US-0314) n'en est pas un. */
const effectifs = () =>
  within(rangeeDesEffectifs())
    .getAllByRole("button")
    .map(nom)
    .filter((texte) => texte !== "Tous");
/** US-0314 : le bouton d'un compteur, par son nom (« Bûcheron », « Sans Métier »), ou « Tous ». */
const compteur = (n: string) => within(rangeeDesEffectifs()).getByRole("button", { name: new RegExp(`^${n}( \\d+)?$`) });
/** US-0314 : les boutons pressés de la rangée, par ce qu'ils disent. */
const presses = () =>
  within(rangeeDesEffectifs())
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map(nom);
/** Le tableau des Habitants. */
const tableau = () => screen.getByRole("table");
/** Les lignes d'Habitants du tableau, dans son ordre : celles qu'ouvre le prénom. */
const lignesDHabitants = () => (screen.queryByRole("table") ? [...tableau().querySelectorAll("tr")].filter((tr) => tr.querySelector(':scope > th[scope="row"]')) : []);
/** Le texte de chaque ligne, ses cellules séparées par « · ». */
const lignes = () => lignesDHabitants().map((tr) => [...tr.cells].map((c) => c.textContent).filter(Boolean).join(" · "));
/** Les prénoms du tableau, dans son ordre. */
const prenoms = () => lignesDHabitants().map((tr) => tr.cells[0].textContent);
/** La ligne d'un Habitant, trouvée par son prénom. */
const ligne = (prenom: string) => lignesDHabitants().find((tr) => tr.cells[0].textContent === prenom)!;
/** Les Métiers dépliés sous la ligne d'un Habitant, sur la ligne qui la suit ; null, dépliant fermé. */
const depliant = (prenom: string) => {
  const suivante = ligne(prenom).nextElementSibling as HTMLElement | null;
  return suivante?.querySelector('[role="group"]') ? suivante : null;
};
const choisir = (prenom: string) => within(ligne(prenom)).getByRole("button", { name: "Choisir un Métier" });
/** US-0310 : le bouton qui déplie les Métiers sur la ligne d'un Habitant : « Choisir un Métier », ou son Métier. */
const deplier = (prenom: string) => within(ligne(prenom)).getAllByRole("button").find((b) => b.hasAttribute("aria-expanded"))!;
/** Les Métiers dépliés sous une ligne. */
function auChoix(prenom: string) {
  const groupe = depliant(prenom)?.querySelector('[role="group"]');
  return groupe ? within(groupe as HTMLElement).getAllByRole("button") : [];
}
/** Un bouton du dépliant d'un Habitant, par son nom. */
const dansLeDepliant = (prenom: string, n: string) => within(depliant(prenom)!).getByRole("button", { name: n });
/** Donne le Métier `n` à l'Habitant `prenom`, depuis sa ligne. */
async function donner(prenom: string, n: string) {
  const utilisateur = userEvent.setup();
  await utilisateur.click(choisir(prenom));
  await utilisateur.click(dansLeDepliant(prenom, n));
}

describe("le registre des Habitants (US-0303)", () => {
  it("titre le registre « Habitants », et dit à côté ce que montre le filtre et combien", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const titre = screen.getByRole("heading", { level: 1 });
    expect(titre.textContent).toBe("Habitants");
    expect(screen.getByRole("region", { name: "Habitants" }).contains(tableau())).toBe(true);
    expect(titre.nextElementSibling?.textContent).toBe("Tous · 3");
    await userEvent.setup().click(compteur("Chasseur"));
    expect(titre.nextElementSibling?.textContent).toBe("Chasseur · 1");
  });

  it("range les Habitants en un tableau : une colonne pour le prénom, le Métier, l'état et la date d'arrivée", () => {
    render(<ListeDesHabitants habitants={HABITANTS.map((h, i) => ({ ...h, arriveLe: `${i + 2} octobre 2026` }))} metiers={METIERS} />);
    expect(within(tableau()).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Prénom", "Métier", "État", "Arrivé le"]);
    expect(lignes()).toEqual(["Arno · Choisir un Métier · libre · 2 octobre 2026", "Brune · Choisir un Métier · libre · 3 octobre 2026", "Cael · Chasseur · libre · 4 octobre 2026"]);
  });

  it("groupe les lignes par Métier, ceux sans Métier d'abord, chaque groupe sous un en-tête à son nom", () => {
    const peuple: HabitantAffiche[] = [
      { id: 40, prenom: "Arno", metier: null, etat: "libre" },
      { id: 41, prenom: "Brune", metier: "Mineur", etat: "libre" },
      { id: 42, prenom: "Cael", metier: "Chasseur", etat: "libre" },
      { id: 43, prenom: "Dara", metier: "Chasseur", etat: "libre" },
    ];
    render(<ListeDesHabitants habitants={peuple} metiers={METIERS} />);
    const groupes = [...tableau().querySelectorAll("tbody")].map((tbody) => [
      tbody.querySelector('th[scope="rowgroup"]')!.querySelector("span:not([aria-hidden]) > span")?.textContent,
      ...[...tbody.querySelectorAll('th[scope="row"]')].map((th) => th.textContent),
    ]);
    // Un groupe par Métier, même sans personne : c'est là qu'on lui en donne (US-0312).
    expect(groupes).toEqual([["Sans Métier", "Arno"], ["Explorateur"], ["Chasseur", "Cael", "Dara"], ["Cueilleur"], ["Bûcheron"], ["Mineur", "Brune"], ["Chercheur"], ["Bâtisseur"], ["Éleveur"]]);
  });

  it("dit en tête de chaque groupe la phrase du Métier et, tant qu'il ne sert à rien, ce qu'il attend (US-0307)", () => {
    const parleurs: MetierDuTableau[] = [
      { ...METIERS[1], phrase: "rapporte de la Viande", servira: "avec les Récoltes" },
      { ...METIERS[0], phrase: "part en Expédition chercher des Bêtes sauvages", servira: null },
    ];
    render(<ListeDesHabitants habitants={HABITANTS} metiers={parleurs} />);
    const tetes = [...tableau().querySelectorAll('th[scope="rowgroup"]')].map(nom);
    expect(tetes).toEqual(["Sans Métier 2", "Chasseur rapporte de la Viande Servira avec les Récoltes. − 1 +", "Explorateur part en Expédition chercher des Bêtes sauvages − 0 +"]);
  });

  it("ne met de groupe « Sans Métier » que s'il y en a", () => {
    render(<ListeDesHabitants habitants={[HABITANTS[2]]} metiers={METIERS} />);
    expect([...tableau().querySelectorAll('th[scope="rowgroup"]')].map(nom)).not.toContain("Sans Métier 0");
  });
});

describe("donner un Métier depuis la ligne d'un Habitant (US-0308)", () => {
  it("met « Choisir un Métier » sur la ligne d'un Habitant sans Métier, à la place de « sans Métier », et son Métier sur celle d'un Habitant qui en a un", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(lignes()).toEqual(["Arno · Choisir un Métier · libre", "Brune · Choisir un Métier · libre", "Cael · Chasseur · libre"]);
    expect(choisir("Arno").getAttribute("aria-expanded")).toBe("false");
    expect(auChoix("Arno")).toEqual([]);
  });

  it("déplie sous la ligne les huit Métiers, chacun un bouton à son médaillon muet et à son nom", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await userEvent.setup().click(choisir("Arno"));
    expect(choisir("Arno").getAttribute("aria-expanded")).toBe("true");
    const boutons = auChoix("Arno");
    expect(boutons.map((b) => b.textContent)).toEqual(METIERS.map((m) => m.nom));
    // Le groupe des Métiers suit la ligne de l'Habitant, sur toute la largeur du tableau, et le bouton dit lequel il ouvre.
    const groupe = within(depliant("Arno")!).getByRole("group", { name: "Métier de Arno" });
    expect(groupe.id).toBe(choisir("Arno").getAttribute("aria-controls"));
    expect(groupe.closest("td")?.colSpan).toBe(4);
    for (const [i, bouton] of boutons.entries()) {
      const icone = bouton.querySelector("img")!;
      expect(icone.getAttribute("alt")).toBe("");
      expect(icone.closest("[aria-hidden]")).not.toBeNull();
      expect(icone.getAttribute("src")).toContain(encodeURIComponent(`/illustrations/metiers/${METIERS[i].id}.webp`));
      expect(icone.getAttribute("width")).toBe(String(TAILLES_DE_MEDAILLON.md));
    }
    expect(actions.donnerUnMetier).not.toHaveBeenCalled();
  });

  it("toucher un Métier le donne : la ligne le montre aussitôt dans le groupe de son Métier, le dépliant se referme, la main suit le bouton, l'action reçoit l'Habitant et le Métier", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await donner("Arno", "Bûcheron");
    expect(actions.donnerUnMetier).toHaveBeenCalledExactlyOnceWith(40, "bucheron");
    // L'action n'a pas encore répondu : la ligne montre déjà le nouveau Métier, parmi les Bûcherons.
    expect(lignes()).toEqual(["Brune · Choisir un Métier · libre", "Cael · Chasseur · libre", "Arno · Bûcheron · libre"]);
    expect(auChoix("Arno")).toEqual([]);
    expect(document.activeElement).toBe(deplier("Arno"));
  });

  it("garde le Métier une fois la page relue, qui le montre à son tour, à sa place", async () => {
    const { rerender } = render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await donner("Arno", "Bûcheron");
    rerender(<ListeDesHabitants habitants={[HABITANTS[1], HABITANTS[2], { ...HABITANTS[0], metier: "Bûcheron" }]} metiers={METIERS} />);
    await finirLesActions();
    expect(lignes()).toEqual(["Brune · Choisir un Métier · libre", "Cael · Chasseur · libre", "Arno · Bûcheron · libre"]);
  });

  it("laisse la page relue faire foi quand le Métier n'a pas été donné", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await donner("Arno", "Mineur");
    expect(lignes()).toEqual(["Brune · Choisir un Métier · libre", "Cael · Chasseur · libre", "Arno · Mineur · libre"]);
    // L'action s'achève sans que la page ait changé : l'Habitant reste sans Métier.
    await finirLesActions();
    expect(lignes()[0]).toBe("Arno · Choisir un Métier · libre");
  });

  it("referme d'un second toucher sur « Choisir un Métier », sans rien changer", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(choisir("Arno"));
    await utilisateur.click(choisir("Arno"));
    expect(choisir("Arno").getAttribute("aria-expanded")).toBe("false");
    expect(auChoix("Arno")).toEqual([]);
    expect(actions.donnerUnMetier).not.toHaveBeenCalled();
  });

  it("referme avec Échap, sans rien changer, et rend la main au bouton", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(choisir("Arno"));
    dansLeDepliant("Arno", "Chasseur").focus();
    await utilisateur.keyboard("{Escape}");
    expect(auChoix("Arno")).toEqual([]);
    expect(choisir("Arno").getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(choisir("Arno"));
    expect(actions.donnerUnMetier).not.toHaveBeenCalled();
  });

  it("n'ouvre qu'un dépliant à la fois", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(choisir("Arno"));
    await utilisateur.click(choisir("Brune"));
    expect(auChoix("Arno")).toEqual([]);
    expect(choisir("Arno").getAttribute("aria-expanded")).toBe("false");
    expect(auChoix("Brune")).toHaveLength(8);
  });

  it("garde « sans Métier » quand il n'y a aucun Métier à proposer, et chacun sa ligne", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={[]} />);
    expect(lignes()).toEqual(["Arno · sans Métier · libre", "Brune · sans Métier · libre", "Cael · Chasseur · libre"]);
    expect(within(tableau()).queryByRole("button")).toBeNull();
  });
});

describe("changer le Métier d'un Habitant depuis sa ligne (US-0310)", () => {
  it("fait du Métier d'un Habitant qui en a un un bouton, à son médaillon, son nom et la flèche, comme « Choisir un Métier »", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const bouton = deplier("Cael");
    expect(bouton.textContent).toBe("Chasseur");
    expect(bouton.className).toBe(choisir("Arno").className);
    expect(bouton.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/illustrations/metiers/chasseur.webp"));
    expect(bouton.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(bouton.getAttribute("aria-expanded")).toBe("false");
    // « Choisir un Métier » se distingue, au cuivre, sans changer de forme.
    expect(choisir("Arno").hasAttribute("data-a-choisir")).toBe(true);
    expect(bouton.hasAttribute("data-a-choisir")).toBe(false);
    expect(auChoix("Cael")).toEqual([]);
  });

  it("déplie sous la ligne les huit Métiers, l'actuel pressé et qu'on ne peut pas toucher, les autres au choix", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    expect(deplier("Cael").getAttribute("aria-expanded")).toBe("true");
    expect(within(depliant("Cael")!).getByRole("group", { name: "Métier de Cael" }).id).toBe(deplier("Cael").getAttribute("aria-controls"));
    const boutons = auChoix("Cael").slice(0, METIERS.length);
    expect(boutons.map((b) => b.textContent)).toEqual(METIERS.map((m) => m.nom));
    expect(boutons.map((b) => b.getAttribute("aria-pressed"))).toEqual(METIERS.map((m) => String(m.nom === "Chasseur")));
    expect(boutons.map((b) => (b as HTMLButtonElement).disabled)).toEqual(METIERS.map((m) => m.nom === "Chasseur"));
    // Le Métier qu'il exerce est coché, pour ne pas le lire à la seule couleur.
    expect(boutons.map((b) => b.querySelector("svg") !== null)).toEqual(METIERS.map((m) => m.nom === "Chasseur"));
    // Sur la ligne d'un Habitant sans Métier, aucun n'est pressé.
    await utilisateur.click(choisir("Arno"));
    expect(auChoix("Arno").map((b) => b.getAttribute("aria-pressed"))).toEqual(METIERS.map(() => "false"));
  });

  it("toucher un autre Métier le donne aussitôt : la ligne le montre, le dépliant se referme, l'action reçoit l'Habitant et le nouveau Métier", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(dansLeDepliant("Cael", "Mineur"));
    expect(actions.donnerUnMetier).toHaveBeenCalledExactlyOnceWith(42, "mineur");
    // L'action n'a pas encore répondu : la ligne montre déjà le nouveau Métier, et son bouton reprend la main.
    expect(lignes()).toEqual(["Arno · Choisir un Métier · libre", "Brune · Choisir un Métier · libre", "Cael · Mineur · libre"]);
    expect(auChoix("Cael")).toEqual([]);
    expect(document.activeElement).toBe(deplier("Cael"));
  });

  it("fait bouger les compteurs aussitôt : l'ancien Métier baisse de un, le nouveau monte de un", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 2", "Chasseur 1", "Mineur 0"]));
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(dansLeDepliant("Cael", "Mineur"));
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 2", "Chasseur 0", "Mineur 1"]));
  });

  it("garde le nouveau Métier une fois la page relue, et rend l'ancien quand la page relue le garde", async () => {
    const { rerender } = render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(dansLeDepliant("Cael", "Mineur"));
    rerender(<ListeDesHabitants habitants={[HABITANTS[0], HABITANTS[1], { ...HABITANTS[2], metier: "Mineur" }]} metiers={METIERS} />);
    await finirLesActions();
    expect(lignes()[2]).toBe("Cael · Mineur · libre");
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(dansLeDepliant("Cael", "Bûcheron"));
    expect(lignes()[2]).toBe("Cael · Bûcheron · libre");
    // L'action s'achève sans que la page ait changé : Cael reste Mineur.
    await finirLesActions();
    expect(lignes()[2]).toBe("Cael · Mineur · libre");
  });
});

describe("retirer son Métier à un Habitant depuis sa ligne (US-0311)", () => {
  /** Deux Habitants sans Métier, deux Chasseurs, dans l'ordre de la lecture. */
  const QUATRE: HabitantAffiche[] = [
    { id: 50, prenom: "Arno", metier: null, etat: "libre" },
    { id: 51, prenom: "Dara", metier: null, etat: "libre" },
    { id: 52, prenom: "Brune", metier: "Chasseur", etat: "libre" },
    { id: 53, prenom: "Cael", metier: "Chasseur", etat: "libre" },
  ];
  /** Remet sans Métier l'Habitant `prenom`, depuis sa ligne. */
  async function retirer(prenom: string) {
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier(prenom));
    await utilisateur.click(dansLeDepliant(prenom, "Sans Métier"));
  }

  it("propose « Sans Métier » en dernier dans le groupe des Métiers d'un Habitant qui a un Métier, sans icône et d'une autre allure, jamais à un Habitant sans Métier", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    const boutons = auChoix("Cael");
    expect(boutons.map((b) => b.textContent)).toEqual([...METIERS.map((m) => m.nom), "Sans Métier"]);
    const sansMetier = boutons.at(-1)!;
    expect(sansMetier.querySelector("img")).toBeNull();
    expect(sansMetier.className).not.toBe(boutons[0].className);
    expect((sansMetier as HTMLButtonElement).disabled).toBe(false);
    await utilisateur.click(choisir("Arno"));
    expect(auChoix("Arno").map((b) => b.textContent)).toEqual(METIERS.map((m) => m.nom));
  });

  it("toucher « Sans Métier » le retire aussitôt : la ligne propose de nouveau un Métier et remonte parmi les sans Métier, l'action reçoit l'Habitant", async () => {
    render(<ListeDesHabitants habitants={QUATRE} metiers={METIERS} />);
    await retirer("Brune");
    expect(actions.retirerLeMetier).toHaveBeenCalledExactlyOnceWith(52);
    expect(actions.donnerUnMetier).not.toHaveBeenCalled();
    // L'action n'a pas encore répondu : Brune a déjà rejoint les sans Métier, à sa place dans l'ordre des prénoms.
    expect(lignes()).toEqual(["Arno · Choisir un Métier · libre", "Brune · Choisir un Métier · libre", "Dara · Choisir un Métier · libre", "Cael · Chasseur · libre"]);
    expect(auChoix("Brune")).toEqual([]);
    expect(document.activeElement).toBe(choisir("Brune"));
  });

  it("le fait remonter en tête de la liste quand personne d'autre n'est sans Métier", async () => {
    render(<ListeDesHabitants habitants={QUATRE.slice(2).map((h, i) => ({ ...h, metier: i ? "Mineur" : "Chasseur" }))} metiers={METIERS} />);
    await retirer("Cael");
    expect(lignes()).toEqual(["Cael · Choisir un Métier · libre", "Brune · Chasseur · libre"]);
  });

  it("fait bouger les compteurs aussitôt : « Sans Métier » monte de un, l'ancien Métier baisse de un", async () => {
    render(<ListeDesHabitants habitants={QUATRE} metiers={METIERS} />);
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 2", "Chasseur 2"]));
    await retirer("Cael");
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 3", "Chasseur 1"]));
  });

  it("garde l'Habitant sans Métier une fois la page relue, et lui rend son Métier quand la page relue le garde", async () => {
    const { rerender } = render(<ListeDesHabitants habitants={QUATRE} metiers={METIERS} />);
    await retirer("Cael");
    rerender(<ListeDesHabitants habitants={[QUATRE[0], { ...QUATRE[3], metier: null }, QUATRE[1], QUATRE[2]]} metiers={METIERS} />);
    await finirLesActions();
    expect(lignes().map((l) => l.split(" · ").slice(0, 2).join(" · "))).toEqual(["Arno · Choisir un Métier", "Cael · Choisir un Métier", "Dara · Choisir un Métier", "Brune · Chasseur"]);
    await retirer("Brune");
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 4", "Chasseur 0"]));
    // L'action s'achève sans que la page ait changé : Brune reste Chasseur, à sa place.
    await finirLesActions();
    expect(lignes()[3]).toBe("Brune · Chasseur · libre");
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 3", "Chasseur 1"]));
  });
});

describe("compter les effectifs par Métier, dans le rail (US-0309)", () => {
  /** Un Habitant par Métier de `metiers` (null : sans Métier). */
  const peuple = (metiers: (string | null)[]): HabitantAffiche[] =>
    metiers.map((metier, i) => ({ id: 60 + i, prenom: `Prenom${i}`, metier, etat: "libre" }));
  /** La somme des compteurs. */
  const somme = () => effectifs().reduce((total, effectif) => total + Number(effectif.match(/\d+$/)?.[0]), 0);

  it("montre un compteur « Sans Métier », puis un par Métier dans leur ordre, chacun avec son nombre", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(effectifs()).toEqual([
      "Sans Métier 2",
      "Explorateur 0",
      "Chasseur 1",
      "Cueilleur 0",
      "Bûcheron 0",
      "Mineur 0",
      "Chercheur 0",
      "Bâtisseur 0",
      "Éleveur 0",
    ]);
  });

  it("met devant chaque compteur son médaillon, muet (le nom est à côté) : un Habitant pour « Tous », un rond vide pour « Sans Métier »", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    // « Tous » (US-0314) passe en tête.
    const [tous, sansMetier, ...parMetier] = within(rangeeDesEffectifs()).getAllByRole("listitem");
    expect(tous.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/illustrations/icones/habitants.webp"));
    expect(sansMetier.querySelector("img")).toBeNull();
    for (const [i, unCompteur] of parMetier.entries()) {
      const icone = unCompteur.querySelector("img")!;
      expect(icone.getAttribute("alt")).toBe("");
      expect(icone.closest("[aria-hidden]")).not.toBeNull();
      expect(icone.getAttribute("src")).toContain(encodeURIComponent(METIERS[i].icone));
    }
  });

  it("signale d'un point de braise qu'il reste des Habitants sans Métier, pour les yeux seulement", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    // Le point suit le nom ; le médaillon vide, lui, ouvre le bouton.
    expect(compteur("Sans Métier").querySelector(":scope > * [aria-hidden]:empty")).not.toBeNull();
    cleanup();
    render(<ListeDesHabitants habitants={[HABITANTS[2]]} metiers={METIERS} />);
    expect(nom(compteur("Sans Métier"))).toBe("Sans Métier 0");
    expect(compteur("Sans Métier").querySelector(":scope > * [aria-hidden]:empty")).toBeNull();
    expect(compteur("Sans Métier").hasAttribute("data-personne")).toBe(true);
  });

  it("garde à 0 un Métier que personne n'exerce, au lieu de le faire disparaître", () => {
    render(<ListeDesHabitants habitants={peuple([null, null, null])} metiers={METIERS} />);
    expect(effectifs()).toEqual(["Sans Métier 3", ...METIERS.map((m) => `${m.nom} 0`)]);
  });

  it("donne une somme toujours égale au nombre d'Habitants", () => {
    for (const metiers of [
      [null, null, null],
      ["Chasseur", "Chasseur", "Bûcheron"],
      [null, "Éleveur", "Mineur", "Mineur", null, "Explorateur", "Chercheur", "Cueilleur", "Bâtisseur", "Chasseur", "Bûcheron", null],
      ["Mineur"],
    ]) {
      render(<ListeDesHabitants habitants={peuple(metiers)} metiers={METIERS} />);
      expect(somme(), metiers.join(",")).toBe(metiers.length);
      // « Tous » les montre tous, sans compter pour un lecteur d'écran ce que la place dit déjà.
      expect(compteur("Tous").textContent).toContain(String(metiers.length));
      cleanup();
    }
  });

  it("dit sous « Tous » et sous un Métier combien sont en Expédition, pour les yeux : leur ligne le dit déjà", () => {
    render(<ListeDesHabitants habitants={[...HABITANTS, { id: 43, prenom: "Dara", metier: "Explorateur", etat: "en Expédition" }]} metiers={METIERS} />);
    expect(within(compteur("Tous")).getByText("1 en Expédition").closest("[aria-hidden]")).not.toBeNull();
    expect(within(compteur("Explorateur")).getByText("1 en Expédition").closest("[aria-hidden]")).not.toBeNull();
    expect(within(compteur("Chasseur")).queryByText(/en Expédition/)).toBeNull();
    expect(nom(compteur("Explorateur"))).toBe("Explorateur 1");
  });

  it("change dès qu'un Métier est donné, sans attendre l'action : un de moins sans Métier, un de plus au Métier donné", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await donner("Arno", "Bûcheron");
    // L'action n'a pas encore répondu.
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 1", "Bûcheron 1", "Chasseur 1"]));
    expect(somme()).toBe(3);
  });

  it("suit la page relue : le Métier donné reste compté, un Métier refusé ne l'est plus", async () => {
    const { rerender } = render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await donner("Arno", "Bûcheron");
    rerender(<ListeDesHabitants habitants={[HABITANTS[1], HABITANTS[2], { ...HABITANTS[0], metier: "Bûcheron" }]} metiers={METIERS} />);
    await finirLesActions();
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 1", "Bûcheron 1"]));
    await donner("Brune", "Mineur");
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 0", "Mineur 1"]));
    // L'action s'achève sans que la page ait changé : Brune reste sans Métier.
    await finirLesActions();
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 1", "Mineur 0"]));
  });
});

describe("filtrer le tableau par Métier, depuis le rail (US-0314)", () => {
  it("met « Tous » en premier dans la rangée, pressé tant qu'il n'y a pas de filtre, puis chaque compteur en bouton", () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const boutons = within(rangeeDesEffectifs()).getAllByRole("button");
    expect(boutons.map(nom)).toEqual(["Tous", "Sans Métier 2", ...METIERS.map((m) => `${m.nom} ${m.nom === "Chasseur" ? 1 : 0}`)]);
    expect(boutons.every((b) => b.getAttribute("type") === "button" && b.hasAttribute("aria-pressed"))).toBe(true);
    expect(presses()).toEqual(["Tous"]);
    expect(prenoms()).toEqual(["Arno", "Brune", "Cael"]);
  });

  it("toucher un compteur de Métier filtre le tableau sur ce Métier, sans recharger, et l'adresse le garde", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await userEvent.setup().click(compteur("Chasseur"));
    expect(lignes()).toEqual(["Cael · Chasseur · libre"]);
    expect(presses()).toEqual(["Chasseur 1"]);
    expect(window.location.pathname).toBe("/jeu/habitants");
    expect(window.location.search).toBe("?metier=chasseur");
    // Le filtre ne garde que le groupe de son Métier, son en-tête compris.
    expect([...tableau().querySelectorAll('th[scope="rowgroup"]')].map(nom)).toEqual(["Chasseur − 1 +"]);
  });

  it("toucher « Sans Métier » filtre sur les Habitants sans Métier", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await userEvent.setup().click(compteur("Sans Métier"));
    expect(prenoms()).toEqual(["Arno", "Brune"]);
    expect(presses()).toEqual(["Sans Métier 2"]);
    expect(window.location.search).toBe("?metier=sans");
  });

  it("« Tous » retire le filtre, du tableau comme de l'adresse ; toucher de nouveau le compteur pressé aussi", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(compteur("Chasseur"));
    await utilisateur.click(compteur("Tous"));
    expect(prenoms()).toEqual(["Arno", "Brune", "Cael"]);
    expect(presses()).toEqual(["Tous"]);
    expect(window.location.search).toBe("");
    await utilisateur.click(compteur("Sans Métier"));
    await utilisateur.click(compteur("Sans Métier"));
    expect(prenoms()).toEqual(["Arno", "Brune", "Cael"]);
    expect(presses()).toEqual(["Tous"]);
    expect(window.location.search).toBe("");
  });

  it("ne change ni les compteurs ni les Métiers au choix", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const avant = effectifs();
    const utilisateur = userEvent.setup();
    await utilisateur.click(compteur("Chasseur"));
    expect(effectifs()).toEqual(avant);
    await utilisateur.click(compteur("Sans Métier"));
    expect(effectifs()).toEqual(avant);
    await utilisateur.click(choisir("Arno"));
    expect(auChoix("Arno").map((b) => b.textContent)).toEqual(METIERS.map((m) => m.nom));
  });

  it("affiche « Personne n'exerce ce Métier. » à la place des lignes quand le filtre ne trouve personne", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await userEvent.setup().click(compteur("Mineur"));
    expect(lignes()).toEqual([]);
    expect(within(tableau()).getByText("Personne n'exerce ce Métier.").tagName).toBe("P");
    expect(presses()).toEqual(["Mineur 0"]);
  });

  it("affiche « Personne n'est sans Métier. » quand tous les Habitants en ont un", async () => {
    render(<ListeDesHabitants habitants={[HABITANTS[2]]} metiers={METIERS} />);
    await userEvent.setup().click(compteur("Sans Métier"));
    expect(lignes()).toEqual([]);
    expect(within(tableau()).getByText("Personne n'est sans Métier.").tagName).toBe("P");
  });

  it("garde le filtre quand on donne un Métier : l'Habitant quitte aussitôt le tableau « Sans Métier », et le rejoint s'il n'a pas été donné", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await userEvent.setup().click(compteur("Sans Métier"));
    await donner("Arno", "Bûcheron");
    expect(prenoms()).toEqual(["Brune"]);
    expect(presses()).toEqual(["Sans Métier 1"]);
    await finirLesActions();
    expect(prenoms()).toEqual(["Arno", "Brune"]);
  });

  it("reprend le filtre de l'adresse en arrivant sur la page : un rechargement, ou un lien", () => {
    ouvrir("?metier=chasseur");
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(prenoms()).toEqual(["Cael"]);
    expect(presses()).toEqual(["Chasseur 1"]);
    cleanup();
    ouvrir("?metier=sans");
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(prenoms()).toEqual(["Arno", "Brune"]);
    expect(presses()).toEqual(["Sans Métier 2"]);
  });

  it("ne filtre rien pour un identifiant inconnu dans l'adresse", () => {
    for (const inconnu of ["?metier=druide", "?metier=", "?metier=Chasseur", "?metier=sans%20metier"]) {
      ouvrir(inconnu);
      render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
      expect(prenoms(), inconnu).toEqual(["Arno", "Brune", "Cael"]);
      expect(presses(), inconnu).toEqual(["Tous"]);
      cleanup();
    }
  });
});

describe("un Territoire sans Habitant (US-0329)", () => {
  const AUCUN = "Aucun Habitant pour l'instant. Des Voyageurs finiront par passer aux portes.";

  it("dit, sous le titre, à la place du rail et du tableau, qu'il n'y a aucun Habitant et que des Voyageurs finiront par passer", () => {
    const { container } = render(<ListeDesHabitants habitants={[]} metiers={METIERS} />);
    expect(container.textContent).toBe(`Habitants${AUCUN}`);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Habitants");
    expect(screen.getByText(AUCUN).tagName).toBe("P");
    expect(screen.queryAllByRole("list")).toEqual([]);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("le dit aussi quand l'adresse porte un filtre, sans « Personne n'est sans Métier. »", () => {
    for (const filtre of ["?metier=sans", "?metier=chasseur"]) {
      ouvrir(filtre);
      const { container } = render(<ListeDesHabitants habitants={[]} metiers={METIERS} />);
      expect(container.textContent, filtre).toBe(`Habitants${AUCUN}`);
      cleanup();
    }
  });
});

describe("renvoyer un Habitant depuis sa ligne (US-0330)", () => {
  /** Le bouton de renvoi sous la ligne d'un Habitant, qu'il dise « Renvoyer » ou « Confirmer le renvoi » ; null, dépliant fermé. */
  const renvoi = (prenom: string) => {
    const dessous = depliant(prenom);
    return dessous ? within(dessous).queryByRole("button", { name: new RegExp(`^(Renvoyer ${prenom}|Confirmer le renvoi (de |d')${prenom})$`) }) : null;
  };
  /** Ce que dit le bouton de renvoi d'un Habitant, et s'il est dans la couleur d'alerte. */
  const etatDuRenvoi = (prenom: string) => [renvoi(prenom)?.textContent, renvoi(prenom)?.hasAttribute("data-confirmer")];
  /** Déplie les Métiers de l'Habitant, touche « Renvoyer », puis confirme. */
  async function renvoyer(prenom: string) {
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier(prenom));
    await utilisateur.click(renvoi(prenom)!);
    await utilisateur.click(renvoi(prenom)!);
  }

  it("met « Renvoyer » dans le dépliant, à part des Métiers et en dernier, qui dit pour un lecteur d'écran qui il renvoie ; nulle part ailleurs", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(screen.queryByRole("button", { name: /Renvoyer/ })).toBeNull();
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    const bouton = renvoi("Cael")!;
    expect(bouton.getAttribute("aria-label")).toBe("Renvoyer Cael");
    expect(etatDuRenvoi("Cael")).toEqual(["Renvoyer", false]);
    // À part des Métiers au choix : hors de leur groupe, juste après lui, le dernier du dépliant.
    const groupe = within(depliant("Cael")!).getByRole("group", { name: "Métier de Cael" });
    expect(groupe.contains(bouton)).toBe(false);
    expect(groupe.nextElementSibling).toBe(bouton);
    expect(bouton.nextElementSibling).toBeNull();
    expect(auChoix("Cael").map((b) => b.textContent)).toEqual([...METIERS.map((m) => m.nom), "Sans Métier"]);
    // Un Habitant sans Métier se renvoie de même ; un seul dépliant, donc un seul « Renvoyer », à la fois.
    await utilisateur.click(choisir("Arno"));
    expect(renvoi("Arno")?.getAttribute("aria-label")).toBe("Renvoyer Arno");
    expect(renvoi("Cael")).toBeNull();
  });

  it("le premier toucher ne renvoie personne : le bouton devient « Confirmer le renvoi », dans la couleur d'alerte, et garde la main", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Brune"));
    await utilisateur.click(renvoi("Brune")!);
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
    expect(prenoms()).toEqual(["Arno", "Brune", "Cael"]);
    expect(etatDuRenvoi("Brune")).toEqual(["Confirmer le renvoi", true]);
    // Le bouton dit toujours, pour un lecteur d'écran, qui il renvoie, et « de » s'accorde au prénom.
    expect(renvoi("Brune")!.getAttribute("aria-label")).toBe("Confirmer le renvoi de Brune");
    expect(document.activeElement).toBe(renvoi("Brune"));
    await utilisateur.click(deplier("Arno"));
    await utilisateur.click(renvoi("Arno")!);
    expect(renvoi("Arno")!.getAttribute("aria-label")).toBe("Confirmer le renvoi d'Arno");
  });

  it("le second toucher renvoie l'Habitant : sa ligne part aussitôt avec son dépliant, les compteurs suivent, et l'action reçoit l'Habitant", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 2", "Chasseur 1"]));
    await renvoyer("Cael");
    expect(actions.renvoyerUnHabitant).toHaveBeenCalledExactlyOnceWith(42);
    expect(actions.donnerUnMetier).not.toHaveBeenCalled();
    expect(actions.retirerLeMetier).not.toHaveBeenCalled();
    // L'action n'a pas encore répondu : la ligne est déjà partie.
    expect(prenoms()).toEqual(["Arno", "Brune"]);
    expect(effectifs()).toEqual(expect.arrayContaining(["Sans Métier 2", "Chasseur 0"]));
    expect(screen.queryByRole("group")).toBeNull();
    // La main passe à la ligne d'avant, la dernière qui reste.
    expect(document.activeElement).toBe(choisir("Brune"));
  });

  it("donne la main à la ligne qui prend la place de l'Habitant renvoyé", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await renvoyer("Arno");
    expect(prenoms()).toEqual(["Brune", "Cael"]);
    expect(document.activeElement).toBe(choisir("Brune"));
  });

  it("ne renvoie personne d'un double clic sur « Renvoyer » : la confirmation reste demandée", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.dblClick(renvoi("Cael")!);
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
    expect(etatDuRenvoi("Cael")).toEqual(["Confirmer le renvoi", true]);
    await utilisateur.click(renvoi("Cael")!);
    expect(actions.renvoyerUnHabitant).toHaveBeenCalledExactlyOnceWith(42);
  });

  it("un toucher ailleurs annule la confirmation ; le toucher suivant sur « Renvoyer » la redemande", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(renvoi("Cael")!);
    await utilisateur.click(document.body);
    expect(etatDuRenvoi("Cael")).toEqual(["Renvoyer", false]);
    await utilisateur.click(renvoi("Cael")!);
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
    expect(etatDuRenvoi("Cael")).toEqual(["Confirmer le renvoi", true]);
  });

  it("au clavier, passer à un autre bouton annule la confirmation, et Échap la referme avec le dépliant", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    renvoi("Cael")!.focus();
    await utilisateur.keyboard("{Enter}");
    expect(etatDuRenvoi("Cael")).toEqual(["Confirmer le renvoi", true]);
    await utilisateur.tab({ shift: true });
    expect(etatDuRenvoi("Cael")).toEqual(["Renvoyer", false]);
    renvoi("Cael")!.focus();
    await utilisateur.keyboard("{Enter}");
    await utilisateur.keyboard("{Escape}");
    expect(renvoi("Cael")).toBeNull();
    expect(document.activeElement).toBe(deplier("Cael"));
    await utilisateur.click(deplier("Cael"));
    expect(etatDuRenvoi("Cael")).toEqual(["Renvoyer", false]);
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
  });

  it("au clavier, Entrée puis Entrée renvoie l'Habitant", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Brune"));
    renvoi("Brune")!.focus();
    await utilisateur.keyboard("{Enter}");
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
    await utilisateur.keyboard("{Enter}");
    expect(actions.renvoyerUnHabitant).toHaveBeenCalledExactlyOnceWith(41);
    expect(prenoms()).toEqual(["Arno", "Cael"]);
    expect(document.activeElement).toBe(deplier("Cael"));
  });

  it("donner un Métier ou refermer le dépliant annule la confirmation", async () => {
    render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    const utilisateur = userEvent.setup();
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(renvoi("Cael")!);
    await utilisateur.click(deplier("Cael"));
    await utilisateur.click(deplier("Cael"));
    expect(etatDuRenvoi("Cael")).toEqual(["Renvoyer", false]);
    await utilisateur.click(renvoi("Cael")!);
    await utilisateur.click(dansLeDepliant("Cael", "Mineur"));
    expect(actions.donnerUnMetier).toHaveBeenCalledExactlyOnceWith(42, "mineur");
    expect(actions.renvoyerUnHabitant).not.toHaveBeenCalled();
    expect(prenoms()).toEqual(["Arno", "Brune", "Cael"]);
  });

  it("ne remontre pas l'Habitant une fois la page relue sans lui, et le rend quand la page relue le garde", async () => {
    const { rerender } = render(<ListeDesHabitants habitants={HABITANTS} metiers={METIERS} />);
    await renvoyer("Cael");
    rerender(<ListeDesHabitants habitants={HABITANTS.slice(0, 2)} metiers={METIERS} />);
    await finirLesActions();
    expect(prenoms()).toEqual(["Arno", "Brune"]);
    await renvoyer("Brune");
    expect(prenoms()).toEqual(["Arno"]);
    // L'action s'achève sans que la page ait changé : Brune est toujours là.
    await finirLesActions();
    expect(prenoms()).toEqual(["Arno", "Brune"]);
  });

  it("renvoyer le dernier Habitant laisse aussitôt la phrase d'un Territoire sans Habitant (US-0329)", async () => {
    const { container } = render(<ListeDesHabitants habitants={[HABITANTS[2]]} metiers={METIERS} />);
    await renvoyer("Cael");
    expect(actions.renvoyerUnHabitant).toHaveBeenCalledExactlyOnceWith(42);
    expect(container.textContent).toBe("HabitantsAucun Habitant pour l'instant. Des Voyageurs finiront par passer aux portes.");
  });
});

describe("un explorateur parti en Expédition (US-0911)", () => {
  /** Arno, sans Métier, et Dara, partie en Expédition. */
  const AVEC_UNE_PARTIE: HabitantAffiche[] = [HABITANTS[0], { id: 43, prenom: "Dara", metier: "Explorateur", etat: "en Expédition" }];

  it("est « en Expédition » sur sa ligne, son Métier écrit sans bouton : ni changé, ni retiré, ni renvoyé avant son retour", () => {
    render(<ListeDesHabitants habitants={AVEC_UNE_PARTIE} metiers={METIERS} />);
    expect(lignes()).toEqual(["Arno · Choisir un Métier · libre", "Dara · Explorateur · en Expédition"]);
    expect(within(ligne("Dara")).queryAllByRole("button")).toEqual([]);
    // Son état se distingue de « libre » par sa teinte, celle de la phase de son Expédition, et toujours par son mot.
    expect(ligne("Dara").querySelector("[data-absent]")?.textContent).toBe("en Expédition");
    expect(ligne("Arno").querySelector("[data-absent]")).toBeNull();
  });

  it("ne prend pas la main après un renvoi : elle passe à la ligne suivante qui a son bouton (US-0330)", async () => {
    const utilisateur = userEvent.setup();
    const kael: HabitantAffiche = { id: 44, prenom: "Kael", metier: "Explorateur", etat: "libre" };
    render(<ListeDesHabitants habitants={[...AVEC_UNE_PARTIE, kael]} metiers={METIERS} />);
    expect(prenoms()).toEqual(["Arno", "Dara", "Kael"]);
    await utilisateur.click(choisir("Arno"));
    await utilisateur.click(dansLeDepliant("Arno", "Renvoyer Arno"));
    await utilisateur.click(dansLeDepliant("Arno", "Confirmer le renvoi d'Arno"));
    expect(actions.renvoyerUnHabitant).toHaveBeenCalledExactlyOnceWith(40);
    expect(document.activeElement).toBe(deplier("Kael"));
  });

  it("referme les Métiers dépliés sur la ligne d'un explorateur parti entre-temps, sans rien laisser à toucher", async () => {
    const libre: HabitantAffiche = { ...AVEC_UNE_PARTIE[1], etat: "libre" };
    const { rerender } = render(<ListeDesHabitants habitants={[libre]} metiers={METIERS} />);
    await userEvent.setup().click(deplier("Dara"));
    expect(auChoix("Dara")).not.toEqual([]);
    rerender(<ListeDesHabitants habitants={[AVEC_UNE_PARTIE[1]]} metiers={METIERS} />);
    expect(within(ligne("Dara")).queryAllByRole("button")).toEqual([]);
    expect(depliant("Dara")).toBeNull();
  });

  it("compte toujours parmi les explorateurs, et se filtre avec eux (US-0309, US-0314)", async () => {
    render(<ListeDesHabitants habitants={AVEC_UNE_PARTIE} metiers={METIERS} />);
    expect(effectifs()).toContain("Explorateur 1");
    await userEvent.setup().click(compteur("Explorateur"));
    expect(lignes()).toEqual(["Dara · Explorateur · en Expédition"]);
  });
});

describe("répartir les Habitants avec « − » et « + », en tête de chaque groupe (US-0312)", () => {
  const TROIS_METIERS: MetierDuTableau[] = [
    ["chasseur", "Chasseur", "rapporte de la Viande", "avec les Récoltes"],
    ["bucheron", "Bûcheron", "rapporte du Bois des forêts", "avec les Récoltes"],
    ["mineur", "Mineur", "rapporte de la Pierre des montagnes", null],
  ].map(([id, n, phrase, servira]) => ({ id: id!, nom: n!, phrase: phrase!, servira, icone: `/illustrations/metiers/${id}.webp` }));
  /** La page réduite à ce qui compte ici : le rail, le bandeau des sans Métier, le tableau et ses groupes. */
  const page = (habitants: HabitantAffiche[]) => <ListeDesHabitants habitants={habitants} metiers={TROIS_METIERS} />;
  /** L'en-tête du groupe d'un Métier. */
  const tete = (n: string) => [...tableau().querySelectorAll<HTMLElement>('th[scope="rowgroup"]')].find((th) => th.querySelector(`[aria-label="Un ${n} de plus"]`))!;
  /** Le « + » et le « − » d'un Métier. */
  const plus = (n: string) => within(tete(n)).getByRole("button", { name: `Un ${n} de plus` }) as HTMLButtonElement;
  const moins = (n: string) => within(tete(n)).getByRole("button", { name: `Un ${n} de moins` }) as HTMLButtonElement;
  /** L'effectif d'un Métier, entre ses deux boutons. */
  const effectif = (n: string) => plus(n).previousElementSibling!.textContent;
  /** Chaque ligne du tableau : prénom et Métier. */
  const prenomsEtMetiers = () => lignes().map((l) => l.split(" · ").slice(0, 2).join(" · "));
  /** Le bandeau des sans Métier, en son texte, ou null. */
  const bandeau = () => screen.queryByRole("link", { name: "Voir" })?.closest("p")?.querySelector("strong")?.textContent ?? null;

  it("met en tête du groupe de chaque Métier son médaillon muet, son nom, sa phrase et quand il servira, puis son effectif entre « − » et « + »", () => {
    render(page(HABITANTS));
    expect(nom(tete("Chasseur"))).toBe("Chasseur rapporte de la Viande Servira avec les Récoltes. − 1 +");
    expect(nom(tete("Bûcheron"))).toBe("Bûcheron rapporte du Bois des forêts Servira avec les Récoltes. − 0 +");
    expect(nom(tete("Mineur"))).toBe("Mineur rapporte de la Pierre des montagnes − 0 +");
    const icone = [...tete("Bûcheron").querySelectorAll("img")].find((img) => img.getAttribute("src")?.includes(encodeURIComponent("/illustrations/metiers/bucheron.webp")))!;
    expect(icone.getAttribute("alt")).toBe("");
    expect(icone.closest("[aria-hidden]")).not.toBeNull();
    expect([plus("Bûcheron"), moins("Bûcheron")].map((b) => b.type)).toEqual(["button", "button"]);
  });

  it("« + » donne aussitôt le Métier au premier Habitant sans Métier de la liste : l'effectif, les compteurs, les lignes et le bandeau suivent", async () => {
    render(page(HABITANTS));
    await userEvent.setup().click(plus("Bûcheron"));
    expect(actions.ajouterAuMetier).toHaveBeenCalledExactlyOnceWith("bucheron");
    // L'action n'a pas encore répondu.
    expect(effectif("Bûcheron")).toBe("1");
    expect(prenomsEtMetiers()).toEqual(["Brune · Choisir un Métier", "Cael · Chasseur", "Arno · Bûcheron"]);
    expect(nom(compteur("Sans Métier"))).toBe("Sans Métier 1");
    expect(bandeau()).toBe("1 Habitant sans Métier");
  });

  it("grise « + » partout dès qu'il ne reste aucun Habitant sans Métier", async () => {
    render(page(HABITANTS));
    const utilisateur = userEvent.setup();
    expect(TROIS_METIERS.map((m) => plus(m.nom).disabled)).toEqual([false, false, false]);
    await utilisateur.click(plus("Bûcheron"));
    await utilisateur.click(plus("Mineur"));
    expect(prenomsEtMetiers()).toEqual(["Cael · Chasseur", "Arno · Bûcheron", "Brune · Mineur"]);
    expect(TROIS_METIERS.map((m) => plus(m.nom).disabled)).toEqual([true, true, true]);
    expect(bandeau()).toBeNull();
  });

  it("grise « − » quand personne n'exerce le Métier", async () => {
    render(page(HABITANTS));
    expect(TROIS_METIERS.map((m) => moins(m.nom).disabled)).toEqual([false, true, true]);
    await userEvent.setup().click(plus("Mineur"));
    expect(moins("Mineur").disabled).toBe(false);
  });

  it("« − » remet aussitôt sans Métier le dernier arrivé de ce Métier, qui remonte parmi les sans Métier", async () => {
    render(
      page([
        { id: 43, prenom: "Dara", metier: null, etat: "libre" },
        { id: 44, prenom: "Brune", metier: "Chasseur", etat: "libre" },
        { id: 40, prenom: "Cael", metier: "Chasseur", etat: "libre" },
      ]),
    );
    await userEvent.setup().click(moins("Chasseur"));
    expect(actions.retirerDuMetier).toHaveBeenCalledExactlyOnceWith("chasseur");
    // Brune est arrivée après Cael : elle rejoint les sans Métier, à sa place dans l'ordre des prénoms.
    expect(prenomsEtMetiers()).toEqual(["Brune · Choisir un Métier", "Dara · Choisir un Métier", "Cael · Chasseur"]);
    expect(effectif("Chasseur")).toBe("1");
    expect(bandeau()).toBe("2 Habitants sans Métier");
  });

  it("plusieurs « + » rapides donnent chacun le sien, jamais plus qu'il n'y a d'Habitants sans Métier, et retrouvent la page relue (US-0315)", async () => {
    const { rerender } = render(page(HABITANTS));
    const utilisateur = userEvent.setup();
    await utilisateur.click(plus("Bûcheron"));
    await utilisateur.click(plus("Mineur"));
    // Plus personne sans Métier : un troisième « + » n'envoie rien.
    await utilisateur.click(plus("Bûcheron"));
    expect(actions.ajouterAuMetier.mock.calls).toEqual([["bucheron"], ["mineur"]]);
    expect(prenomsEtMetiers()).toEqual(["Cael · Chasseur", "Arno · Bûcheron", "Brune · Mineur"]);
    // La page relue, rangée par Métier, dit la même chose : rien ne bouge.
    const relue: HabitantAffiche[] = [HABITANTS[2], { ...HABITANTS[0], metier: "Bûcheron" }, { ...HABITANTS[1], metier: "Mineur" }];
    rerender(page(relue));
    await finirLesActions();
    expect(prenomsEtMetiers()).toEqual(["Cael · Chasseur", "Arno · Bûcheron", "Brune · Mineur"]);
    expect(TROIS_METIERS.map((m) => effectif(m.nom))).toEqual(["1", "1", "1"]);
    expect(TROIS_METIERS.map((m) => plus(m.nom).disabled)).toEqual([true, true, true]);
    expect(bandeau()).toBeNull();
  });

  it("se range à la page relue quand un autre appareil est passé avant : ses effectifs font foi (US-0315)", async () => {
    const { rerender } = render(page(HABITANTS));
    const utilisateur = userEvent.setup();
    await utilisateur.click(plus("Bûcheron"));
    await utilisateur.click(plus("Mineur"));
    // Sur l'autre appareil, Brune est devenue Chasseur juste avant : le second « + » n'a trouvé personne.
    rerender(page([{ ...HABITANTS[1], metier: "Chasseur" }, HABITANTS[2], { ...HABITANTS[0], metier: "Bûcheron" }]));
    await finirLesActions();
    expect(prenomsEtMetiers()).toEqual(["Brune · Chasseur", "Cael · Chasseur", "Arno · Bûcheron"]);
    expect(TROIS_METIERS.map((m) => effectif(m.nom))).toEqual(["2", "1", "0"]);
  });

  it("laisse la page relue faire foi, quand l'action n'a rien changé", async () => {
    render(page(HABITANTS));
    await userEvent.setup().click(plus("Bûcheron"));
    expect(effectif("Bûcheron")).toBe("1");
    await finirLesActions();
    expect(effectif("Bûcheron")).toBe("0");
    expect(prenomsEtMetiers()[0]).toBe("Arno · Choisir un Métier");
    expect(bandeau()).toBe("2 Habitants sans Métier");
  });

  describe("un Habitant parti en Expédition (US-0911)", () => {
    /** Dara, Chasseur partie en Expédition, arrivée après Cael. */
    const DARA: HabitantAffiche = { id: 43, prenom: "Dara", metier: "Chasseur", etat: "en Expédition" };

    it("compte dans l'effectif de son Métier, mais « − » ne la remet pas sans Métier : il prend le dernier arrivé resté au Foyer", async () => {
      render(page([...HABITANTS, DARA]));
      expect(effectif("Chasseur")).toBe("2");
      await userEvent.setup().click(moins("Chasseur"));
      expect(actions.retirerDuMetier).toHaveBeenCalledExactlyOnceWith("chasseur");
      expect(prenomsEtMetiers()).toContain("Dara · Chasseur");
      expect(prenomsEtMetiers()).toContain("Cael · Choisir un Métier");
    });

    it("grise « − » quand tous ceux du Métier sont partis", () => {
      render(page([HABITANTS[0], DARA]));
      expect(effectif("Chasseur")).toBe("1");
      expect(moins("Chasseur").disabled).toBe(true);
    });
  });
});
