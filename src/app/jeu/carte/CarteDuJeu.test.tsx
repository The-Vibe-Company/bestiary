// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BeteReperee } from "@/expeditions/betes-reperees";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import { casesDesAnneaux } from "@/monde/hex";
import type { CarteDuJoueur } from "@/monde/carte";
import { BROUILLARD } from "@/monde/couleurs-de-la-carte";
import type { Fiche } from "@/monde/fiche";
import { PORTEE_D_EXPLORATION_CASES } from "@/reglages";
import { CarteDuJeu } from "./CarteDuJeu";
import { aLEcran, LARGEUR_DE_CASE, vueSurLeFoyer, type Vue } from "./dessin";
import { LEGENDE_MONTREE } from "./Legende";
import { avancer, bornesDuZoom, cadrer, deplacer, devoiler, enChemin, flecheVersLeFoyer, limiteDeLaCarte, zoomer } from "./vue";

/** US-0428 : les fiches de Case demandées au serveur, chacune avec de quoi lui répondre. */
let fiches: { q: number; r: number; repondre: (fiche: Fiche | null) => void }[] = [];
const serveur = vi.hoisted(() => ({ ficheDeLaCase: vi.fn(), decouvertesDepuis: vi.fn() }));
vi.mock("./actions", () => serveur);
// US-0920 : le rappel d'une Expédition, depuis sa fiche, une action du serveur, comme ces fiches.
vi.mock("@/app/jeu/expeditions/actions", () => ({ rappeler: vi.fn() }));

/**
 * Ce que le <canvas> a reçu : ses gestes (mise à l'échelle, remplissages et traits avec leur couleur), le départ de
 * chaque tracé, et combien de fois il a été effacé pour être redessiné.
 */
const toile = vi.hoisted(() => ({ gestes: [] as string[], departs: [] as [number, number][], effacements: 0 }));
/** La place que la page donne à la carte, en pixels. */
const ecran = { largeur: 800, hauteur: 600 };
/** Le suivi de taille du <canvas> : le dernier posé, pour annoncer un changement de taille comme le navigateur. */
let suivi: { annoncer: () => void; suivis: Element[]; arrete: boolean } | null = null;
/** Les illustrations que la carte a demandé de charger, à charger à la main comme le ferait le navigateur. */
let images: { src: string; naturalWidth: number; naturalHeight: number; onload: (() => void) | null }[] = [];
/** Ce que la carte a demandé de faire à la prochaine image de l'écran, à lancer à la main comme le ferait le navigateur. */
let aLaProchaineImage = new Map<number, FrameRequestCallback>();

