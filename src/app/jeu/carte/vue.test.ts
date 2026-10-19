import { describe, expect, it } from "vitest";
import { anneau, casesDesAnneaux, type Coordonnees, SOMMETS_DE_CASE, tourDeLAnneau, voisines } from "@/monde/hex";
import { CARTE_DEBORD_CASES, CARTE_PAS_CLAVIER_CASES, CARTE_ZOOM_LARGE_CASES, CARTE_ZOOM_PROCHE_CASES, MONDE_RAYON } from "@/reglages";
import { aLEcran, vueSurLeFoyer, type Vue } from "./dessin";
import {
  avancer,
  borner,
  bornesDuZoom,
  cadrer,
  caseSous,
  deplacer,
  devoiler,
  enChemin,
  flecheVersLeFoyer,
  limiteDeLaCarte,
  rayonDuMonde,
  type Rectangle,
  retourAuFoyer,
  zoomer,
  zoomPossible,
} from "./vue";

const FOYER = { q: 31, r: -57 };
/** La carte d'un écran d'ordinateur ouverte sur le Foyer. */
const OUVERTE = vueSurLeFoyer(FOYER, 800, 600);
/** Des Cases en colonnes, comme la carte les reçoit du serveur. */
const carteDe = (cases: Coordonnees[]) => ({ teintes: ["prairie"], cases: { q: cases.map((c) => c.q), r: cases.map((c) => c.r), teinte: cases.map(() => 0), zone: cases.map(() => 0) }, foyer: FOYER, foyers: [] });
/** Une vue posée sur un point quelconque, en Cases non entières. */
const sur = (milieu: Coordonnees): Vue => ({ ...OUVERTE, milieu });

describe("glisser la carte (US-0420)", () => {
  it("la fait suivre le pointeur : chaque Case se déplace d'autant que lui, à l'écran", () => {
    const vue = deplacer(OUVERTE, 37, -12, 60);
    for (const c of [FOYER, { q: 32, r: -57 }, { q: 25, r: -50 }]) {
      const [avant, apres] = [aLEcran(c, OUVERTE), aLEcran(c, vue)];
      expect(apres.x - avant.x).toBeCloseTo(37, 9);
      expect(apres.y - avant.y).toBeCloseTo(-12, 9);
    }
    // Deux glissements de suite valent leur somme.
    const deux = deplacer(deplacer(OUVERTE, 20, 5, 60), 17, -17, 60);
    expect(aLEcran(FOYER, deux).x).toBeCloseTo(aLEcran(FOYER, vue).x, 9);
    expect(aLEcran(FOYER, deux).y).toBeCloseTo(aLEcran(FOYER, vue).y, 9);
  });

  it(`s'arrête quand le milieu de l'écran est à ${CARTE_DEBORD_CASES} Cases au-delà de la Case la plus éloignée du centre`, () => {
    expect(CARTE_DEBORD_CASES).toBe(2);
    expect(limiteDeLaCarte(carteDe(casesDesAnneaux(0, 60)))).toBe(62);
    // Sur Aube, qui n'a en base que sa Couronne, la Case la plus éloignée est encore sur le bord du Monde.
    expect(limiteDeLaCarte(carteDe(casesDesAnneaux(55, 60)))).toBe(62);
    expect(rayonDuMonde(carteDe(casesDesAnneaux(55, 60)))).toBe(60);
    // Le Foyer en compte aussi.
    expect(rayonDuMonde(carteDe([]))).toBe(anneau(FOYER));
    // Tirer la carte loin vers la gauche, c'est aller loin vers l'est : on s'arrête au coin est du Monde.
    const loin = deplacer(OUVERTE, -100_000, 0, 62);
    expect(loin.milieu.q).toBeCloseTo(62, 9);
    expect(loin.milieu.r).toBeCloseTo(0, 9);
    // Dans toutes les directions, le milieu de l'écran reste à la limite, jamais au-delà.
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 12) {
      const milieu = deplacer(OUVERTE, 100_000 * Math.cos(angle), 100_000 * Math.sin(angle), 62).milieu;
      expect(anneau(milieu)).toBeCloseTo(62, 9);
    }
  });

  it("ramène au plus près un milieu sorti des limites : le long du bord, la carte glisse encore", () => {
    // En deçà, rien ne change.
    expect(borner(sur({ q: 40, r: -10.5 }), 62).milieu).toEqual({ q: 40, r: -10.5 });
    // Au-delà du milieu d'un côté du Monde, droit sur le milieu de ce côté.
    const cote = borner(sur({ q: 124, r: -62 }), 62).milieu;
    expect(cote.q).toBeCloseTo(62, 9);
    expect(cote.r).toBeCloseTo(-31, 9);
    // Arrêté au bord, on glisse encore le long de lui vers l'est : seule la part qui sort est retenue.
    const longe = deplacer(sur({ q: 62, r: -31 }), -1000, 0, 62).milieu;
    expect(anneau(longe)).toBeCloseTo(62, 9);
    expect(longe.q).toBeCloseTo(62, 9);
    expect(longe.r).toBeGreaterThan(-31);
  });
});

