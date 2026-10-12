"use client";

import { getImageProps } from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BeteReperee } from "@/expeditions/betes-reperees";
import { cheminDUneExpedition } from "@/expeditions/chemin";
import type { ExpeditionEnCours } from "@/expeditions/en-cours";
import type { CarteDuJoueur } from "@/monde/carte";
import { couleur } from "@/monde/couleurs-de-la-carte";
import type { Coordonnees } from "@/monde/hex";
import { PORTEE_D_EXPLORATION_CASES } from "@/reglages";
import { BetesRepereesSurLaCarte, placerLesBetes, type RepereDeBete } from "./BetesRepereesSurLaCarte";
import { BoutonsDeLaCarte } from "./BoutonsDeLaCarte";
import { CasesDecouvertes } from "./CasesDecouvertes";
import { nombreDeDecouvertes, useDecouvertes } from "./decouvertes";
import { type Cadre, dessinerLaCarte, vueSurLeFoyer, type Hutte, type Vue } from "./dessin";
import { ExpeditionsSurLaCarte, placerLesReperes, type Repere, reperesSous, repereTouche } from "./ExpeditionsSurLaCarte";
import { FicheDeLaCase, useFicheDeLaCase } from "./FicheDeLaCase";
import { FlecheDuFoyer, placerLaFleche } from "./FlecheDuFoyer";
import { suivreLesGestes } from "./gestes";
import { LEGENDE_MONTREE } from "./Legende";
import { glisser } from "./mouvement";
import styles from "./page.module.css";
import { avancer, cadrer, caseSous, deplacer, devoiler, limiteDeLaCarte, retourAuFoyer, zoomer, zoomPossible } from "./vue";
import { retenirLaVue, vueRetenue } from "./vue-retenue";

/**
 * US-0419 : l'illustration de la hutte du chef, celle de l'écran du Foyer (tous les Foyers naissent en prairie),
 * servie par Next en petit : assez pour une Case nette sur un écran haute densité.
 */
const HUTTE = getImageProps({ src: "/illustrations/foyer/prairie.webp", alt: "", width: 192, height: 128 }).props.src;

/** US-0913 : une carte sans Expédition en cours. */
const AUCUNE_EXPEDITION: ExpeditionEnCours[] = [];
/** US-0948 : une carte sans Bête repérée. */
const AUCUNE_BETE: BeteReperee[] = [];

/** La couleur que donne une expression CSS sur la page (« var(--trait) »), telle que le <canvas> la comprend. */
function couleurCalculee(element: HTMLElement, expression: string): string {
  element.style.color = expression;
  const couleur = getComputedStyle(element).color;
  element.style.removeProperty("color");
  return couleur;
}