beforeEach(() => {
  // US-0427 : chaque essai est une nouvelle visite.
  sessionStorage.clear();
  toile.gestes = [];
  toile.departs = [];
  toile.effacements = 0;
  images = [];
  aLaProchaineImage = new Map();
  fiches = [];
  serveur.ficheDeLaCase.mockImplementation((q: number, r: number) => new Promise((repondre) => void fiches.push({ q, r, repondre })));
  serveur.decouvertesDepuis.mockReset();
  serveur.decouvertesDepuis.mockResolvedValue(null);
  let demandes = 0;
  vi.stubGlobal("requestAnimationFrame", (rappel: FrameRequestCallback) => {
    aLaProchaineImage.set(++demandes, rappel);
    return demandes;
  });
  vi.stubGlobal("cancelAnimationFrame", (demande: number) => aLaProchaineImage.delete(demande));
  // jsdom ne sait pas capturer un pointeur : la carte peut le lui demander, sans effet.
  HTMLCanvasElement.prototype.setPointerCapture = () => {};
  vi.stubGlobal(
    "Image",
    class {
      src = "";
      naturalWidth = 384;
      naturalHeight = 256;
      onload: (() => void) | null = null;
      constructor() {
        images.push(this);
      }
    },
  );
  const reglages: Record<string, unknown> = {};
  const pinceau = new Proxy(reglages, {
    get: (_, nom: string) =>
      nom in reglages
        ? reglages[nom]
        : (...valeurs: number[]) => {
            if (nom === "moveTo") toile.departs.push([valeurs[0], valeurs[1]]);
            if (nom === "clearRect") toile.effacements++;
            if (nom === "setTransform") toile.gestes.push(`${nom} ${valeurs.join(" ")}`);
            if (nom === "fill") toile.gestes.push(`remplir ${reglages.fillStyle}`);
            if (nom === "stroke") toile.gestes.push(`border ${reglages.strokeStyle}`);
            if (nom === "drawImage") toile.gestes.push(`poser ${(valeurs[0] as unknown as { src: string }).src}`);
          },
    set: (_, nom: string, valeur) => {
      reglages[nom] = valeur;
      return true;
    },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(pinceau as unknown as CanvasRenderingContext2D);
  // La carte sous la barre du haut, de 64 pixels.
  vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockImplementation(() => ({ left: 0, top: 64, width: ecran.largeur, height: ecran.hauteur }) as DOMRect);
  // La couleur calculée d'une expression CSS sur le <canvas> : l'expression elle-même, pour reconnaître chaque couleur qu'il reçoit.
  const calculer = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = calculer(element, pseudo);
    if (!(element instanceof HTMLCanvasElement) || !element.style.color) return style;
    return new Proxy(style, {
      get: (cible, nom) => (nom === "color" ? element.style.color : typeof Reflect.get(cible, nom) === "function" ? Reflect.get(cible, nom).bind(cible) : Reflect.get(cible, nom)),
    });
  });
  // Un écran haute densité : deux pixels de l'écran par pixel de la page.
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(rappel: () => void) {
        suivi = { annoncer: rappel, suivis: [], arrete: false };
      }
      observe(element: Element) {
        suivi!.suivis.push(element);
        suivi!.annoncer();
      }
      disconnect() {
        suivi!.arrete = true;
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.assign(ecran, { largeur: 800, hauteur: 600 });
  suivi = null;
});

const FOYER = { q: 31, r: -57 };
const AUTOUR = casesDesAnneaux(0, 1).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
/** Le Foyer et ses six voisines, d'une teinte sans motif : on n'y voit que les hexagones. */
const CARTE: CarteDuJoueur = {
  monde: "Aube",
  foyer: FOYER,
  foyers: [],
  teintes: ["inconnue"],
  cases: { q: AUTOUR.map((c) => c.q), r: AUTOUR.map((c) => c.r), teinte: AUTOUR.map(() => 0), zone: AUTOUR.map(() => 0) },
};
const FONDS = ["var(--galet)"];
/** Le rayon d'une Case à l'écran : la pointe du haut d'une Case est à ce rayon au-dessus de son centre. */
const RAYON = LARGEUR_DE_CASE / Math.sqrt(3);
/** Les départs des tracés, chacun une fois : celui de l'hexagone d'une Case est son sommet du haut. */
const departs = () => new Set(toile.departs.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`));
/** Le sommet du haut d'une Case, à l'écran tel qu'il est. */
const sommet = (c: { q: number; r: number }) => {
  const { x, y } = aLEcran(c, vueSurLeFoyer(FOYER, ecran.largeur, ecran.hauteur));
  return `${x.toFixed(6)},${(y - RAYON).toFixed(6)}`;
};
const toutesTracees = () => AUTOUR.every((c) => departs().has(sommet(c)));
const auMilieuDeLEcran = () => departs().has(`${(ecran.largeur / 2).toFixed(6)},${(ecran.hauteur / 2 - RAYON).toFixed(6)}`);
/** Si une Case est dessinée là où une vue la met (le Foyer par défaut) : le sommet du haut de son hexagone est un départ de tracé. */
const dessineeLa = (vue: Vue, c = FOYER) => {
  const { x, y } = aLEcran(c, vue);
  return departs().has(`${x.toFixed(6)},${(y - vue.rayon).toFixed(6)}`);
};
/** La vue à l'ouverture de la carte. */
const ouverte = () => vueSurLeFoyer(FOYER, ecran.largeur, ecran.hauteur);
/**
 * Lance ce que la carte a demandé de faire à la prochaine image de l'écran, en oubliant les tracés d'avant ; US-0426 :
 * une image affichée à l'instant `ms`.
 */
const prochaineImage = (ms = 0) =>
  act(() => {
    const rappels = [...aLaProchaineImage.values()];
    aLaProchaineImage.clear();
    toile.departs = [];
    for (const rappel of rappels) rappel(ms);
  });
/** Un pointeur qui se pose, bouge ou se lève sur la carte, en (x, y) : la souris par défaut, bouton principal. */
const pointeur = (type: "pointerdown" | "pointermove" | "pointerup", x: number, y: number, en: Partial<PointerEventInit> = {}) =>
  act(() => {
    const evenement = { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: type === "pointermove" ? -1 : 0, bubbles: true, ...en };
    document.querySelector("canvas")!.dispatchEvent(new PointerEvent(type, evenement));
  });

describe("la carte du Monde (US-0417)", () => {
  it("se présente aux lecteurs d'écran comme la carte du Monde, qui se manie au clavier (US-0422)", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const carte = screen.getByRole("application", { name: "Carte du Monde" });
    expect(carte.tagName).toBe("CANVAS");
    expect(carte.getAttribute("aria-roledescription")).toBe("carte");
  });

  it("dessine les Cases dès l'ouverture, le Foyer au milieu, nette sur un écran haute densité", () => {
    const { container } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const canvas = container.querySelector("canvas")!;
    // Deux pixels de l'écran par pixel de la page : la toile est deux fois plus grande, et le dessin mis à l'échelle.
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(toile.gestes[0]).toBe("setTransform 2 0 0 2 0 0");
    expect(toutesTracees()).toBe(true);
    expect(auMilieuDeLEcran()).toBe(true);
  });

  it("se redessine quand l'écran change de taille, le Foyer toujours au milieu", () => {
    const { container } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    Object.assign(ecran, { largeur: 375, hauteur: 559 });
    vi.stubGlobal("devicePixelRatio", 3);
    toile.departs = [];
    act(() => suivi!.annoncer());
    expect([container.querySelector("canvas")!.width, container.querySelector("canvas")!.height]).toEqual([1125, 1677]);
    expect(toutesTracees()).toBe(true);
    expect(auMilieuDeLEcran()).toBe(true);
  });

  it("cesse de suivre la taille de l'écran une fois la page quittée", () => {
    const { unmount, container } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(suivi!.suivis).toEqual([container.querySelector("canvas")]);
    unmount();
    expect(suivi!.arrete).toBe(true);
  });
});

describe("les Biomes sur la carte (US-0418)", () => {
  it("peint chaque teinte de la couleur que la page lui donne, ses motifs d'Encre ou d'Ivoire légers, et un bord d'Encre à peine marqué", () => {
    const carte: CarteDuJoueur = { ...CARTE, teintes: ["prairie", "mer"], cases: { ...CARTE.cases, teinte: AUTOUR.map((c) => (c.r === FOYER.r ? 0 : 1)) } };
    render(<CarteDuJeu carte={carte} fonds={["var(--biome-prairie)", "var(--biome-eau)"]} />);
    expect(toile.gestes.slice(1, 6)).toEqual([
      "remplir var(--biome-prairie)",
      "remplir var(--biome-eau)",
      // La prairie a un motif sombre, la mer un motif clair.
      "border color-mix(in oklch, var(--encre) 26%, transparent)",
      "border color-mix(in oklch, var(--ivoire) 45%, transparent)",
      "border color-mix(in oklch, var(--encre) 14%, transparent)",
    ]);
  });
});

describe("son Foyer sur la carte (US-0419)", () => {
  it("charge l'illustration de la hutte du chef, celle de l'écran du Foyer, en petit", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(images).toHaveLength(1);
    expect(decodeURIComponent(images[0].src)).toMatch(/^\/_next\/image\?url=\/illustrations\/foyer\/prairie\.webp&w=\d+&q=\d+$/);
    expect(Number(images[0].src.match(/&w=(\d+)/)![1])).toBeLessThanOrEqual(384);
  });

  it("marque son Foyer d'un repère citron cerné d'Encre dès l'ouverture, puis y pose la hutte une fois chargée", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(toile.gestes.slice(-3)).toEqual(["remplir var(--citron)", "border var(--encre)", "remplir var(--encre)"]);
    expect(toile.gestes.filter((g) => g.startsWith("poser"))).toEqual([]);
    toile.gestes = [];
    act(() => images[0].onload!());
    expect(toile.gestes.filter((g) => g.startsWith("poser"))).toEqual([`poser ${images[0].src}`]);
    expect(toile.gestes.slice(-3)).toEqual(["remplir var(--citron)", "border var(--encre)", "remplir var(--encre)"]);
  });

  it("marque les Foyers des autres joueurs d'Encre, sans hutte ni repère de plus", () => {
    render(<CarteDuJeu carte={{ ...CARTE, foyers: [AUTOUR[1], AUTOUR[4]] }} fonds={FONDS} />);
    toile.gestes = [];
    act(() => images[0].onload!());
    // Un remplissage d'Encre pour les deux autres Foyers, un pour l'œil du repère ; une hutte et un repère, au sien.
    expect(toile.gestes.filter((g) => g === "remplir var(--encre)")).toHaveLength(2);
    expect(toile.gestes.filter((g) => g.startsWith("poser") || g === "remplir var(--citron)")).toHaveLength(2);
  });

  it("ne dessine plus rien de la hutte une fois la page quittée", () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    unmount();
    expect(images[0].onload).toBeNull();
  });
});

describe("glisser la carte à la souris (US-0420)", () => {
  it("la fait suivre la souris, bouton appuyé, redessinée une fois à chaque image de l'écran", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const effacements = toile.effacements;
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 420, 310);
    pointeur("pointermove", 450, 280);
    // Pas un dessin par mouvement : un seul, à la prochaine image.
    expect(toile.effacements).toBe(effacements);
    expect(aLaProchaineImage.size).toBe(1);
    prochaineImage();
    expect(toile.effacements).toBe(effacements + 1);
    expect(dessineeLa(deplacer(ouverte(), 50, -20, 60))).toBe(true);
    pointeur("pointermove", 430, 300);
    pointeur("pointerup", 430, 300);
    prochaineImage();
    expect(dessineeLa(deplacer(ouverte(), 30, 0, 60))).toBe(true);
  });

  it("ne prend pas un clic pour un déplacement", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 402, 301);
    pointeur("pointerup", 402, 301);
    expect(aLaProchaineImage.size).toBe(0);
    expect(auMilieuDeLEcran()).toBe(true);
  });

  it("s'arrête un peu au-delà du bord du Monde : la carte reste en vue", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    // Le Foyer est au nord du Monde, sur l'anneau 57 : tirer la carte loin vers le bas, c'est aller au-delà, vers le nord.
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 400, 100_300);
    prochaineImage();
    // Le milieu de l'écran s'est arrêté à 2 Cases au-delà de la plus éloignée de la carte : le Foyer et ses voisines restent en vue.
    expect(limiteDeLaCarte(CARTE)).toBe(60);
    const arretee = deplacer(ouverte(), 0, 100_000, 60);
    expect(arretee.milieu.r).toBeCloseTo(-60, 9);
    expect(AUTOUR.filter((c) => dessineeLa(arretee, c))).toHaveLength(7);
  });

  it("garde le même endroit au milieu quand l'écran change de taille", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 460, 260);
    prochaineImage();
    Object.assign(ecran, { largeur: 375, hauteur: 559 });
    toile.departs = [];
    act(() => suivi!.annoncer());
    expect(dessineeLa({ ...deplacer(ouverte(), 60, -40, 60), largeur: 375, hauteur: 559 })).toBe(true);
  });

  it("se laisse aussi glisser au doigt, avec les mêmes limites (US-0421)", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const doigt = { pointerType: "touch", pointerId: 3 };
    pointeur("pointerdown", 200, 300, doigt);
    pointeur("pointermove", 205, 304, doigt);
    // Un doigt qui se pose bouge un peu : ce n'est pas encore un glissement.
    expect(aLaProchaineImage.size).toBe(0);
    pointeur("pointermove", 170, 320, doigt);
    prochaineImage();
    expect(dessineeLa(deplacer(ouverte(), -30, 20, 60))).toBe(true);
    pointeur("pointermove", 170, 100_320, doigt);
    pointeur("pointerup", 170, 100_320, doigt);
    prochaineImage();
    expect(dessineeLa(deplacer(ouverte(), -30, 100_020, 60))).toBe(true);
    expect(AUTOUR.filter((c) => dessineeLa(deplacer(ouverte(), -30, 100_020, 60), c))).toHaveLength(7);
  });

  it("cesse de suivre la souris et de dessiner une fois la page quittée", () => {
    const { unmount, container } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const canvas = container.querySelector("canvas")!;
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 450, 300);
    unmount();
    expect(aLaProchaineImage.size).toBe(0);
    canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: 500, clientY: 300, pointerId: 1, pointerType: "mouse" }));
    expect(aLaProchaineImage.size).toBe(0);
  });
});

describe("déplacer la carte au clavier (US-0422)", () => {
  it("se sélectionne au clavier, puis chaque flèche la déplace de 3 Cases, sans faire défiler la page", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("application", { name: "Carte du Monde" }));
    await user.keyboard("{ArrowRight}");
    prochaineImage();
    // Le Foyer s'en va de 3 Cases vers la gauche : on regarde 3 Cases plus à l'est.
    const versLEst = avancer(ouverte(), 1, 0, 60);
    expect(aLEcran(FOYER, versLEst).x).toBeCloseTo(ecran.largeur / 2 - 3 * LARGEUR_DE_CASE, 9);
    expect(dessineeLa(versLEst)).toBe(true);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    prochaineImage();
    expect(dessineeLa(avancer(avancer(versLEst, 0, 1, 60), 0, 1, 60))).toBe(true);
    // La page garde sa place : la flèche ne lui revient pas.
    expect(fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" })).toBe(false);
  });

  it("garde les mêmes limites qu'à la souris", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const carte = screen.getByRole("application", { name: "Carte du Monde" });
    let attendue = ouverte();
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(carte, { key: "ArrowUp" });
      attendue = avancer(attendue, 0, -1, 60);
    }
    prochaineImage();
    expect(attendue.milieu.r).toBeCloseTo(-60, 9);
    expect(dessineeLa(attendue)).toBe(true);
  });
});

describe("zoomer à la molette ou au pavé tactile (US-0423)", () => {
  it("zoome autour du pointeur, redessinée à la prochaine image, sans que la page zoome ni défile", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const carte = screen.getByRole("application", { name: "Carte du Monde" });
    // La Case à l'est du Foyer, sous le pointeur : elle y reste.
    const { x, y } = aLEcran(AUTOUR[1], ouverte());
    expect(fireEvent.wheel(carte, { deltaY: -300, clientX: x, clientY: y + 64 })).toBe(false);
    prochaineImage();
    const rapprochee = zoomer(ouverte(), 2, x, y, 60);
    expect(rapprochee.rayon).toBeCloseTo(2 * RAYON, 9);
    expect(dessineeLa(rapprochee, AUTOUR[1])).toBe(true);
    expect(aLEcran(AUTOUR[1], rapprochee).x).toBeCloseTo(x, 9);
    // Le geste de zoom du pavé tactile, une molette avec Ctrl, éloigne de même.
    expect(fireEvent.wheel(carte, { deltaY: 100, ctrlKey: true, clientX: x, clientY: y + 64 })).toBe(false);
    prochaineImage();
    expect(dessineeLa(zoomer(rapprochee, 0.5, x, y, 60), AUTOUR[1])).toBe(true);
  });

  it("s'arrête à la vue large et à la vue rapprochée", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const carte = screen.getByRole("application", { name: "Carte du Monde" });
    fireEvent.wheel(carte, { deltaY: 100_000, clientX: 400, clientY: 364 });
    prochaineImage();
    expect(dessineeLa({ ...ouverte(), rayon: bornesDuZoom(ecran.largeur, ecran.hauteur).min })).toBe(true);
    fireEvent.wheel(carte, { deltaY: -100_000, clientX: 400, clientY: 364 });
    prochaineImage();
    expect(dessineeLa({ ...ouverte(), rayon: bornesDuZoom(ecran.largeur, ecran.hauteur).max })).toBe(true);
  });

  it("zoome aussi en pinçant à deux doigts, autour du point entre eux, dans les mêmes bornes (US-0424)", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const [un, deux] = [{ pointerType: "touch", pointerId: 1 }, { pointerType: "touch", pointerId: 2 }];
    // Les deux doigts de part et d'autre de la Case à l'est du Foyer, puis écartés d'autant chacun.
    const { x, y } = aLEcran(AUTOUR[1], ouverte());
    pointeur("pointerdown", x - 50, y + 64, un);
    pointeur("pointerdown", x + 50, y + 64, deux);
    pointeur("pointermove", x - 100, y + 64, un);
    pointeur("pointermove", x + 100, y + 64, deux);
    prochaineImage();
    const pincee = zoomer(ouverte(), 2, x, y, 60);
    expect(pincee.rayon).toBeCloseTo(2 * RAYON, 6);
    expect(aLEcran(AUTOUR[1], pincee).x).toBeCloseTo(x, 6);
    expect(departs().has(`${x.toFixed(6)},${(y - pincee.rayon).toFixed(6)}`)).toBe(true);
    // Écartés bien plus loin, ils s'arrêtent à la vue rapprochée, la même Case entre eux.
    pointeur("pointermove", x - 1000, y + 64, un);
    pointeur("pointermove", x + 1000, y + 64, deux);
    prochaineImage();
    expect(departs().has(`${x.toFixed(6)},${(y - bornesDuZoom(ecran.largeur, ecran.hauteur).max).toFixed(6)}`)).toBe(true);
  });

  it("zoome d'un cran autour du milieu de l'écran à chaque appui sur « + » ou « − », grisés quand leur limite est atteinte (US-0425)", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const user = userEvent.setup();
    const [plus, moins] = [screen.getByRole<HTMLButtonElement>("button", { name: "Zoomer" }), screen.getByRole<HTMLButtonElement>("button", { name: "Dézoomer" })];
    expect([plus.disabled, moins.disabled]).toEqual([false, false]);
    // La carte déplacée d'abord : le zoom se fait autour du milieu de l'écran, pas du Foyer.
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 460, 300);
    pointeur("pointerup", 460, 300);
    await user.click(plus);
    prochaineImage();
    const deplacee = deplacer(ouverte(), 60, 0, 60);
    expect(dessineeLa(zoomer(deplacee, 1.5, ecran.largeur / 2, ecran.hauteur / 2, 60))).toBe(true);
    // Jusqu'à la vue rapprochée : « + » se grise.
    for (let i = 0; i < 10 && !plus.disabled; i++) await user.click(plus);
    expect([plus.disabled, moins.disabled]).toEqual([true, false]);
    prochaineImage();
    const { min, max } = bornesDuZoom(ecran.largeur, ecran.hauteur);
    expect(dessineeLa({ ...deplacee, rayon: max })).toBe(true);
    // Puis jusqu'à la vue large : « − » se grise à son tour.
    for (let i = 0; i < 20 && !moins.disabled; i++) await user.click(moins);
    expect([plus.disabled, moins.disabled]).toEqual([false, true]);
    prochaineImage();
    expect(dessineeLa({ ...deplacee, rayon: min })).toBe(true);
  });

  it("grise aussi « + » ou « − » quand la molette ou les doigts atteignent la limite (US-0425)", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    fireEvent.wheel(screen.getByRole("application", { name: "Carte du Monde" }), { deltaY: -100_000, clientX: 400, clientY: 364 });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Zoomer" }).disabled).toBe(true);
  });

  it("s'ouvre dans les bornes du zoom, et y reste quand l'écran change de taille", () => {
    Object.assign(ecran, { largeur: 4000, hauteur: 3000 });
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    // Sur un très grand écran, les Cases grossissent pour ne pas en montrer plus de 40 au bord.
    expect(dessineeLa({ ...ouverte(), rayon: bornesDuZoom(4000, 3000).min })).toBe(true);
    fireEvent.wheel(screen.getByRole("application", { name: "Carte du Monde" }), { deltaY: -100_000, clientX: 2000, clientY: 1564 });
    prochaineImage();
    Object.assign(ecran, { largeur: 375, hauteur: 559 });
    toile.departs = [];
    act(() => suivi!.annoncer());
    expect(dessineeLa({ ...ouverte(), rayon: bornesDuZoom(375, 559).max })).toBe(true);
  });
});

describe("revenir au Foyer (US-0426)", () => {
  /** Glisse la carte de (dx, dy) à la souris. */
  const glisser = (dx: number, dy: number) => {
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 400 + dx, 300 + dy);
    pointeur("pointerup", 400 + dx, 300 + dy);
  };
  /** La carte glissée de 150 pixels vers la gauche, puis rapprochée deux fois autour de la Case à l'est du Foyer : il reste à l'écran. */
  const ailleurs = () => {
    glisser(-150, 0);
    const { x, y } = aLEcran(AUTOUR[1], deplacer(ouverte(), -150, 0, 60));
    fireEvent.wheel(screen.getByRole("application", { name: "Carte du Monde" }), { deltaY: -300, clientX: x, clientY: y + 64 });
    prochaineImage();
    return zoomer(deplacer(ouverte(), -150, 0, 60), 2, x, y, 60);
  };
  const revenir = () => userEvent.setup().click(screen.getByRole("button", { name: "Revenir au Foyer" }));
  /** La flèche du Foyer : hors du clavier et des lecteurs d'écran, qui ont le bouton du Foyer. */
  const fleche = () => document.querySelector<HTMLButtonElement>("button[aria-hidden]")!;
  /** La place de la flèche pour une vue, telle que vue.ts la calcule, en style. */
  const placee = (vue: Vue) => {
    const ou = flecheVersLeFoyer(vue, FOYER, [], 22)!;
    return `translate(${ou.x}px, ${ou.y}px) rotate(${ou.angle}rad)`;
  };

  it(`ramène la carte sur le Foyer, au zoom par défaut, par un court mouvement dessiné à chaque image de l'écran`, async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const depart = ailleurs();
    expect(dessineeLa(depart)).toBe(true);
    await revenir();
    // Le mouvement part de la première image, là où est la carte ; à mi-temps, il est à mi-chemin.
    prochaineImage(1000);
    expect(dessineeLa(depart)).toBe(true);
    prochaineImage(1150);
    expect(dessineeLa(enChemin(depart, ouverte(), 0.5))).toBe(true);
    prochaineImage(1300);
    expect(auMilieuDeLEcran()).toBe(true);
    expect(dessineeLa(ouverte())).toBe(true);
    // Arrivé, plus rien ne bouge.
    expect(aLaProchaineImage.size).toBe(0);
  });

  it("arrive au Foyer à la taille qu'a la carte, même quand l'écran change de taille en chemin", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    ailleurs();
    await revenir();
    prochaineImage(1000);
    Object.assign(ecran, { largeur: 375, hauteur: 559 });
    act(() => suivi!.annoncer());
    prochaineImage(1300);
    expect(auMilieuDeLEcran()).toBe(true);
    expect(dessineeLa(ouverte())).toBe(true);
  });

  it("s'arrête là où il en est dès que le joueur bouge la carte, ou zoome", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const depart = ailleurs();
    await revenir();
    prochaineImage(1000);
    prochaineImage(1100);
    glisser(20, 0);
    prochaineImage(1200);
    expect(dessineeLa(deplacer(enChemin(depart, ouverte(), 1 / 3), 20, 0, 60))).toBe(true);
    expect(aLaProchaineImage.size).toBe(0);
    // De même au bouton « + ».
    await revenir();
    prochaineImage(2000);
    await userEvent.setup().click(screen.getByRole("button", { name: "Zoomer" }));
    prochaineImage(2100);
    expect(aLaProchaineImage.size).toBe(0);
  });

  it("y va d'un coup, sans mouvement, quand le joueur préfère les écrans sans mouvement", async () => {
    vi.stubGlobal("matchMedia", (requete: string) => ({ matches: requete === "(prefers-reduced-motion: reduce)" }));
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    ailleurs();
    toile.departs = [];
    await revenir();
    // Aussitôt, sans attendre d'image de l'écran.
    expect(dessineeLa(ouverte())).toBe(true);
    expect(aLaProchaineImage.size).toBe(0);
  });

  it("montre d'une flèche au bord de la carte où est le Foyer hors de l'écran, qui suit la vue et ramène au Foyer", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(fleche().hidden).toBe(true);
    // Le Foyer passé loin au-dessus du haut de l'écran : la flèche au bord du haut, tournée vers lui.
    glisser(0, -1000);
    prochaineImage();
    const auNord = deplacer(ouverte(), 0, -1000, 60);
    expect(fleche().hidden).toBe(false);
    expect(fleche().style.transform).toBe(placee(auNord));
    // Elle suit la vue, à chaque image.
    glisser(-300, 0);
    prochaineImage();
    expect(fleche().style.transform).toBe(placee(deplacer(auNord, -300, 0, 60)));
    // La toucher ramène au Foyer, qui se voit : elle disparaît.
    await userEvent.setup().click(fleche());
    prochaineImage(1000);
    prochaineImage(1300);
    expect(auMilieuDeLEcran()).toBe(true);
    expect(fleche().hidden).toBe(true);
  });

  it("repose la flèche quand la légende se montre ou qu'un panneau publie sa hauteur, sans attendre que la carte bouge", async () => {
    render(
      <>
        <CarteDuJeu carte={CARTE} fonds={FONDS} />
        <aside data-sur-la-carte="" />
      </>,
    );
    // Le Foyer passé loin au-dessus du haut de l'écran : la flèche au bord du haut.
    glisser(0, -1000);
    prochaineImage();
    const auNord = deplacer(ouverte(), 0, -1000, 60);
    expect(fleche().style.transform).toBe(placee(auNord));
    // La légende se montre en haut de la carte, là où était la flèche : elle descend sous son panneau.
    let montree = true;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.tagName === "ASIDE" && montree ? { left: 300, top: 0, width: 200, height: 200, right: 500, bottom: 200 } : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }) as DOMRect;
    });
    document.dispatchEvent(new Event(LEGENDE_MONTREE));
    prochaineImage();
    // Son panneau en pixels de la carte, qui commence 64 pixels sous le haut de la page.
    const sousLaLegende = flecheVersLeFoyer(auNord, FOYER, [{ gauche: 300, haut: -64, droite: 500, bas: 136 }], 22)!;
    expect(sousLaLegende.y).toBeGreaterThan(136);
    expect(fleche().style.transform).toBe(`translate(${sousLaLegende.x}px, ${sousLaLegende.y}px) rotate(${sousLaLegende.angle}rad)`);
    // Elle se referme, et un panneau du bas publie sa hauteur : la flèche reprend sa place au bord du haut.
    montree = false;
    try {
      document.documentElement.style.setProperty("--hauteur-fiche", "120px");
      await Promise.resolve();
      prochaineImage();
      expect(fleche().style.transform).toBe(placee(auNord));
    } finally {
      document.documentElement.style.removeProperty("--hauteur-fiche");
    }
  });

  it("cesse le mouvement une fois la page quittée", async () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    ailleurs();
    await revenir();
    prochaineImage(1000);
    unmount();
    expect(aLaProchaineImage.size).toBe(0);
  });
});