describe("la carte au clavier (US-0422)", () => {
  it(`avance de ${CARTE_PAS_CLAVIER_CASES} Cases par flèche : de 3 colonnes vers l'est ou l'ouest, de 3 rangées vers le sud ou le nord`, () => {
    expect(CARTE_PAS_CLAVIER_CASES).toBe(3);
    const proche = (vue: Vue, c: Coordonnees) => {
      expect(vue.milieu.q).toBeCloseTo(c.q, 9);
      expect(vue.milieu.r).toBeCloseTo(c.r, 9);
    };
    proche(avancer(OUVERTE, 1, 0, 62), { q: 34, r: -57 });
    proche(avancer(OUVERTE, -1, 0, 62), { q: 28, r: -57 });
    // Trois rangées plus bas, droit sous le Foyer : une demi-Case à gauche par rangée, en coordonnées.
    proche(avancer(OUVERTE, 0, 1, 62), { q: 29.5, r: -54 });
    proche(avancer(OUVERTE, 0, -1, 62), { q: 32.5, r: -60 });
    // À l'écran, le Foyer s'en va d'autant de l'autre côté, quel que soit le zoom.
    for (const vue of [OUVERTE, { ...OUVERTE, rayon: 40 }]) {
      expect(aLEcran(FOYER, avancer(vue, 1, 0, 62)).x).toBeCloseTo(400 - 3 * Math.sqrt(3) * vue.rayon, 9);
      expect(aLEcran(FOYER, avancer(vue, 0, 1, 62)).y).toBeCloseTo(300 - 3 * 1.5 * vue.rayon, 9);
    }
  });

  it("garde les mêmes limites qu'à la souris", () => {
    let vue = OUVERTE;
    for (let i = 0; i < 40; i++) vue = avancer(vue, 0, -1, 62);
    expect(anneau(vue.milieu)).toBeCloseTo(62, 9);
    expect(vue.milieu.r).toBeCloseTo(-62, 9);
  });
});