/**
 * US-0417 : la carte du Monde, dessinée sur un <canvas> (10 981 hexagones en SVG pèseraient trop sur une page de
 * jeu), dans toute la place que la page lui donne et nette sur les écrans haute densité. Elle s'ouvre le Foyer au
 * milieu. US-0418 : chaque teinte de la carte peinte de la couleur CSS que la page lui donne (`fonds`, dans l'ordre
 * de ses teintes), ses motifs d'Encre ou d'Ivoire légers, et un bord d'Encre à peine marqué entre les Cases.
 * US-0419 : son Foyer marqué d'un repère citron dès l'ouverture, la hutte du chef posée dessus une fois
 * l'illustration chargée ; les Foyers des autres chefs en Encre. US-0420 : on la fait glisser (gestes.ts), dans les
 * limites de la vue (vue.ts) ; chaque geste change la vue aussitôt, mais la carte n'est redessinée qu'au rythme de
 * l'écran. Quand l'écran change de taille (téléphone tourné, fenêtre élargie), elle garde le même endroit au milieu.
 * US-0421 : de même au doigt. US-0422 : sélectionnée au clavier, elle avance aux flèches. US-0423 : elle zoome à
 * la molette ou au pavé tactile, autour du pointeur, entre la vue large et la vue rapprochée. US-0424 : de même en
 * pinçant à deux doigts, autour du point entre eux. US-0425 : et aux boutons « + » et « − », autour du milieu de
 * l'écran, chacun grisé quand sa limite est atteinte, quel que soit le geste qui l'a atteinte. US-0426 : le bouton du
 * Foyer, ou la flèche qui le montre quand il est hors de l'écran, y ramène la carte en glissant ; un geste l'arrête.
 * US-0427 : pendant la visite, elle se rouvre là où on l'a laissée, au même zoom (vue-retenue.ts). US-0428 : toucher
 * une Case (ou Entrée) ouvre sa fiche (FicheDeLaCase), la Case surlignée ; la carte glisse pour que la fiche ne la
 * cache pas, et la flèche du Foyer la contourne. US-0430 : toucher la carte hors de ses Cases la ferme, et le
 * surlignage s'en va avec elle. US-0442 : une Case découverte pendant qu'elle est ouverte y apparaît sans recharger
 * la page (useDecouvertes). US-0443 : en bas à gauche, combien le joueur en a découvert, et quelle part du Monde.
 * US-0907 : ouverte pour choisir la destination d'une Expédition (`destination`, son adresse), elle le dit à la fiche.
 * US-0908 : elle grise alors ce qui est au-delà de la portée d'exploration (PORTEE_D_EXPLORATION_CASES).
 * US-0913 : les Expéditions en cours du joueur (`expeditions`, lues par la page à l'heure du jeu `maintenant`, qui avance
 * au rythme `vitesse`) : le chemin de chacune et le fanion de sa destination dessinés sur la carte ; son repère, posé à
 * chaque dessin là où elle en est sur son chemin (ExpeditionsSurLaCarte). Le toucher d'un repère, à moins de 22 px de son
 * centre, ouvre la fiche de son Expédition à la place de celle d'une Case : une seule fiche à la fois ; touché encore, il
 * passe à l'Expédition posée au même point, puis à la Case dessous. Pendant le choix d'une destination, le toucher choisit
 * toujours la Case. US-0948 : les Bêtes repérées du joueur (`betes`) : le repère de chacune posé à chaque dessin au centre
 * de sa Case, jusqu'à la fin de sa durée (BetesRepereesSurLaCarte) ; son toucher ouvre sa fiche, toujours une seule à la
 * fois, et touché encore, passe à l'Expédition posée au même point, puis à la Case, comme entre deux Expéditions.
 */