describe("retrouver la carte là où on l'a laissée (US-0427)", () => {
  /** La carte glissée puis rapprochée deux fois autour du milieu de l'écran, dessinée ; la vue où on la laisse. */
  const laisser = () => {
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 340, 330);
    pointeur("pointerup", 340, 330);
    fireEvent.wheel(screen.getByRole("application", { name: "Carte du Monde" }), { deltaY: -300, clientX: 400, clientY: 364 });
    prochaineImage();
    return zoomer(deplacer(ouverte(), -60, 30, 60), 2, 400, 300, 60);
  };

  it("se rouvre au même endroit et au même zoom en y revenant pendant la même visite", () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const laissee = laisser();
    expect(dessineeLa(laissee)).toBe(true);
    // Le joueur va voir ses Habitants, puis revient sur la carte.
    unmount();
    toile.departs = [];
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(dessineeLa(laissee)).toBe(true);
    expect(auMilieuDeLEcran()).toBe(false);
  });

  it("retrouve le même endroit au milieu sur un écran qui a changé de taille entre-temps", () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const laissee = laisser();
    unmount();
    Object.assign(ecran, { largeur: 375, hauteur: 559 });
    toile.departs = [];
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    // Le zoom ramené dans les bornes de ce plus petit écran, comme à chaque changement de taille.
    const retrouvee = cadrer(laissee, 375, 559);
    expect(retrouvee.milieu).toEqual(laissee.milieu);
    expect(dessineeLa(retrouvee)).toBe(true);
  });

  it("se rouvre sur le Foyer à une nouvelle visite : un nouvel onglet ne retient rien", () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    laisser();
    unmount();
    sessionStorage.clear();
    toile.departs = [];
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(auMilieuDeLEcran()).toBe(true);
  });

  it("ne reprend jamais la vue d'un autre Monde", () => {
    const { unmount } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    laisser();
    unmount();
    toile.departs = [];
    render(<CarteDuJeu carte={{ ...CARTE, monde: "Carte-0417" }} fonds={FONDS} />);
    expect(auMilieuDeLEcran()).toBe(true);
  });

  it("retient la vue au plus une fois par image de l'écran, quel que soit le nombre de gestes", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const retenir = vi.spyOn(Storage.prototype, "setItem");
    pointeur("pointerdown", 400, 300);
    for (let x = 390; x > 300; x -= 10) pointeur("pointermove", x, 300);
    fireEvent.wheel(screen.getByRole("application", { name: "Carte du Monde" }), { deltaY: -100, clientX: 400, clientY: 364 });
    expect(retenir).not.toHaveBeenCalled();
    prochaineImage();
    expect(retenir).toHaveBeenCalledTimes(1);
  });

  it("s'ouvre sur le Foyer, et se manie, quand l'onglet ne peut rien retenir", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("stockage interdit");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage interdit");
    });
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(auMilieuDeLEcran()).toBe(true);
    expect(dessineeLa(laisser())).toBe(true);
  });
});