describe("zoomer (US-0423)", () => {
  /** Combien de Cases couvre la moitié de la plus petite dimension de l'écran, à ce zoom. */
  const casesAuBord = (vue: Vue) => Math.min(vue.largeur, vue.hauteur) / 2 / (Math.sqrt(3) * vue.rayon);

  /** Les écrans essayés : d'ordinateur, de téléphone (la carte sous la barre du haut), en long et en large, très grand. */
  const ECRANS = [
    [800, 600],
    [375, 559],
    [390, 688],
    [688, 390],
    [1280, 900],
    [4000, 3000],
  ];

  it(`va de la vue où tient le Monde entier, téléphone compris, à une vue rapprochée de ${CARTE_ZOOM_PROCHE_CASES} Cases`, () => {
    expect([CARTE_ZOOM_LARGE_CASES, CARTE_ZOOM_PROCHE_CASES]).toEqual([40, 4]);
    for (const [largeur, hauteur] of ECRANS) {
      const vue = vueSurLeFoyer(FOYER, largeur, hauteur);
      const { min, max } = bornesDuZoom(largeur, hauteur);
      expect(casesAuBord(zoomer(vue, 1000, 10, 10, 62))).toBeCloseTo(4, 9);
      expect(casesAuBord({ ...vue, rayon: max })).toBeCloseTo(4, 9);
      // Au plus loin, le Monde entier à l'écran, au milieu : chaque sommet de chaque Case de son bord.
      const auPlusLoin = zoomer(vue, 0.001, 10, 10, 62);
      expect(auPlusLoin.rayon).toBeCloseTo(min, 9);
      expect(anneau(auPlusLoin.milieu)).toBeCloseTo(0, 9);
      for (const c of tourDeLAnneau(MONDE_RAYON)) {
        const { x, y } = aLEcran(c, auPlusLoin);
        for (const s of SOMMETS_DE_CASE) {
          expect(x + s.x * min).toBeGreaterThan(0);
          expect(x + s.x * min).toBeLessThan(largeur);
          expect(y + s.y * min).toBeGreaterThan(0);
          expect(y + s.y * min).toBeLessThan(hauteur);
        }
      }
      // Il remplit l'écran, en large ou en haut, à une Case près de chaque côté.
      const [large, haut] = [Math.sqrt(3) * (2 * MONDE_RAYON + 1) * min, (3 * MONDE_RAYON + 2) * min];
      expect(Math.max(large / largeur, haut / hauteur)).toBeGreaterThan(0.95);
      // Jamais moins loin que la vue large d'avant, de ${CARTE_ZOOM_LARGE_CASES} Cases au bord.
      expect(casesAuBord(auPlusLoin)).toBeGreaterThanOrEqual(CARTE_ZOOM_LARGE_CASES - 1e-9);
    }
  });

  it("au plus loin, tient le Monde entier sous la barre du haut posée sur la carte, au milieu de ce qui se voit", () => {
    for (const [largeur, hauteur, haut] of [
      [1280, 900, 64],
      [390, 844, 167],
      [800, 600, 120],
      // Un téléphone en paysage, sous sa barre de deux rangées, et plus court encore.
      [844, 390, 165],
      [844, 340, 165],
    ]) {
      const vue = cadrer(vueSurLeFoyer(FOYER, largeur, hauteur), largeur, hauteur, haut);
      expect(vue.haut).toBe(haut);
      const auPlusLoin = zoomer(vue, 0.001, 10, 10, 62);
      expect(auPlusLoin.rayon).toBeCloseTo(bornesDuZoom(largeur, hauteur, haut).min, 9);
      expect(zoomPossible(auPlusLoin).eloigner).toBe(false);
      const ys = tourDeLAnneau(MONDE_RAYON).map((c) => aLEcran(c, auPlusLoin).y);
      const [enHaut, enBas] = [Math.min(...ys) - auPlusLoin.rayon, Math.max(...ys) + auPlusLoin.rayon];
      expect(enHaut).toBeGreaterThan(haut);
      expect(enBas).toBeLessThan(hauteur);
      // Autant de place au-dessus qu'au-dessous, et le Monde qui la remplit, à une Case près de chaque côté.
      expect(enHaut - haut).toBeCloseTo(hauteur - enBas, 6);
      expect(Math.max((enBas - enHaut) / (hauteur - haut), (Math.sqrt(3) * (2 * MONDE_RAYON + 1) * auPlusLoin.rayon) / largeur)).toBeGreaterThan(0.95);
      // Le zoom ne s'effondre pas sur un écran court : jamais moins que la moitié de la vue sans barre.
      expect(auPlusLoin.rayon).toBeGreaterThan(bornesDuZoom(largeur, hauteur).min / 2);
      // La barre reste connue de la vue d'un geste à l'autre, au retour sur le Foyer comme quand l'écran change de taille.
      expect(retourAuFoyer(auPlusLoin, FOYER).haut).toBe(haut);
      expect(cadrer(auPlusLoin, hauteur, largeur).haut).toBe(haut);
    }
  });

  it("au plus loin, ramène le milieu au centre du Monde, d'autant plus près qu'elle s'éloigne au-delà de la vue large d'avant", () => {
    for (const [largeur, hauteur] of ECRANS) {
      const vue = vueSurLeFoyer(FOYER, largeur, hauteur);
      const { min } = bornesDuZoom(largeur, hauteur);
      const large = Math.min(largeur, hauteur) / 2 / CARTE_ZOOM_LARGE_CASES / Math.sqrt(3);
      // Jusqu'à la vue large d'avant, la limite d'avant : le Foyer au milieu, au bord du Monde même.
      expect(borner({ ...vue, rayon: large }, 62).milieu).toEqual(FOYER);
      expect(anneau(borner({ ...vue, milieu: { q: 62, r: -31 }, rayon: large }, 62).milieu)).toBeCloseTo(62, 9);
      // Au-delà, une limite qui se resserre…
      const entre = (min + large) / 2;
      expect(anneau(borner({ ...vue, milieu: { q: 62, r: -31 }, rayon: entre }, 62).milieu)).toBeCloseTo(31, 9);
      // … jusqu'au centre du Monde au plus loin, d'où glisser ne la fait plus bouger.
      expect(borner({ ...vue, rayon: min }, 62).milieu).toEqual({ q: 0, r: 0 });
      expect(deplacer({ ...vue, milieu: { q: 0, r: 0 }, rayon: min }, 200, -150, 62).milieu).toEqual({ q: 0, r: 0 });
    }
  });

  it("zoome autour du point visé : ce qui était sous le pointeur y reste, jusqu'aux limites du zoom", () => {
    const auMilieu = sur({ q: 2, r: -1 });
    const c = { q: -4, r: 4 };
    const { x, y } = aLEcran(c, auMilieu);
    const large = 600 / 2 / CARTE_ZOOM_LARGE_CASES / Math.sqrt(3);
    for (const facteur of [1.7, 0.6, 1000, large / auMilieu.rayon]) {
      const vue = zoomer(auMilieu, facteur, x, y, 62);
      expect(aLEcran(c, vue).x).toBeCloseTo(x, 9);
      expect(aLEcran(c, vue).y).toBeCloseTo(y, 9);
    }
    // Au plus loin, le Monde entier à l'écran, son centre au milieu.
    expect(zoomer(auMilieu, 0.001, x, y, 62).milieu).toEqual({ q: 0, r: 0 });
    // Dans ses limites, le zoom est celui demandé.
    expect(zoomer(auMilieu, 1.7, x, y, 62).rayon).toBeCloseTo(1.7 * auMilieu.rayon, 9);
  });

  it("garde le milieu de l'écran dans les limites de la carte", () => {
    // Dézoomer au bord du Monde, le pointeur loin du milieu, ne fait pas sortir le milieu.
    const auBord = sur({ q: 62, r: -31 });
    expect(anneau(zoomer(auBord, 0.5, 0, 0, 62).milieu)).toBeLessThanOrEqual(62 + 1e-9);
  });

  it("garde le même endroit au milieu quand l'écran change de taille, le zoom ramené dans ses nouvelles limites", () => {
    const proche = zoomer(OUVERTE, 1000, 400, 300, 62);
    const tourne = cadrer(proche, 300, 200);
    expect(tourne.milieu).toEqual(proche.milieu);
    expect([tourne.largeur, tourne.hauteur]).toEqual([300, 200]);
    expect(tourne.rayon).toBeCloseTo(bornesDuZoom(300, 200).max, 9);
    // À l'ouverture sur un très grand écran, les Cases grossissent jusqu'au plus loin, où le Monde entier tient.
    expect(cadrer(vueSurLeFoyer(FOYER, 4000, 3000), 4000, 3000).rayon).toBeCloseTo(bornesDuZoom(4000, 3000).min, 9);
    // Une carte encore sans place à l'écran garde son zoom.
    expect(cadrer(OUVERTE, 0, 0).rayon).toBe(OUVERTE.rayon);
  });
});