export function CarteDuJeu({
  carte,
  fonds,
  destination = null,
  expeditions = AUCUNE_EXPEDITION,
  betes = AUCUNE_BETE,
  maintenant = null,
  vitesse = 1,
}: {
  carte: CarteDuJoueur;
  fonds: string[];
  destination?: string | null;
  expeditions?: ExpeditionEnCours[];
  betes?: BeteReperee[];
  maintenant?: Date | null;
  vitesse?: number;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  // US-0425 : si l'on peut encore rapprocher ou éloigner la carte, et le zoom d'un cran autour du milieu de l'écran.
  const [zoom, setZoom] = useState({ rapprocher: true, eloigner: true });
  const zoomerAuMilieu = useRef<(facteur: number) => void>(() => {});
  // US-0426 : le retour au Foyer, et la flèche qui le montre.
  const revenirAuFoyer = useRef(() => {});
  const fleche = useRef<HTMLButtonElement>(null);
  // US-0428 : la Case choisie et sa fiche ; ce que la fiche demande à la carte : se redessiner, la Case surlignée, et
  // glisser pour que la fiche (`cache`, en pixels de la carte) ne la cache pas.
  const { choix, choisir, fermer } = useFicheDeLaCase();
  const choisie = useRef<Coordonnees | null>(null);
  // US-0908 : si la carte est ouverte pour choisir la destination d'une Expédition, où elle grise ce qui est hors de portée.
  const enChoix = useRef(destination !== null);
  const pourLaFiche = useRef<{ redessiner: () => void; montrer: (c: Coordonnees, cache: Cadre) => void }>({ redessiner: () => {}, montrer: () => {} });
  // US-0913 : l'Expédition dont la fiche est ouverte : une seule fiche à la fois, d'une Case ou d'une Expédition. US-0948 :
  // ou d'une Bête repérée, la Bête regardée.
  const [suivie, setSuivie] = useState<number | null>(null);
  const [regardee, setRegardee] = useState<number | null>(null);
  const choisirUneCase = useCallback(
    (c: Coordonnees | null) => {
      setSuivie(null);
      setRegardee(null);
      choisir(c);
    },
    [choisir],
  );
  const suivre = useCallback(
    (id: number) => {
      fermer();
      setRegardee(null);
      setSuivie(id);
    },
    [fermer],
  );
  const nePlusSuivre = useCallback(() => setSuivie(null), []);
  const regarder = useCallback(
    (id: number) => {
      fermer();
      setSuivie(null);
      setRegardee(id);
    },
    [fermer],
  );
  const nePlusRegarder = useCallback(() => setRegardee(null), []);
  // Le repère dont la fiche est ouverte, d'une Expédition ou d'une Bête, pour le toucher de la carte, qui passe d'un
  // repère à l'autre.
  const ouvert = suivie !== null ? `expedition-${suivie}` : regardee !== null ? `bete-${regardee}` : null;
  const ouvertActuel = useRef(ouvert);
  useEffect(() => {
    ouvertActuel.current = ouvert;
  }, [ouvert]);
  // US-0913 : les Expéditions en cours et leur chemin. Les repères de celles encore dehors, posés à chaque dessin ; leurs
  // chemins, dessinés avec la carte, qui ne se redessine que quand l'une rentre ou qu'une autre apparaît.
  const suivies = useMemo(() => expeditions.map((expedition) => ({ expedition, chemin: cheminDUneExpedition(carte.foyer, expedition.destination) })), [expeditions, carte.foyer]);
  const reperes = useRef<Repere[]>([]);
  const cheminsADessiner = useRef<{ ids: string; chemins: Repere["chemin"][] }>({ ids: "", chemins: [] });
  const pourLesReperes = useRef(() => {});
  const poser = useCallback((liste: Repere[]) => {
    reperes.current = liste;
    const ids = liste.map((r) => r.id).join(",");
    if (ids === cheminsADessiner.current.ids) pourLesReperes.current();
    else {
      cheminsADessiner.current = { ids, chemins: liste.map((r) => r.chemin) };
      pourLaFiche.current.redessiner();
    }
  }, []);
  // US-0948 : les repères des Bêtes encore sur leur Case, posés à chaque dessin et chaque fois que l'une s'en va, sans
  // redessiner la carte : rien n'en est dessiné dessus.
  const reperesDeBetes = useRef<RepereDeBete[]>([]);
  const pourLesBetes = useRef(() => {});
  const poserLesBetes = useCallback((liste: RepereDeBete[]) => {
    reperesDeBetes.current = liste;
    pourLesBetes.current();
  }, []);
  // US-0442 : la carte à jour des Cases découvertes depuis sa lecture, redessinée dès qu'il y en a ; avant le dessin
  // ci-dessous, qu'une nouvelle lecture de la page remet en place avec elle.
  const decouverte = useDecouvertes(carte);
  const decouvertes = useMemo(() => nombreDeDecouvertes(decouverte), [decouverte]);
  const aDessiner = useRef(decouverte);
  useEffect(() => {
    aDessiner.current = decouverte;
    pourLaFiche.current.redessiner();
  }, [decouverte]);
  useEffect(() => {
    const canvas = toile.current;
    const pinceau = canvas?.getContext("2d");
    if (!canvas || !pinceau) return;
    const peinture = {
      fonds: fonds.map((fond) => couleurCalculee(canvas, fond)),
      bord: couleurCalculee(canvas, "color-mix(in oklch, var(--encre) 14%, transparent)"),
      motifSombre: couleurCalculee(canvas, "color-mix(in oklch, var(--encre) 26%, transparent)"),
      motifClair: couleurCalculee(canvas, "color-mix(in oklch, var(--ivoire) 45%, transparent)"),
      encre: couleurCalculee(canvas, "var(--encre)"),
      repere: couleurCalculee(canvas, "var(--citron)"),
    };
    // US-0908 : le voile qui grise ce qui est au-delà de la portée d'exploration.
    const voile = couleurCalculee(canvas, "color-mix(in oklch, var(--galet) 70%, transparent)");
    // US-0913 : le fanion des destinations, du ton de l'état « en Expédition ».
    const fanion = couleurCalculee(canvas, "var(--ciel)");
    let hutte: Hutte | null = null;
    // Ce que montre la carte, d'un geste à l'autre, une fois connue la place qu'elle a ; la limite de son milieu.
    let vue: Vue | null = null;
    const limite = limiteDeLaCarte(carte);
    // US-0426 : la flèche du Foyer suit chaque dessin. US-0427 : la vue retenue à chaque dessin, au plus un par image.
    // US-0913 : les repères des Expéditions aussi. US-0948 : et ceux des Bêtes repérées.
    const dessiner = () => {
      if (!vue) return;
      // US-0442 : une teinte découverte depuis la lecture de la page, de la couleur que la page lui aurait donnée.
      const { teintes } = aDessiner.current;
      for (let t = peinture.fonds.length; t < teintes.length; t++) peinture.fonds.push(couleurCalculee(canvas, couleur(teintes[t])));
      const { chemins } = cheminsADessiner.current;
      const portee = enChoix.current ? { cases: PORTEE_D_EXPLORATION_CASES, voile } : null;
      dessinerLaCarte(pinceau, aDessiner.current, vue, peinture, hutte, choisie.current, portee, chemins.length > 0 ? { chemins, fanion } : null);
      placerLaFleche(fleche.current, canvas, vue, carte.foyer);
      placerLesReperes(reperes.current, carte.foyer, vue);
      placerLesBetes(reperesDeBetes.current, vue);
      retenirLaVue(carte, vue);
    };
    // US-0913 : les repères reposés quand leurs Expéditions avancent, sans redessiner la carte. US-0948 : de même quand
    // une Bête s'en va.
    pourLesReperes.current = () => vue && placerLesReperes(reperes.current, carte.foyer, vue);
    pourLesBetes.current = () => vue && placerLesBetes(reperesDeBetes.current, vue);
    // US-0948 : tous les repères à toucher, ceux des Expéditions puis ceux des Bêtes, chacun avec ce qu'ouvre son toucher.
    const reperesAToucher = () => [
      ...reperes.current.map(({ id, ici }) => ({ id: `expedition-${id}`, ici, ouvrir: () => suivre(id) })),
      ...reperesDeBetes.current.map(({ id, ici }) => ({ id: `bete-${id}`, ici, ouvrir: () => regarder(id) })),
    ];
    // US-0425 : les boutons de zoom grisés ou non selon la vue, sans rien redessiner s'ils ne changent pas.
    const griser = () => {
      if (!vue) return;
      const possible = zoomPossible(vue);
      setZoom((avant) => (avant.rapprocher === possible.rapprocher && avant.eloigner === possible.eloigner ? avant : possible));
    };
    // La toile à la taille que la page lui donne, à l'ouverture et à chaque changement : la redimensionner l'efface.
    // US-0423 : le zoom ramené dans les bornes de cette taille. US-0427 : à l'ouverture, la vue retenue s'il y en a une.
    const redimensionner = () => {
      const { width: largeur, height: hauteur } = canvas.getBoundingClientRect();
      const densite = window.devicePixelRatio || 1;
      canvas.width = Math.round(largeur * densite);
      canvas.height = Math.round(hauteur * densite);
      pinceau.setTransform(densite, 0, 0, densite, 0, 0);
      vue = cadrer(vue ?? vueRetenue(carte, largeur, hauteur) ?? vueSurLeFoyer(carte.foyer, largeur, hauteur), largeur, hauteur);
      dessiner();
      griser();
    };
    // US-0420 : le dessin demandé pour la prochaine image de l'écran, s'il y en a un : un seul par image. US-0426 :
    // un geste arrête le retour au Foyer en cours.
    let image = 0;
    let mouvement = () => {};
    const changer = (nouvelle: Vue) => {
      mouvement();
      vue = nouvelle;
      image ||= requestAnimationFrame(() => {
        image = 0;
        dessiner();
      });
      griser();
    };
    const illustration = new Image();
    illustration.onload = () => {
      hutte = { image: illustration, largeur: illustration.naturalWidth, hauteur: illustration.naturalHeight };
      dessiner();
    };
    illustration.src = HUTTE;
    const suivi = new ResizeObserver(redimensionner);
    suivi.observe(canvas);
    const arreter = suivreLesGestes(canvas, {
      deplacer: (dx, dy) => vue && changer(deplacer(vue, dx, dy, limite)),
      avancer: (colonnes, rangees) => vue && changer(avancer(vue, colonnes, rangees, limite)),
      zoomer: (facteur, x, y) => vue && changer(zoomer(vue, facteur, x, y, limite)),
      // US-0913 : le repère d'une Expédition sous le doigt ouvre sa fiche ; touché encore, l'Expédition posée au même
      // point, puis la Case dessous (repereTouche) ; sinon, la Case dessous. Pendant le choix d'une destination, toujours
      // la Case : une Expédition qui y séjourne ne l'empêche pas d'être choisie. US-0948 : de même du repère d'une Bête.
      toucher: (x, y) => {
        if (!vue) return;
        const touchables = reperesAToucher();
        const touche = enChoix.current ? null : repereTouche(touchables, x, y, ouvertActuel.current);
        const repere = touchables.find((r) => r.id === touche);
        if (repere) repere.ouvrir();
        else choisirUneCase(caseSous(carte, vue, x, y));
      },
    });
    // US-0913 : la main au survol d'un repère, à la souris : un clic l'ouvre.
    const survoler = (evenement: PointerEvent) => {
      if (evenement.pointerType !== "mouse" || evenement.buttons !== 0) {
        canvas.style.cursor = "";
        return;
      }
      const { left, top } = canvas.getBoundingClientRect();
      const dessus = !enChoix.current && reperesSous(reperesAToucher(), evenement.clientX - left, evenement.clientY - top).length > 0;
      canvas.style.cursor = dessus ? "pointer" : "";
    };
    canvas.addEventListener("pointermove", survoler);
    zoomerAuMilieu.current = (facteur) => vue && changer(zoomer(vue, facteur, vue.largeur / 2, vue.hauteur / 2, limite));
    // US-0426 : le retour au Foyer, chaque vue dessinée aussitôt, à l'image de l'écran du mouvement, à la taille de la carte.
    revenirAuFoyer.current = () => {
      mouvement();
      if (!vue) return;
      mouvement = glisser(vue, retourAuFoyer(vue, carte.foyer), (etape) => {
        cancelAnimationFrame(image);
        image = 0;
        vue = cadrer(etape, vue!.largeur, vue!.hauteur);
        dessiner();
        griser();
      });
    };
    // US-0426 : la flèche du Foyer reposée quand ce qu'elle évite change sans que la carte bouge : un panneau du bas qui
    // publie sa hauteur sur la page (--hauteur-legende, --hauteur-fiche), la légende qui se montre sur ordinateur.
    let pose = 0;
    const reposer = () => {
      cancelAnimationFrame(pose);
      pose = requestAnimationFrame(() => vue && placerLaFleche(fleche.current, canvas, vue, carte.foyer));
    };
    const panneaux = new MutationObserver(reposer);
    panneaux.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    document.addEventListener(LEGENDE_MONTREE, reposer);
    // US-0428 : la carte redessinée (la flèche du Foyer reposée) quand la fiche change, glissée si elle cache la Case.
    pourLaFiche.current = {
      redessiner: dessiner,
      montrer: (c, cache) => {
        const montree = vue && devoiler(vue, c, cache, limite);
        if (montree && montree !== vue) changer(montree);
        else dessiner();
      },
    };
    return () => {
      suivi.disconnect();
      illustration.onload = null;
      arreter();
      canvas.removeEventListener("pointermove", survoler);
      pourLesReperes.current = () => {};
      pourLesBetes.current = () => {};
      cancelAnimationFrame(image);
      cancelAnimationFrame(pose);
      panneaux.disconnect();
      document.removeEventListener(LEGENDE_MONTREE, reposer);
      mouvement();
      zoomerAuMilieu.current = () => {};
      revenirAuFoyer.current = () => {};
      pourLaFiche.current = { redessiner: () => {}, montrer: () => {} };
    };
  }, [carte, fonds, choisirUneCase, suivre, regarder]);
  // US-0428 : la Case choisie surlignée aussitôt, et plus du tout une fois la fiche fermée.
  const laCase = choix?.case ?? null;
  useEffect(() => {
    choisie.current = laCase;
    pourLaFiche.current.redessiner();
  }, [laCase]);
  // US-0908 : ce qui est au-delà de la portée, grisé aussitôt que commence le choix de la destination, et plus du tout
  // une fois qu'il s'arrête.
  useEffect(() => {
    enChoix.current = destination !== null;
    pourLaFiche.current.redessiner();
  }, [destination]);
  const montrer = useCallback((c: Coordonnees, cache: Cadre) => pourLaFiche.current.montrer(c, cache), []);
  return (
    <div className={styles.cadre}>
      {/* US-0422 : une carte qu'on manie, au clavier aussi : elle se sélectionne, et les flèches lui reviennent. */}
      <canvas ref={toile} className={styles.carte} tabIndex={0} role="application" aria-roledescription="carte" aria-label="Carte du Monde" />
      {/* US-0948 : sous les repères des Expéditions, qui peuvent séjourner sur la même Case. */}
      {betes.length > 0 && maintenant ? (
        <BetesRepereesSurLaCarte
          betes={betes}
          maintenant={maintenant}
          vitesse={vitesse}
          poser={poserLesBetes}
          regardee={regardee}
          regarder={regarder}
          fermer={nePlusRegarder}
          carte={toile}
          montrer={montrer}
        />
      ) : null}
      {suivies.length > 0 && maintenant ? (
        <ExpeditionsSurLaCarte
          expeditions={suivies}
          foyer={carte.foyer}
          maintenant={maintenant}
          vitesse={vitesse}
          poser={poser}
          suivie={suivie}
          suivre={suivre}
          fermer={nePlusSuivre}
          carte={toile}
          montrer={montrer}
        />
      ) : null}
      <FlecheDuFoyer ref={fleche} revenir={() => revenirAuFoyer.current()} />
      <BoutonsDeLaCarte {...zoom} zoomer={(facteur) => zoomerAuMilieu.current(facteur)} revenir={() => revenirAuFoyer.current()} />
      <CasesDecouvertes nombre={decouvertes} total={decouverte.cases.q.length} />
      {choix ? <FicheDeLaCase choix={choix} carte={toile} montrer={montrer} fermer={fermer} destination={destination} /> : null}
    </div>
  );
}