/** US-0428 : où tombe le centre d'une Case dans la page, la carte ouverte : sous la barre du haut, de 64 pixels. */
const dansLaPage = (c: { q: number; r: number }) => ({ x: aLEcran(c, ouverte()).x, y: aLEcran(c, ouverte()).y + 64 });
/** US-0428 : un clic de la souris sur la carte ouverte, au centre de la Case c. */
const cliquer = (c: { q: number; r: number }) => {
  const { x, y } = dansLaPage(c);
  pointeur("pointerdown", x, y);
  pointeur("pointerup", x, y);
};
/** US-0428 : si la carte surligne une Case : un trait citron, que seul le surlignage trace (le repère du Foyer est rempli). */
const surlignee = () => toile.gestes.includes("border var(--citron)");
const fiche = () => screen.queryByRole("region", { name: "Fiche de la Case" });

describe("ouvrir la fiche d'une Case (US-0428)", () => {
  /** La Case au sud-ouest du Foyer, une forêt libre, à une Case de lui. */
  const FORET: Fiche = { ...AUTOUR[1], biome: "Forêt", chef: null, aVous: false, zone: 0, distance: 1, anneau: 2 };

  it("ouvre d'un clic la fiche de la Case, surlignée aussitôt, et la remplit à la réponse du serveur", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(fiche()).toBeNull();
    const { x, y } = dansLaPage(AUTOUR[1]);
    pointeur("pointerdown", x + 2, y - 1);
    pointeur("pointerup", x + 3, y - 1);
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([AUTOUR[1]]);
    expect(surlignee()).toBe(true);
    expect(fiche()).not.toBeNull();
    await act(async () => fiches[0].repondre(FORET));
    expect(within(fiche()!).getByRole("heading", { name: "Forêt" })).toBeTruthy();
  });

  it("l'ouvre aussi d'un toucher du doigt", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const { x, y } = dansLaPage(AUTOUR[4]);
    pointeur("pointerdown", x, y, { pointerType: "touch", pointerId: 5 });
    pointeur("pointerup", x + 5, y + 4, { pointerType: "touch", pointerId: 5 });
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([AUTOUR[4]]);
  });

  it("n'ouvre pas de fiche en faisant glisser la carte", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const { x, y } = dansLaPage(AUTOUR[1]);
    pointeur("pointerdown", x, y);
    pointeur("pointermove", x + 40, y);
    pointeur("pointerup", x + 40, y);
    prochaineImage();
    expect(fiches).toEqual([]);
    expect(fiche()).toBeNull();
    expect(surlignee()).toBe(false);
  });

  it("ouvre au clavier, à Entrée, la fiche de la Case au milieu de la carte", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    fireEvent.keyDown(screen.getByRole("application", { name: "Carte du Monde" }), { key: "Enter" });
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([FOYER]);
  });

  it("n'ouvre rien hors des Cases du Monde", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const { x, y } = dansLaPage({ q: FOYER.q, r: FOYER.r - 3 });
    pointeur("pointerdown", x, y);
    pointeur("pointerup", x, y);
    expect(fiches).toEqual([]);
    expect(fiche()).toBeNull();
  });

  it("fait glisser la carte juste assez pour que la fiche, à côté, ne cache pas la Case choisie", () => {
    // La fiche en haut à gauche de la carte, assez grande pour couvrir la Case à l'ouest du Foyer.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 12, top: 76, width: 380, height: 300 } as DOMRect);
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const { x, y } = dansLaPage(AUTOUR[0]);
    pointeur("pointerdown", x, y);
    pointeur("pointerup", x, y);
    const montree = devoiler(ouverte(), AUTOUR[0], { x: 12, y: 12, largeur: 380, hauteur: 300 }, 60);
    expect(montree).not.toBe(ouverte());
    prochaineImage();
    expect(dessineeLa(montree, AUTOUR[0])).toBe(true);
  });

  it("fait passer la flèche du Foyer à côté de la fiche, sans la cacher dessous (US-0426)", () => {
    // Une carte de 30 Cases autour du Foyer, et la fiche le long du bord gauche ; rien d'autre n'a de place à l'écran.
    const autour = casesDesAnneaux(0, 30).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
    const grande = { ...CARTE, cases: { q: autour.map((c) => c.q), r: autour.map((c) => c.r), teinte: autour.map(() => 0), zone: autour.map(() => 0) } };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.tagName === "SECTION" ? { left: 12, top: 76, width: 300, height: 500, right: 312, bottom: 576 } : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }) as DOMRect;
    });
    render(<CarteDuJeu carte={grande} fonds={FONDS} />);
    // Le Foyer passé loin à gauche de l'écran : la flèche au bord gauche, là où se posera la fiche.
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", -400, 300);
    pointeur("pointerup", -400, 300);
    prochaineImage();
    const vue = deplacer(ouverte(), -800, 0, limiteDeLaCarte(grande));
    const enStyle = (ou: { x: number; y: number; angle: number } | null) => `translate(${ou!.x}px, ${ou!.y}px) rotate(${ou!.angle}rad)`;
    const fleche = document.querySelector<HTMLButtonElement>("button[aria-hidden]")!;
    expect(fleche.style.transform).toBe(enStyle(flecheVersLeFoyer(vue, FOYER, [], 22)));
    pointeur("pointerdown", 380, 364);
    pointeur("pointerup", 380, 364);
    expect(fiche()).not.toBeNull();
    const aCoteDeLaFiche = flecheVersLeFoyer(vue, FOYER, [{ gauche: 12, haut: 12, droite: 312, bas: 512 }], 22);
    expect(aCoteDeLaFiche!.x).toBeGreaterThan(312 + 22 - 1e-9);
    expect(fleche.style.transform).toBe(enStyle(aCoteDeLaFiche));
  });
});