describe("les bornes du zoom atteintes (US-0425)", () => {
  it("dit si l'on peut encore rapprocher ou éloigner la carte", () => {
    expect(zoomPossible(OUVERTE)).toEqual({ rapprocher: true, eloigner: true });
    expect(zoomPossible(zoomer(OUVERTE, 1000, 400, 300, 62))).toEqual({ rapprocher: false, eloigner: true });
    expect(zoomPossible(zoomer(OUVERTE, 0.001, 400, 300, 62))).toEqual({ rapprocher: true, eloigner: false });
    // Un cran de trop arrive juste à la borne, sans la dépasser : c'est la borne.
    let vue = OUVERTE;
    for (let i = 0; i < 20; i++) vue = zoomer(vue, 1.5, 400, 300, 62);
    expect(zoomPossible(vue).rapprocher).toBe(false);
    // Une carte sans place à l'écran ne zoome pas.
    expect(zoomPossible(cadrer(OUVERTE, 0, 0))).toEqual({ rapprocher: false, eloigner: false });
  });
});

describe("revenir au Foyer (US-0426)", () => {
  /** Une vue loin du Foyer, rapprochée. */
  const LOIN = zoomer(deplacer(OUVERTE, -3000, 1200, 62), 3, 100, 100, 62);

  it("ramène la carte sur le Foyer, au zoom par défaut, celui de l'ouverture", () => {
    expect(retourAuFoyer(LOIN, FOYER)).toEqual(OUVERTE);
    // Sur un très grand écran, le zoom par défaut est ramené dans ses bornes, comme à l'ouverture.
    expect(retourAuFoyer({ ...LOIN, largeur: 4000, hauteur: 3000 }, FOYER)).toEqual(cadrer(vueSurLeFoyer(FOYER, 4000, 3000), 4000, 3000));
  });

  it("y va par un court mouvement en douceur : lentement au départ et à l'arrivée, vite entre les deux", () => {
    const arrivee = retourAuFoyer(LOIN, FOYER);
    expect(enChemin(LOIN, arrivee, 0)).toEqual(LOIN);
    expect(enChemin(LOIN, arrivee, 1)).toEqual(arrivee);
    // À mi-chemin, le milieu de l'écran est à mi-chemin, et le zoom aussi : autant de crans faits que de crans à faire.
    const moitie = enChemin(LOIN, arrivee, 0.5);
    expect(moitie.milieu.q).toBeCloseTo((LOIN.milieu.q + FOYER.q) / 2, 9);
    expect(moitie.milieu.r).toBeCloseTo((LOIN.milieu.r + FOYER.r) / 2, 9);
    expect(moitie.rayon).toBeCloseTo(Math.sqrt(LOIN.rayon * arrivee.rayon), 9);
    /** La part du chemin faite à l'instant t, de 0 à 1. */
    const fait = (t: number) => (enChemin(LOIN, arrivee, t).milieu.q - LOIN.milieu.q) / (FOYER.q - LOIN.milieu.q);
    expect(fait(0.1)).toBeLessThan(0.05);
    expect(fait(0.9)).toBeGreaterThan(0.95);
    for (let t = 0; t < 0.99; t += 0.05) expect(fait(t + 0.05)).toBeGreaterThan(fait(t));
  });
});

describe("la flèche du Foyer hors de l'écran (US-0426)", () => {
  /** La place autour du centre de la flèche, qui la garde du bord de la carte et de ce qui est posé dessus. */
  const MARGE = 22;
  /** La vue dont le Foyer tombe à l'écran en (x, y). */
  const foyerEn = (x: number, y: number) => deplacer(OUVERTE, x - 400, y - 300, 1000);
  /** Si (x, y) touche le rectangle `o` élargi de `m` pixels. */
  const touche = (x: number, y: number, o: Rectangle, m: number) => x > o.gauche - m && x < o.droite + m && y > o.haut - m && y < o.bas + m;
  /** Si la flèche est sur la droite qui va du milieu de l'écran au Foyer, de son côté, et tournée vers lui. */
  const surLaDroite = (vue: Vue, fleche: { x: number; y: number; angle: number } | null) => {
    const foyer = aLEcran(FOYER, vue);
    const [dx, dy] = [foyer.x - 400, foyer.y - 300];
    expect(fleche).not.toBeNull();
    expect(((fleche!.x - 400) * dy - (fleche!.y - 300) * dx) / Math.hypot(dx, dy)).toBeCloseTo(0, 6);
    expect((fleche!.x - 400) * dx + (fleche!.y - 300) * dy).toBeGreaterThan(0);
    expect(fleche!.angle).toBeCloseTo(Math.atan2(dy, dx), 9);
  };

  it("n'apparaît pas tant que le Foyer est à l'écran, même tout près du bord", () => {
    expect(flecheVersLeFoyer(OUVERTE, FOYER, [], MARGE)).toBeNull();
    for (const [x, y] of [
      [799, 300],
      [1, 599],
      [400, 2],
    ])
      expect(flecheVersLeFoyer(foyerEn(x, y), FOYER, [], MARGE)).toBeNull();
  });

  it("se pose au bord de la carte, sur la droite qui va du milieu de l'écran au Foyer, tournée vers lui", () => {
    // Le Foyer loin à l'ouest, sur la rangée du milieu : la flèche au bord gauche, à mi-hauteur, tournée vers la gauche.
    const ouest = flecheVersLeFoyer(foyerEn(-600, 300), FOYER, [], MARGE)!;
    expect(ouest.x).toBeCloseTo(MARGE, 9);
    expect(ouest.y).toBeCloseTo(300, 9);
    expect(Math.abs(ouest.angle)).toBeCloseTo(Math.PI, 9);
    // Loin au nord : au bord du haut, tournée vers le haut.
    const nord = flecheVersLeFoyer(foyerEn(400, -700), FOYER, [], MARGE)!;
    expect(nord.x).toBeCloseTo(400, 9);
    expect(nord.y).toBeCloseTo(MARGE, 9);
    expect(nord.angle).toBeCloseTo(-Math.PI / 2, 9);
    // Dans toutes les directions, au bord de la carte, à sa marge, sur la droite vers le Foyer.
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 20) {
      const vue = foyerEn(400 + 3000 * Math.cos(angle), 300 + 3000 * Math.sin(angle));
      const fleche = flecheVersLeFoyer(vue, FOYER, [], MARGE);
      surLaDroite(vue, fleche);
      const aLaMarge = Math.min(fleche!.x - MARGE, 800 - MARGE - fleche!.x, fleche!.y - MARGE, 600 - MARGE - fleche!.y);
      expect(aLaMarge).toBeCloseTo(0, 6);
    }
  });

  it("ne passe jamais sous ce qui est posé sur la carte : elle s'arrête avant, au plus loin sur la même droite", () => {
    const boutons = { gauche: 744, haut: 392, droite: 788, bas: 588 };
    const legende = { gauche: 468, haut: 12, droite: 788, bas: 360 };
    const panneauDuBas = { gauche: 0, haut: 480, droite: 800, bas: 600 };
    const obstacles = [boutons, legende, panneauDuBas];
    // Le Foyer loin à l'est, sur la rangée du milieu : la flèche s'arrête devant le panneau de la légende.
    const est = flecheVersLeFoyer(foyerEn(4000, 300), FOYER, [legende], MARGE)!;
    expect(est.x).toBeCloseTo(legende.gauche - MARGE, 9);
    expect(est.y).toBeCloseTo(300, 9);
    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 20) {
      const vue = foyerEn(400 + 3000 * Math.cos(angle), 300 + 3000 * Math.sin(angle));
      const fleche = flecheVersLeFoyer(vue, FOYER, obstacles, MARGE)!;
      surLaDroite(vue, fleche);
      // Toute sa place hors des obstacles…
      for (const o of obstacles) expect(touche(fleche.x, fleche.y, o, MARGE - 1e-6), JSON.stringify(o)).toBe(false);
      // … et pourtant au plus loin : un pixel plus loin vers le Foyer, elle toucherait un obstacle ou sortirait de la carte.
      const [x, y] = [fleche.x + Math.cos(fleche.angle), fleche.y + Math.sin(fleche.angle)];
      const dehors = x < MARGE || x > 800 - MARGE || y < MARGE || y > 600 - MARGE;
      expect(dehors || obstacles.some((o) => touche(x, y, o, MARGE))).toBe(true);
    }
  });

  it("montre aussi le Foyer caché sous un panneau, depuis le bord de ce panneau", () => {
    const panneauDuBas = { gauche: 0, haut: 450, droite: 800, bas: 600 };
    const fleche = flecheVersLeFoyer(foyerEn(400, 550), FOYER, [panneauDuBas], MARGE)!;
    expect(fleche.x).toBeCloseTo(400, 9);
    expect(fleche.y).toBeCloseTo(450 - MARGE, 9);
    expect(fleche.angle).toBeCloseTo(Math.PI / 2, 9);
    // Au-dessus du panneau, le Foyer se voit : pas de flèche.
    expect(flecheVersLeFoyer(foyerEn(400, 440), FOYER, [panneauDuBas], MARGE)).toBeNull();
  });

  it("n'a pas de place sur une carte trop petite pour elle", () => {
    expect(flecheVersLeFoyer(cadrer(foyerEn(-600, 300), 40, 40), FOYER, [], MARGE)).toBeNull();
  });
});