describe("choisir la destination d'une Expédition sur la carte (US-0907)", () => {
  /** La Case au sud-ouest du Foyer, une forêt libre, à une Case de lui. */
  const FORET: Fiche = { ...AUTOUR[1], biome: "Forêt", chef: null, aVous: false, zone: 0, distance: 1, anneau: 2 };
  const lien = (nom: string) => screen.queryByRole("link", { name: nom });

  it("ouverte pour choisir la destination, le dit à la fiche : « Choisir cette destination », qui revient à l'écran avec ses autres choix", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} destination="choix=destination&sejour=60" />);
    cliquer(AUTOUR[1]);
    await act(async () => fiches[0].repondre(FORET));
    expect(lien("Choisir cette destination")!.getAttribute("href")).toBe(`/jeu/expeditions/nouvelle?q=${AUTOUR[1].q}&r=${AUTOUR[1].r}&sejour=60`);
    expect(lien("Envoyer une Expédition")).toBeNull();
  });

  it("ouverte depuis la navigation, garde « Envoyer une Expédition »", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    cliquer(AUTOUR[1]);
    await act(async () => fiches[0].repondre(FORET));
    expect(lien("Envoyer une Expédition")!.getAttribute("href")).toBe(`/jeu/expeditions/nouvelle?q=${AUTOUR[1].q}&r=${AUTOUR[1].r}`);
    expect(lien("Choisir cette destination")).toBeNull();
  });
});

describe("griser ce qui est hors de portée en choisissant la destination (US-0908)", () => {
  /** Le voile qui grise les Cases au-delà de la portée d'exploration (dessin.test.ts : où, et comment). */
  const VOILE = "remplir color-mix(in oklch, var(--galet) 70%, transparent)";
  /** Les gestes d'un nouveau dessin de la carte, comme quand l'écran change de taille. */
  const redessinee = () => {
    toile.gestes = [];
    toile.departs = [];
    act(() => suivi!.annoncer());
    return toile.gestes;
  };
  /**
   * Le départ du contour de la portée, à `cases` Cases du Foyer : le tour de son dernier anneau commence par la Case au
   * sud-ouest du Foyer, à son sommet du bas à gauche (dessin.ts, tracerLaPortee).
   */
  const departDuContour = (cases: number) => {
    const { x, y } = aLEcran({ q: FOYER.q - cases, r: FOYER.r + cases }, ouverte());
    return `${(x - (Math.sqrt(3) / 2) * RAYON).toFixed(6)},${(y + RAYON / 2).toFixed(6)}`;
  };

  it("ouverte pour choisir la destination, grise d'un voile ce qui est au-delà de la portée, par-dessus les Cases, sous le repère du Foyer", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} destination="choix=destination" />);
    const gestes = redessinee();
    expect(gestes.filter((g) => g === VOILE)).toHaveLength(1);
    expect(gestes.indexOf(VOILE)).toBeGreaterThan(gestes.indexOf("remplir var(--galet)"));
    expect(gestes.slice(-3)).toEqual(["remplir var(--citron)", "border var(--encre)", "remplir var(--encre)"]);
    // Au-delà de la portée d'exploration de départ, et pas d'une autre.
    expect(departs()).toContain(departDuContour(PORTEE_D_EXPLORATION_CASES));
    expect(departs()).not.toContain(departDuContour(PORTEE_D_EXPLORATION_CASES - 1));
  });

  it("ouverte depuis la navigation, ne grise rien", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    expect(redessinee()).not.toContain(VOILE);
  });

  it("grise ou ne grise plus dès que le choix de la destination commence ou s'arrête, sans attendre que la carte bouge", () => {
    const { rerender } = render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    toile.gestes = [];
    rerender(<CarteDuJeu carte={CARTE} fonds={FONDS} destination="choix=destination" />);
    expect(toile.gestes).toContain(VOILE);
    toile.gestes = [];
    rerender(<CarteDuJeu carte={CARTE} fonds={FONDS} destination={null} />);
    expect(toile.gestes).toContain("remplir var(--galet)");
    expect(toile.gestes).not.toContain(VOILE);
  });
});

describe("fermer la fiche d'une Case (US-0430)", () => {
  it("la ferme en touchant la carte hors de ses Cases, et retire le surlignage", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    cliquer(AUTOUR[1]);
    toile.gestes = [];
    cliquer({ q: FOYER.q, r: FOYER.r - 3 });
    expect(fiche()).toBeNull();
    expect(surlignee()).toBe(false);
    expect(toile.gestes).not.toEqual([]);
  });

  it("la ferme par sa croix, ou par Échap, en retirant le surlignage, et rend la main à la carte", async () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    const user = userEvent.setup();
    cliquer(AUTOUR[1]);
    toile.gestes = [];
    await user.click(screen.getByRole("button", { name: "Fermer la fiche" }));
    expect(fiche()).toBeNull();
    expect(surlignee()).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("application", { name: "Carte du Monde" }));
    await user.keyboard("{Enter}");
    expect(fiche()).not.toBeNull();
    toile.gestes = [];
    await user.keyboard("{Escape}");
    expect(fiche()).toBeNull();
    expect(surlignee()).toBe(false);
  });

  it("remplace la fiche quand on touche une autre Case, au lieu d'en ouvrir une deuxième ; la même Case la garde", () => {
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    cliquer(AUTOUR[1]);
    cliquer(AUTOUR[1]);
    cliquer(AUTOUR[5]);
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([AUTOUR[1], AUTOUR[5]]);
    expect(screen.getAllByRole("region", { name: "Fiche de la Case" })).toHaveLength(1);
    expect(surlignee()).toBe(true);
  });

  it("rend sa place à la flèche du Foyer une fois fermée (US-0426)", () => {
    // La fiche le long du bord gauche de la carte ; rien d'autre n'a de place à l'écran.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return (this.tagName === "SECTION" ? { left: 12, top: 76, width: 300, height: 500, right: 312, bottom: 576 } : { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }) as DOMRect;
    });
    render(<CarteDuJeu carte={CARTE} fonds={FONDS} />);
    cliquer(AUTOUR[5]);
    // La fiche ouverte, le Foyer passé loin à gauche de l'écran : la flèche au bord gauche, à côté de la fiche.
    pointeur("pointerdown", 600, 300);
    pointeur("pointermove", 0, 300);
    pointeur("pointerup", 0, 300);
    prochaineImage();
    const vue = deplacer(ouverte(), -600, 0, 60);
    const enStyle = (ou: { x: number; y: number; angle: number } | null) => `translate(${ou!.x}px, ${ou!.y}px) rotate(${ou!.angle}rad)`;
    const fleche = document.querySelector<HTMLButtonElement>("button[aria-hidden]")!;
    expect(fleche.style.transform).toBe(enStyle(flecheVersLeFoyer(vue, FOYER, [{ gauche: 12, haut: 12, droite: 312, bas: 512 }], 22)));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(fiche()).toBeNull();
    expect(fleche.style.transform).toBe(enStyle(flecheVersLeFoyer(vue, FOYER, [], 22)));
  });
});