describe("la Case sous un point de la carte (US-0428)", () => {
  /** Le Foyer, ses voisines et leurs voisines. */
  const CARTE = carteDe(casesDesAnneaux(0, 2).map((c) => ({ q: c.q + FOYER.q, r: c.r + FOYER.r })));
  /** Le point de l'écran à la fraction `t` du chemin du point a au point b. */
  const entre = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });

  it("trouve la Case dont l'hexagone contient le point, jusqu'à son bord, quels que soient le glissement et le zoom", () => {
    for (const vue of [OUVERTE, deplacer(zoomer(OUVERTE, 2.3, 120, 80, 62), 33, -71, 62)]) {
      const ici = aLEcran(FOYER, vue);
      expect(caseSous(CARTE, vue, ici.x, ici.y)).toEqual(FOYER);
      // Tout près de chacun de ses sommets, c'est encore le Foyer.
      for (const s of SOMMETS_DE_CASE) {
        const p = entre(ici, { x: ici.x + s.x * vue.rayon, y: ici.y + s.y * vue.rayon }, 0.95);
        expect(caseSous(CARTE, vue, p.x, p.y)).toEqual(FOYER);
      }
      // De part et d'autre du côté partagé avec chaque voisine, qui passe à mi-chemin des deux centres.
      for (const v of voisines(FOYER)) {
        const [avant, apres] = [entre(ici, aLEcran(v, vue), 0.45), entre(ici, aLEcran(v, vue), 0.55)];
        expect(caseSous(CARTE, vue, avant.x, avant.y)).toEqual(FOYER);
        expect(caseSous(CARTE, vue, apres.x, apres.y)).toEqual(v);
      }
    }
  });

  it("ne trouve rien hors des Cases de la carte : au-delà du bord du Monde", () => {
    const loin = aLEcran({ q: FOYER.q, r: FOYER.r - 3 }, OUVERTE);
    expect(caseSous(CARTE, OUVERTE, loin.x, loin.y)).toBeNull();
    expect(caseSous(CARTE, OUVERTE, -5000, 300)).toBeNull();
  });
});

describe("montrer la Case choisie hors de sa fiche (US-0428)", () => {
  /** Toutes les Cases d'un Monde de 60 Cases de rayon, et la carte d'un ordinateur ouverte en son milieu. */
  const MONDE = carteDe(casesDesAnneaux(0, 60));
  const AU_MILIEU = sur({ q: 0, r: 0 });
  /** La place que prend l'hexagone d'une Case à l'écran, dans la vue. */
  const boite = (c: Coordonnees, vue: Vue) => {
    const { x, y } = aLEcran(c, vue);
    const [l, h] = [(Math.sqrt(3) / 2) * vue.rayon, vue.rayon];
    return { gauche: x - l, droite: x + l, haut: y - h, bas: y + h };
  };
  /** Si l'hexagone de la Case, dans la vue, touche le cadre. */
  const sous = (c: Coordonnees, vue: Vue, cadre: { x: number; y: number; largeur: number; hauteur: number }) => {
    const b = boite(c, vue);
    return b.droite > cadre.x && b.gauche < cadre.x + cadre.largeur && b.bas > cadre.y && b.haut < cadre.y + cadre.hauteur;
  };
  /** Si l'hexagone de la Case est tout entier à l'écran. */
  const entiere = (c: Coordonnees, vue: Vue) => {
    const b = boite(c, vue);
    return b.gauche >= 0 && b.droite <= vue.largeur && b.haut >= 0 && b.bas <= vue.hauteur;
  };
  /** La fiche sur ordinateur, en haut à gauche de la carte. */
  const FICHE = { x: 12, y: 12, largeur: 300, hauteur: 180 };

  it("laisse la carte telle quelle quand la fiche ne cache pas la Case", () => {
    expect(devoiler(AU_MILIEU, { q: 0, r: 0 }, FICHE, 62)).toBe(AU_MILIEU);
  });

  it("fait glisser la carte juste assez pour que la Case sorte de sous la fiche, du côté le plus proche", () => {
    // Une Case sous le coin en bas à droite de la fiche : la sortir par le bas demande le moins.
    const basse = caseSous(MONDE, AU_MILIEU, 280, 180)!;
    const montree = devoiler(AU_MILIEU, basse, FICHE, 62);
    expect(sous(basse, AU_MILIEU, FICHE)).toBe(true);
    expect(sous(basse, montree, FICHE)).toBe(false);
    expect(entiere(basse, montree)).toBe(true);
    expect(aLEcran(basse, montree).x).toBeCloseTo(aLEcran(basse, AU_MILIEU).x, 9);
    expect(boite(basse, montree).haut).toBeCloseTo(FICHE.y + FICHE.hauteur + 12, 9);
    // Une Case sous son bord droit, en haut : on la sort par la droite.
    const haute = caseSous(MONDE, AU_MILIEU, 300, 40)!;
    const aDroite = devoiler(AU_MILIEU, haute, FICHE, 62);
    expect(sous(haute, aDroite, FICHE)).toBe(false);
    expect(aLEcran(haute, aDroite).y).toBeCloseTo(aLEcran(haute, AU_MILIEU).y, 9);
    expect(boite(haute, aDroite).gauche).toBeCloseTo(FICHE.x + FICHE.largeur + 12, 9);
  });

  it("garde la Case à l'écran : elle ne sort pas du côté où l'écran s'arrête", () => {
    // Une Case contre le bord gauche, sous la fiche : la sortir par la gauche la mettrait hors de l'écran.
    const contre = caseSous(MONDE, AU_MILIEU, 14, 30)!;
    const montree = devoiler(AU_MILIEU, contre, FICHE, 62);
    expect(sous(contre, montree, FICHE)).toBe(false);
    expect(entiere(contre, montree)).toBe(true);
    // Une fiche qui couvre toute la carte : rien à faire.
    expect(devoiler(AU_MILIEU, { q: 0, r: 0 }, { x: 0, y: 0, largeur: 800, hauteur: 600 }, 62)).toBe(AU_MILIEU);
  });

  it("au plus loin, glisse encore la carte pour dévoiler la Case, dans les limites d'avant ; glissée, elle peut revenir, pas s'éloigner davantage (retour d'Antoine, 2026-10-15)", () => {
    // Le Monde entier à l'écran, la fiche sur sa pointe ouest.
    const auPlusLoin = zoomer(vueSurLeFoyer(FOYER, 1280, 900), 0.001, 640, 450, 62);
    expect(auPlusLoin.milieu).toEqual({ q: 0, r: 0 });
    const ouest = { q: -MONDE_RAYON, r: 0 };
    const fiche = { x: 12, y: 300, largeur: 330, hauteur: 300 };
    expect(sous(ouest, auPlusLoin, fiche)).toBe(true);
    const montree = devoiler(auPlusLoin, ouest, fiche, 62);
    expect(sous(ouest, montree, fiche)).toBe(false);
    expect(entiere(ouest, montree)).toBe(true);
    expect(montree.rayon).toBe(auPlusLoin.rayon);
    // Glisser plus loin dans le même sens ne l'éloigne pas davantage du centre ; dans l'autre sens, elle y revient.
    const [dx, dy] = [aLEcran(ouest, montree).x - aLEcran(ouest, auPlusLoin).x, aLEcran(ouest, montree).y - aLEcran(ouest, auPlusLoin).y];
    expect(anneau(montree.milieu)).toBeGreaterThan(1);
    expect(anneau(deplacer(montree, dx, dy, 62).milieu)).toBeCloseTo(anneau(montree.milieu), 9);
    const revenue = deplacer(montree, -dx, -dy, 62).milieu;
    expect(anneau(revenue)).toBeCloseTo(0, 9);
    // Éloignée encore, elle recentre le Monde entier.
    expect(zoomer(montree, 0.5, 640, 450, 62).milieu).toEqual({ q: 0, r: 0 });
  });

  it("sur mobile, sous la fiche en bas de l'écran, fait remonter la carte juste assez (US-0431)", () => {
    // Un téléphone de 390 pixels de large, la carte de 600 de haut, la fiche sur ses 250 pixels du bas.
    const telephone = { ...AU_MILIEU, largeur: 390, hauteur: 600 };
    const enBas = { x: 0, y: 350, largeur: 390, hauteur: 250 };
    const basse = caseSous(MONDE, telephone, 200, 500)!;
    const montree = devoiler(telephone, basse, enBas, 62);
    expect(sous(basse, montree, enBas)).toBe(false);
    expect(aLEcran(basse, montree).x).toBeCloseTo(aLEcran(basse, telephone).x, 9);
    expect(boite(basse, montree).bas).toBeCloseTo(enBas.y - 12, 9);
    // Au-dessus d'elle, rien ne bouge.
    expect(devoiler(telephone, caseSous(MONDE, telephone, 200, 200)!, enBas, 62)).toBe(telephone);
  });
});