describe("voir une Case découverte sans recharger la page (US-0442)", () => {
  /** Le Foyer découvert, en prairie ; ses six voisines sous le brouillard. */
  const BRUMEUSE: CarteDuJoueur = { ...CARTE, teintes: ["prairie", BROUILLARD], cases: { ...CARTE.cases, teinte: AUTOUR.map((c) => (c.q === FOYER.q && c.r === FOYER.r ? 0 : 1)) } };
  const FONDS_BRUMEUSE = ["var(--biome-prairie)", "var(--sur-encre-pale)"];
  /** Ce que le serveur répond une fois la Case AUTOUR[2], un lac, découverte à côté : toutes les Cases découvertes. */
  const AVEC_LE_LAC = { cases: { q: [FOYER.q, AUTOUR[2].q], r: [FOYER.r, AUTOUR[2].r], teinte: ["prairie", "lac"], zone: [0, 0] }, foyers: [] };
  /** L'onglet caché ou visible, comme le navigateur le dit à la page. */
  const onglet = (visible: boolean) =>
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: visible ? "visible" : "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
  /** Le temps qui passe, en millisecondes, et ce que le serveur répond entre-temps. */
  const attendre = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

  beforeEach(() => void vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }));
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("demande au serveur toutes les 60 secondes les Cases découvertes au-delà de celles qu'elle connaît, et dessine aussitôt les nouvelles", async () => {
    render(<CarteDuJeu carte={BRUMEUSE} fonds={FONDS_BRUMEUSE} />);
    expect(toile.gestes).toContain("remplir var(--sur-encre-pale)");
    await attendre(59_000);
    expect(serveur.decouvertesDepuis).not.toHaveBeenCalled();
    serveur.decouvertesDepuis.mockResolvedValueOnce(AVEC_LE_LAC);
    toile.gestes = [];
    await attendre(1_000);
    expect(serveur.decouvertesDepuis).toHaveBeenCalledExactlyOnceWith(1);
    // Le lac, de sa couleur, dessiné aussitôt : sans geste du joueur, sans relire la page.
    expect(toile.gestes).toContain("remplir var(--sarcelle-fonce)");
    expect(toile.gestes).toContain("remplir var(--sur-encre-pale)");
    // Elle en connaît maintenant deux.
    await attendre(60_000);
    expect(serveur.decouvertesDepuis).toHaveBeenLastCalledWith(2);
  });

  it("compte les Cases découvertes et la part du Monde qu'elles font, et le compte monte à chaque découverte (US-0443)", async () => {
    render(<CarteDuJeu carte={BRUMEUSE} fonds={FONDS_BRUMEUSE} />);
    const compteur = () => document.querySelector("p[data-sur-la-carte]")!;
    expect(compteur().textContent).toBe("1 Case découverte · 14,3 % du Monde");
    expect(compteur().hasAttribute("data-sur-la-carte")).toBe(true);
    serveur.decouvertesDepuis.mockResolvedValueOnce(AVEC_LE_LAC);
    await attendre(60_000);
    expect(compteur().textContent).toBe("2 Cases découvertes · 28,6 % du Monde");
  });

  it("ne demande rien tant que l'onglet est caché, et demande dès qu'il redevient visible", async () => {
    render(<CarteDuJeu carte={BRUMEUSE} fonds={FONDS_BRUMEUSE} />);
    onglet(false);
    await attendre(180_000);
    expect(serveur.decouvertesDepuis).not.toHaveBeenCalled();
    onglet(true);
    expect(serveur.decouvertesDepuis).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("ne redessine rien quand rien n'est découvert, ne demande qu'une fois à la fois, et plus rien une fois la page quittée", async () => {
    const { unmount } = render(<CarteDuJeu carte={BRUMEUSE} fonds={FONDS_BRUMEUSE} />);
    const effacements = toile.effacements;
    await attendre(60_000);
    expect(serveur.decouvertesDepuis).toHaveBeenCalledTimes(1);
    expect(toile.effacements).toBe(effacements);
    // Une réponse qui tarde : l'onglet qui revient ne redemande pas en même temps.
    serveur.decouvertesDepuis.mockReturnValueOnce(new Promise(() => {}));
    await attendre(60_000);
    onglet(true);
    expect(serveur.decouvertesDepuis).toHaveBeenCalledTimes(2);
    unmount();
    await attendre(120_000);
    onglet(true);
    expect(serveur.decouvertesDepuis).toHaveBeenCalledTimes(2);
  });
});

describe("suivre une Expédition sur la carte (US-0913)", () => {
  const MINUTE_MS = 60_000;
  /** L'heure du jeu à l'affichage de la page : 9 h 42 à Paris, pas à la minute pile. */
  const MAINTENANT = new Date("2026-10-09T07:42:13.250Z");
  /** Une heure du jeu, `minutes` avant l'affichage. */
  const avant = (minutes: number) => new Date(MAINTENANT.getTime() - minutes * MINUTE_MS);
  /** Une carte de 5 Cases autour du Foyer. */
  const autour = casesDesAnneaux(0, 5).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
  const GRANDE: CarteDuJoueur = { ...CARTE, cases: { q: autour.map((c) => c.q), r: autour.map((c) => c.r), teinte: autour.map(() => 0), zone: autour.map(() => 0) } };
  /** Le chemin vers la prairie à 3 Cases à l'est du Foyer : une Case par pas, tout droit. */
  const EST = [1, 2, 3].map((n) => ({ q: FOYER.q + n, r: FOYER.r }));
  /** Une Expédition vers la prairie à l'est, partie à `partLe` : 1 h d'aller (20 min par Case), 4 h de séjour, 1 h de retour. */
  const vers = (id: number, partLe: Date, autre: Partial<ExpeditionEnCours> = {}): ExpeditionEnCours => ({
    id,
    destination: { ...EST[2], biome: "Prairie", chef: null, aVous: false, zone: 0, distance: 3, anneau: 2 },
    phase: "aller",
    partLe,
    trajetMinutes: 60,
    sejourMinutes: 240,
    explorateurs: ["Joran", "Ines"],
    escorte: [{ id: "souris", nom: "Souris grise", nombre: 2 }],
    ...autre,
  });
  /** Une autre, vers une Case inconnue à 2 Cases au nord-ouest, partie à `partLe`. */
  const NORD_OUEST = [1, 2].map((n) => ({ q: FOYER.q, r: FOYER.r - n }));
  const versLInconnue = (id: number, partLe: Date) => vers(id, partLe, { destination: { ...NORD_OUEST[1], inconnue: true, distance: 2 }, trajetMinutes: 40 });
  const carte = (expeditions: ExpeditionEnCours[], vitesse?: number) => (
    <CarteDuJeu carte={GRANDE} fonds={FONDS} expeditions={expeditions} maintenant={MAINTENANT} vitesse={vitesse} />
  );
  /** Le repère d'une Expédition, posé ou caché (un élément caché n'a pas de nom pour les lecteurs d'écran). */
  const repere = (nom = "Expédition vers Prairie, à 3 Cases de votre Foyer") => document.querySelector<HTMLButtonElement>(`button[aria-label="${nom}"]`)!;
  /** Le point à la part t du chemin de la Case a à la Case b, à l'écran tel que la vue `vue` le montre. */
  const entre = (a: { q: number; r: number }, b: { q: number; r: number }, t: number, vue = ouverte()) => {
    const [p, q] = [aLEcran(a, vue), aLEcran(b, vue)];
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  };
  const place = ({ x, y }: { x: number; y: number }) => `translate(${x}px, ${y}px)`;
  const ficheDeLExpedition = () => screen.queryByRole("region", { name: "Fiche de l'Expédition" });
  /** Un toucher du doigt sur la carte, au point (x, y) de la carte. */
  const toucher = ({ x, y }: { x: number; y: number }) => {
    pointeur("pointerdown", x, y + 64, { pointerType: "touch", pointerId: 3 });
    pointeur("pointerup", x, y + 64, { pointerType: "touch", pointerId: 3 });
  };
  /** Le temps du jeu qui passe dans le navigateur, en millisecondes. */
  const attendre = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

  afterEach(() => vi.useRealTimers());

  it("pose un repère sur le chemin de chaque Expédition, là où elle en est, et plante un fanion sur sa destination", () => {
    // La première, partie il y a 30 min : à mi-chemin entre ses deuxième et troisième Cases ; l'autre vient de partir.
    render(carte([vers(7, avant(30)), versLInconnue(8, MAINTENANT)]));
    expect(repere().hidden).toBe(false);
    expect(repere().style.transform).toBe(place(entre(EST[0], EST[1], 0.5)));
    expect(repere("Expédition vers une Case inconnue, à 2 Cases de votre Foyer").style.transform).toBe(place(aLEcran(FOYER, ouverte())));
    // Les fanions des destinations, sur la carte.
    expect(toile.gestes).toContain("remplir var(--ciel)");
  });

  it("fait avancer le repère au rythme du jeu, sans recharger la page ni redessiner la carte", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    render(carte([vers(7, avant(30))], 2));
    const effacements = toile.effacements;
    // 5 minutes à × 2 : 10 minutes du jeu ; la deuxième Case atteinte.
    await attendre(5 * MINUTE_MS);
    expect(repere().style.transform).toBe(place(aLEcran(EST[1], ouverte())));
    expect(toile.effacements).toBe(effacements);
  });

  it("suit la carte quand elle glisse, et se cache quand il sort de l'écran", () => {
    render(carte([vers(7, avant(30))]));
    const limite = limiteDeLaCarte(GRANDE);
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 300, 250);
    pointeur("pointerup", 300, 250);
    prochaineImage();
    const glissee = deplacer(ouverte(), -100, -50, limite);
    expect(repere().style.transform).toBe(place(entre(EST[0], EST[1], 0.5, glissee)));
    // Glissée de 600 pixels vers la gauche : le repère passe au-delà du bord gauche.
    pointeur("pointerdown", 700, 300);
    pointeur("pointermove", 100, 300);
    pointeur("pointerup", 100, 300);
    prochaineImage();
    expect(entre(EST[0], EST[1], 0.5, deplacer(glissee, -600, 0, limite)).x).toBeLessThan(0);
    expect(repere().hidden).toBe(true);
  });

  it("ouvert au toucher du repère, le détail de l'Expédition : sa phase, son temps restant, ses explorateurs et son escorte", () => {
    render(carte([vers(7, avant(30))]));
    const ici = entre(EST[0], EST[1], 0.5);
    toucher({ x: ici.x + 6, y: ici.y - 5 });
    const fiche = ficheDeLExpedition()!;
    expect(within(fiche).getByRole("heading", { name: "Expédition" })).toBeTruthy();
    const ligne = fiche.querySelector("[data-ligne]")!.textContent;
    for (const morceau of ["Prairie", "Aller", "arrive dans 30 min"]) expect(ligne).toContain(morceau);
    expect(within(fiche).getByText("Joran, Ines")).toBeTruthy();
    expect(within(fiche).getByText("Souris grise × 2")).toBeTruthy();
    expect(repere().getAttribute("aria-expanded")).toBe("true");
    // Le repère touché, et non la Case dessous : aucune fiche de Case demandée.
    expect(fiches).toEqual([]);
    expect(fiche.getAttribute("aria-live")).toBeNull();
  });

  it("fait avancer le temps restant du détail ouvert, à l'heure du jeu de la page", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    render(carte([vers(7, avant(30))]));
    // Le détail ouvert une minute après l'affichage : il compte depuis l'affichage, pas depuis son ouverture.
    await attendre(MINUTE_MS);
    fireEvent.click(repere());
    expect(ficheDeLExpedition()!.querySelector("[data-ligne]")!.textContent).toContain("arrive dans 29 min");
    await attendre(MINUTE_MS);
    expect(ficheDeLExpedition()!.querySelector("[data-ligne]")!.textContent).toContain("arrive dans 28 min");
  });

  it("se prend aussi au clavier : le repère est un bouton qui ouvre le même détail", async () => {
    render(carte([vers(7, avant(30))]));
    const user = userEvent.setup();
    repere().focus();
    expect(repere().getAttribute("aria-expanded")).toBe("false");
    await user.keyboard("{Enter}");
    expect(ficheDeLExpedition()).not.toBeNull();
  });

  it("ne garde qu'une fiche à la fois : une Case touchée remplace le détail de l'Expédition, et inversement", async () => {
    render(carte([vers(7, avant(30))]));
    const ici = entre(EST[0], EST[1], 0.5);
    toucher(ici);
    expect(ficheDeLExpedition()).not.toBeNull();
    // La Case à l'ouest du Foyer, loin du repère.
    cliquer({ q: FOYER.q - 1, r: FOYER.r });
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([{ q: FOYER.q - 1, r: FOYER.r }]);
    expect(ficheDeLExpedition()).toBeNull();
    expect(fiche()).not.toBeNull();
    expect(repere().getAttribute("aria-expanded")).toBe("false");
    toucher(ici);
    expect(ficheDeLExpedition()).not.toBeNull();
    expect(fiche()).toBeNull();
  });

  it("se ferme comme la fiche d'une Case : par sa croix, par Échap, ou en touchant la carte hors de ses Cases", async () => {
    render(carte([vers(7, avant(30))]));
    const user = userEvent.setup();
    const ici = entre(EST[0], EST[1], 0.5);
    toucher(ici);
    await user.click(screen.getByRole("button", { name: "Fermer la fiche" }));
    expect(ficheDeLExpedition()).toBeNull();
    toucher(ici);
    await user.keyboard("{Escape}");
    expect(ficheDeLExpedition()).toBeNull();
    toucher(ici);
    cliquer({ q: FOYER.q, r: FOYER.r - 9 });
    expect(ficheDeLExpedition()).toBeNull();
  });

  it("montre la main au survol du repère à la souris, sans rien changer d'autre à la carte", () => {
    const { container } = render(carte([vers(7, avant(30))]));
    const canvas = container.querySelector("canvas")!;
    const ici = entre(EST[0], EST[1], 0.5);
    pointeur("pointermove", ici.x + 3, ici.y + 64);
    expect(canvas.style.cursor).toBe("pointer");
    pointeur("pointermove", ici.x + 60, ici.y + 64);
    expect(canvas.style.cursor).toBe("");
  });

  it("ne pose aucun repère ni fanion sans Expédition en cours", () => {
    render(carte([]));
    expect(screen.queryAllByRole("button", { name: /^Expédition/ })).toEqual([]);
    expect(toile.gestes).not.toContain("remplir var(--ciel)");
  });

  it("touché encore, passe à l'Expédition posée au même point, puis à la Case qu'elles cachent, puis revient à la première", () => {
    // Deux Expéditions qui viennent de partir, toutes deux encore sur le Foyer.
    render(carte([vers(7, MAINTENANT), versLInconnue(8, MAINTENANT)]));
    const titre = () => ficheDeLExpedition()?.querySelector("[data-ligne] strong")?.textContent;
    const foyer = aLEcran(FOYER, ouverte());
    toucher(foyer);
    expect(titre()).toBe("Prairie");
    toucher(foyer);
    expect(titre()).toBe("Case inconnue");
    toucher(foyer);
    expect(ficheDeLExpedition()).toBeNull();
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([FOYER]);
    toucher(foyer);
    expect(titre()).toBe("Prairie");
  });

  it("choisit toujours la Case sous le doigt pendant le choix d'une destination, même sous un repère", () => {
    render(<CarteDuJeu carte={GRANDE} fonds={FONDS} destination="choix=destination" expeditions={[vers(7, avant(60 + 30))]} maintenant={MAINTENANT} />);
    // En séjour sur sa destination.
    toucher(aLEcran(EST[2], ouverte()));
    expect(ficheDeLExpedition()).toBeNull();
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([EST[2]]);
  });

  it("ne montre plus ni repère ni chemin d'une Expédition rentrée au Foyer, et efface le sien à son retour", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    // L'une rentrée depuis une minute ; l'autre rentre dans 30 secondes (1 h d'aller, 4 h de séjour, 1 h de retour).
    render(carte([vers(7, avant(60 + 240 + 60 + 1)), versLInconnue(8, new Date(avant(40 + 240 + 40).getTime() + 30_000))]));
    expect(document.querySelector('button[aria-label^="Expédition vers Prairie"]')).toBeNull();
    expect(repere("Expédition vers une Case inconnue, à 2 Cases de votre Foyer")).not.toBeNull();
    // Seule la hampe du fanion de la seconde part du centre de sa destination.
    const centre = (c: { q: number; r: number }) => `${aLEcran(c, ouverte()).x.toFixed(6)},${aLEcran(c, ouverte()).y.toFixed(6)}`;
    expect(departs().has(centre(NORD_OUEST[1]))).toBe(true);
    expect(departs().has(centre(EST[2]))).toBe(false);
    toile.gestes = [];
    await attendre(30_000);
    expect(screen.queryAllByRole("button", { name: /^Expédition/ })).toEqual([]);
    // Redessinée aussitôt, sans chemin ni fanion.
    expect(toile.gestes).toContain("remplir var(--galet)");
    expect(toile.gestes).not.toContain("remplir var(--ciel)");
  });

  it("ne garde aucun repère à toucher une fois les Expéditions parties de la page", () => {
    const { rerender } = render(carte([vers(7, avant(30))]));
    const ici = entre(EST[0], EST[1], 0.5);
    rerender(carte([]));
    toucher(ici);
    expect(ficheDeLExpedition()).toBeNull();
    expect(fiches).toHaveLength(1);
  });
});

describe("repérer la Bête restée sur la carte (US-0948)", () => {
  const MINUTE_MS = 60_000;
  /** L'heure du jeu à l'affichage de la page : 9 h 42 à Paris. */
  const MAINTENANT = new Date("2026-10-09T07:42:13.250Z");
  const apres = (minutes: number) => new Date(MAINTENANT.getTime() + minutes * MINUTE_MS);
  /** Une carte de 5 Cases autour du Foyer. */
  const autour = casesDesAnneaux(0, 5).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r }));
  const GRANDE: CarteDuJoueur = { ...CARTE, cases: { q: autour.map((c) => c.q), r: autour.map((c) => c.r), teinte: autour.map(() => 0), zone: autour.map(() => 0) } };
  /** La prairie à 3 Cases à l'est du Foyer, où un Renard roux est resté jusqu'à 13 h 42, et une Loutre à 2 Cases au nord-ouest. */
  const PRAIRIE = { q: FOYER.q + 3, r: FOYER.r };
  const RENARD: BeteReperee = { id: 41, laCase: PRAIRIE, especeId: "renard_roux", espece: "Renard roux", force: 37_340, jusquA: apres(4 * 60) };
  const LOUTRE: BeteReperee = { id: 42, laCase: { q: FOYER.q, r: FOYER.r - 2 }, especeId: "loutre_d_europe", espece: "Loutre d'Europe", force: 42_295, jusquA: apres(30) };
  /** Une Expédition en séjour sur la prairie depuis une demi-heure. */
  const ENSEJOUR: ExpeditionEnCours = {
    id: 7,
    destination: { ...PRAIRIE, biome: "Prairie", chef: null, aVous: false, zone: 0, distance: 3, anneau: 2 },
    phase: "sejour",
    partLe: apres(-90),
    trajetMinutes: 60,
    sejourMinutes: 240,
    explorateurs: ["Joran"],
    escorte: [],
  };
  const carte = (betes: BeteReperee[], { expeditions = [], vitesse }: { expeditions?: ExpeditionEnCours[]; vitesse?: number } = {}) => (
    <CarteDuJeu carte={GRANDE} fonds={FONDS} expeditions={expeditions} betes={betes} maintenant={MAINTENANT} vitesse={vitesse} />
  );
  /** Le repère d'une Bête, par ce qu'il dit aux lecteurs d'écran. */
  const repere = (nom = "Bête repérée : Renard roux, jusqu'à 14 h environ") => document.querySelector<HTMLButtonElement>(`button[aria-label="${nom}"]`);
  const place = ({ x, y }: { x: number; y: number }) => `translate(${x}px, ${y}px)`;
  const ficheDeLaBete = () => screen.queryByRole("region", { name: "Fiche de la Bête repérée" });
  const ficheDeLExpedition = () => screen.queryByRole("region", { name: "Fiche de l'Expédition" });
  /** Un toucher du doigt sur la carte, au point (x, y) de la carte. */
  const toucher = ({ x, y }: { x: number; y: number }) => {
    pointeur("pointerdown", x, y + 64, { pointerType: "touch", pointerId: 3 });
    pointeur("pointerup", x, y + 64, { pointerType: "touch", pointerId: 3 });
  };
  /** Le temps du jeu qui passe dans le navigateur, en millisecondes. */
  const attendre = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));

  afterEach(() => vi.useRealTimers());

  it("pose sur la Case de chaque Bête un repère « Bête repérée », avec son Espèce et jusqu'à quand elle devrait rester, à l'heure près", () => {
    render(carte([RENARD, LOUTRE]));
    expect(repere()!.hidden).toBe(false);
    expect(repere()!.style.transform).toBe(place(aLEcran(PRAIRIE, ouverte())));
    expect(repere("Bête repérée : Loutre d'Europe, jusqu'à 10 h environ")!.style.transform).toBe(place(aLEcran(LOUTRE.laCase, ouverte())));
    // Rien n'est dessiné de plus sur la carte : le repère est un bouton posé par-dessus.
    expect(toile.gestes).not.toContain("remplir var(--peche)");
  });

  it("suit la carte quand elle glisse, et se cache quand sa Case sort de l'écran", () => {
    render(carte([RENARD]));
    const limite = limiteDeLaCarte(GRANDE);
    pointeur("pointerdown", 400, 300);
    pointeur("pointermove", 300, 250);
    pointeur("pointerup", 300, 250);
    prochaineImage();
    const glissee = deplacer(ouverte(), -100, -50, limite);
    expect(repere()!.style.transform).toBe(place(aLEcran(PRAIRIE, glissee)));
    pointeur("pointerdown", 700, 300);
    pointeur("pointermove", 100, 300);
    pointeur("pointerup", 100, 300);
    prochaineImage();
    expect(aLEcran(PRAIRIE, deplacer(glissee, -600, 0, limite)).x).toBeLessThan(0);
    expect(repere()!.hidden).toBe(true);
  });

  it("ouvre au toucher sa fiche : « Bête repérée », son Espèce, et jusqu'à quand elle devrait rester", () => {
    render(carte([RENARD]));
    const ici = aLEcran(PRAIRIE, ouverte());
    toucher({ x: ici.x + 6, y: ici.y - 5 });
    const fiche = ficheDeLaBete()!;
    expect(within(fiche).getByRole("heading", { name: "Bête repérée" })).toBeTruthy();
    expect(within(fiche).getByText("Renard roux")).toBeTruthy();
    expect(within(fiche).getByText("Jusqu'à 14 h environ")).toBeTruthy();
    expect(repere()!.getAttribute("aria-expanded")).toBe("true");
    // Le repère touché, et non la Case dessous : aucune fiche de Case demandée.
    expect(fiches).toEqual([]);
  });

  it("se prend aussi au clavier, et se ferme comme la fiche d'une Case", async () => {
    render(carte([RENARD]));
    const user = userEvent.setup();
    repere()!.focus();
    await user.keyboard("{Enter}");
    expect(ficheDeLaBete()).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Fermer la fiche" }));
    expect(ficheDeLaBete()).toBeNull();
    toucher(aLEcran(PRAIRIE, ouverte()));
    await user.keyboard("{Escape}");
    expect(ficheDeLaBete()).toBeNull();
  });

  it("ne garde qu'une fiche à la fois : touché encore, passe à l'Expédition posée sur sa Case, puis à la Case, puis revient à lui", () => {
    render(carte([RENARD], { expeditions: [ENSEJOUR] }));
    const ici = aLEcran(PRAIRIE, ouverte());
    toucher(ici);
    expect(ficheDeLExpedition()).not.toBeNull();
    expect(ficheDeLaBete()).toBeNull();
    toucher(ici);
    expect(ficheDeLaBete()).not.toBeNull();
    expect(ficheDeLExpedition()).toBeNull();
    toucher(ici);
    expect(ficheDeLaBete()).toBeNull();
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([PRAIRIE]);
    toucher(ici);
    expect(fiche()).toBeNull();
    expect(ficheDeLExpedition()).not.toBeNull();
    // Une Case touchée ailleurs remplace sa fiche.
    toucher(ici);
    cliquer({ q: FOYER.q - 1, r: FOYER.r });
    expect(ficheDeLaBete()).toBeNull();
    expect(fiche()).not.toBeNull();
  });

  it("disparaît à la fin de sa durée, sans recharger la page ni redessiner la carte, et sa fiche avec lui", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "performance"] });
    // À × 2 : la Loutre part dans 15 minutes.
    render(carte([RENARD, LOUTRE], { vitesse: 2 }));
    fireEvent.click(repere("Bête repérée : Loutre d'Europe, jusqu'à 10 h environ")!);
    expect(ficheDeLaBete()).not.toBeNull();
    const effacements = toile.effacements;
    await attendre(15 * MINUTE_MS - 1000);
    expect(repere("Bête repérée : Loutre d'Europe, jusqu'à 10 h environ")).not.toBeNull();
    await attendre(1000);
    expect(repere("Bête repérée : Loutre d'Europe, jusqu'à 10 h environ")).toBeNull();
    expect(ficheDeLaBete()).toBeNull();
    expect(repere()).not.toBeNull();
    expect(toile.effacements).toBe(effacements);
    // Plus rien à toucher là où elle était : la Case dessous.
    toucher(aLEcran(LOUTRE.laCase, ouverte()));
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([LOUTRE.laCase]);
  });

  it("montre la main au survol de son repère à la souris", () => {
    const { container } = render(carte([RENARD]));
    const canvas = container.querySelector("canvas")!;
    const ici = aLEcran(PRAIRIE, ouverte());
    pointeur("pointermove", ici.x + 3, ici.y + 64);
    expect(canvas.style.cursor).toBe("pointer");
    pointeur("pointermove", ici.x + 60, ici.y + 64);
    expect(canvas.style.cursor).toBe("");
  });

  it("ne pose aucun repère sans Bête repérée, et choisit toujours la Case pendant le choix d'une destination", () => {
    const { rerender } = render(carte([]));
    expect(screen.queryAllByRole("button", { name: /^Bête repérée/ })).toEqual([]);
    rerender(<CarteDuJeu carte={GRANDE} fonds={FONDS} destination="choix=destination" betes={[RENARD]} maintenant={MAINTENANT} />);
    toucher(aLEcran(PRAIRIE, ouverte()));
    expect(ficheDeLaBete()).toBeNull();
    expect(fiches.map(({ q, r }) => ({ q, r }))).toEqual([PRAIRIE]);
  });
});
