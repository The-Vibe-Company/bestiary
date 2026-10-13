"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { type CSSProperties, type MouseEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { Etat } from "@/components/Etat";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { EN_EXPEDITION } from "@/monde/etat-habitant";
import { ajouterAuMetier, donnerUnMetier, renvoyerUnHabitant, retirerDuMetier, retirerLeMetier } from "./actions";
import { BandeauSansMetier } from "./BandeauSansMetier";
import { useHabitantsMontres } from "./HabitantsMontres";
import styles from "./ListeDesHabitants.module.css";
import { BoutonDuMetier, type MetierAuChoix, MetiersAuChoix } from "./MetiersAuChoix";

export type { MetierAuChoix };

/** US-0307 : un Métier tel que le tableau le montre : son icône, sa phrase et, tant qu'il ne sert à rien, ce qu'il attend. */
export type MetierDuTableau = MetierAuChoix & { phrase?: string; servira?: string | null };

/**
 * Un Habitant tel que la liste le montre : son prénom, le nom de son Métier (null sans Métier), son état et, quand la
 * page la donne, la date de son arrivée, déjà écrite (« 2 octobre 2026 »).
 */
export type HabitantAffiche = { id: number; prenom: string; metier: string | null; etat: string; arriveLe?: string };

/**
 * US-0309 : un compteur : « Sans Métier », ou un Métier avec son icône, le Métier qu'il compte tel que la liste le montre
 * (null : sans Métier), le nombre d'Habitants qui l'exercent, et combien d'entre eux sont en Expédition. US-0314 : son
 * identifiant est celui du filtre dans l'adresse (?metier=bucheron, ?metier=sans). US-0307 : il porte aussi la phrase du
 * Métier, et ce qu'il attend, que son groupe dit en tête.
 */
type Effectif = {
  id: string;
  nom: string;
  icone: string | null;
  metier: string | null;
  phrase?: string;
  servira?: string | null;
  nombre: number;
  partis: number;
};

/** US-0314 : le paramètre de l'adresse qui porte le filtre. */
const PARAMETRE_DU_FILTRE = "metier";

/** Le médaillon de « Tous » : un Habitant du jeu, du même trait que les icônes des Métiers. */
const ICONE_HABITANTS = "/illustrations/icones/habitants.webp";

/** La peinture du village, fondue à droite de l'en-tête des Habitants. */
const DECOR = "/illustrations/foyer/prairie.webp";

/** Le lieu de travail de chaque Métier, fondu à droite de l'en-tête de son groupe. */
const LIEUX: Record<string, string> = {
  explorateur: "/illustrations/prototype/misc/expedition.webp",
  chasseur: "/illustrations/prototype/buildings/metalMine.webp",
  cueilleur: "/illustrations/prototype/buildings/solarPlant.webp",
  bucheron: "/illustrations/prototype/buildings/metalStorage.webp",
  mineur: "/illustrations/prototype/buildings/crystalMine.webp",
  chercheur: "/illustrations/prototype/buildings/researchLab.webp",
  batisseur: "/illustrations/prototype/buildings/roboticsFactory.webp",
  eleveur: "/illustrations/prototype/buildings/shipyard.webp",
};

/** US-0330 : « de Brune », « d'Arno ». */
const de = (prenom: string) => (/^[aeiouyhàâäéèêëîïôöùûüœæ]/i.test(prenom) ? `d'${prenom}` : `de ${prenom}`);

/** Combien d'Habitants de `habitants` sont partis en Expédition. */
const partis = (habitants: HabitantAffiche[]) => habitants.filter((h) => h.etat === EN_EXPEDITION).length;

/**
 * US-0309 : les effectifs de la liste même, Habitant par Habitant : ceux sans Métier d'abord, puis chaque Métier dans
 * son ordre, même quand personne ne l'exerce, puis ceux d'un Métier qui n'est pas au choix, à son nom, pour que chacun
 * ait son groupe. Chaque Habitant compte une fois : leur somme est le nombre d'Habitants.
 */
function effectifsParMetier(habitants: HabitantAffiche[], metiers: MetierDuTableau[]): Effectif[] {
  const compter = (metier: string | null) => {
    const ceux = habitants.filter((h) => h.metier === metier);
    return { nombre: ceux.length, partis: partis(ceux) };
  };
  const horsDuChoix = new Set(habitants.flatMap((h) => (h.metier === null || metiers.some((m) => m.nom === h.metier) ? [] : [h.metier])));
  return [
    { id: "sans", nom: "Sans Métier", icone: null, metier: null, ...compter(null) },
    ...metiers.map((m) => ({ id: m.id, nom: m.nom, icone: m.icone, phrase: m.phrase, servira: m.servira, metier: m.nom, ...compter(m.nom) })),
    ...[...horsDuChoix].map((nom) => ({ id: nom, nom, icone: null, metier: nom, ...compter(nom) })),
  ];
}

/**
 * US-0312 : celui que « − » remet sans Métier : le dernier arrivé au Territoire de ceux qui exercent le Métier `nom`,
 * soit le plus grand identifiant (les Habitants sont numérotés à leur arrivée), comme la base le choisira ; null quand
 * personne ne l'exerce. US-0911 : parmi ceux restés au Foyer : le Métier d'un explorateur parti ne change pas avant son
 * retour.
 */
function dernierArrive(habitants: HabitantAffiche[], nom: string): HabitantAffiche | null {
  return habitants
    .filter((h) => h.metier === nom && h.etat !== EN_EXPEDITION)
    .reduce<HabitantAffiche | null>((dernier, h) => (dernier && dernier.id > h.id ? dernier : h), null);
}

/**
 * Les Habitants, en deux zones de l'écran : à gauche, le rail des Métiers ; au centre, le registre, un tableau groupé
 * par Métier.
 *
 * US-0309, US-0314 : le rail compte les Habitants, « Tous » puis « Sans Métier » puis un par Métier, chacun son
 * médaillon, son nom, son nombre, et sous son nom combien sont en Expédition ; comptés sur les lignes mêmes, ils bougent
 * aussitôt avec elles. Chaque compteur filtre le tableau sur son Métier, « Tous » retire le filtre, et toucher le
 * compteur pressé aussi. Le filtre ne touche qu'au tableau, sans recharger la page ; il vit dans l'adresse, qui survit au
 * rechargement et sert de lien. Un identifiant inconnu ne filtre rien. Sur un téléphone, le rail devient une bande de
 * pastilles qui défile de côté.
 *
 * Le registre (US-0303) : en tête, « Habitants », ce que montre le filtre et son nombre, et US-0313 le bandeau des sans
 * Métier ; puis une ligne par Habitant : son prénom, son Métier, son état, la date de son arrivée. Les lignes sont
 * groupées par Métier, ceux sans Métier d'abord, tant qu'il y en a ; en tête de chaque groupe (US-0307), le médaillon du
 * Métier, son nom, sa phrase et, tant qu'il ne sert à rien, ce qu'il attend. Sur ordinateur, le tableau défile dans son
 * panneau, l'en-tête de ses colonnes et celui de chaque groupe collés en haut.
 *
 * US-0312 : au bout de l'en-tête de chaque Métier, son effectif entre « − » et « + ». « + » donne le Métier au premier
 * Habitant sans Métier de la liste, et se grise quand il n'en reste aucun ; « − » remet sans Métier le dernier arrivé de
 * ce Métier, et se grise quand personne ne l'exerce (US-0911 : au Foyer ; un explorateur parti compte dans l'effectif,
 * mais garde son Métier jusqu'à son retour). Gratuit et immédiat : les effectifs, les lignes et le bandeau suivent
 * aussitôt, le temps que l'action, qui choisit l'Habitant dans la base et jamais dans le navigateur, l'enregistre et
 * relise la page, qui fait alors foi. US-0315 : des « + » rapides prennent chacun le sans Métier suivant de la liste
 * montrée, et « + » se grise dès qu'il n'en reste plus : le navigateur n'en envoie jamais plus qu'il n'en montre.
 *
 * US-0308 : sur la ligne d'un Habitant sans Métier, « Choisir un Métier » déplie dessous les Métiers au choix, un seul
 * dépliant à la fois ; Échap ou un second toucher le referment. Toucher un Métier le donne : la ligne le montre aussitôt,
 * dans le groupe de son Métier, le temps que l'action serveur l'enregistre et relise la page, qui fait alors foi.
 * US-0310 : sur la ligne d'un Habitant qui a un Métier, ce Métier est le même bouton : il déplie les Métiers, le sien
 * pressé et hors d'atteinte ; en toucher un autre le lui donne de la même façon, gratuitement et aussitôt. Dans les deux
 * cas, la main suit le bouton de la ligne. US-0311 : « Sans Métier » le lui retire de même ; il rejoint aussitôt les sans
 * Métier (HabitantsMontres).
 *
 * US-0329 : sans aucun Habitant, ni rail ni tableau : une seule phrase, sous le titre : des Voyageurs finiront par passer
 * aux portes.
 *
 * US-0330 : dans le dépliant, à part et en dernier, « Renvoyer » fait partir l'Habitant pour de bon, après une
 * confirmation sur place : le premier toucher ne fait que changer le bouton en « Confirmer le renvoi », dans la couleur
 * d'alerte ; le second renvoie. Un toucher ailleurs, le focus ailleurs ou Échap annulent ; le second clic d'un double
 * clic ne confirme pas. La ligne part aussitôt, et avec elle les compteurs et le bandeau des sans Métier, le temps que
 * l'action le renvoie et relise la page, qui fait alors foi ; la main passe à la ligne qui prend sa place, ou à celle
 * d'avant. Le dernier Habitant se renvoie aussi : la phrase d'US-0329 prend sa place.
 *
 * US-0911 : un explorateur parti est « en Expédition » sur sa ligne, son Métier écrit sans bouton : rien ne se déplie,
 * ni Métier ni renvoi, avant son retour.
 */
export function ListeDesHabitants({ habitants, metiers }: { habitants: HabitantAffiche[]; metiers: MetierDuTableau[] }) {
  const [affiches, montrerDAvance] = useHabitantsMontres(habitants);
  const recherche = useSearchParams();
  const effectifs = effectifsParMetier(affiches, metiers);
  const filtre = effectifs.find((e) => e.id === recherche.get(PARAMETRE_DU_FILTRE)) ?? null;
  // Les groupes du tableau : ceux sans Métier tant qu'il y en a, puis chaque Métier ; US-0314 : un filtre ne garde que le sien.
  const groupes = effectifs.filter((e) => (filtre ? e === filtre : e.metier !== null || e.nombre > 0));
  // Les lignes, dans l'ordre où le tableau les montre, groupe par groupe.
  const montres = groupes.flatMap((e) => affiches.filter((h) => h.metier === e.metier));
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [, demarrer] = useTransition();
  const prefixe = useId();
  const idBouton = (id: number) => `${prefixe}-choisir-${id}`;
  const idChoix = (id: number) => `${prefixe}-metiers-${id}`;
  // US-0330 : l'Habitant dont le renvoi attend sa confirmation, et le bouton qui la donne.
  const [aRenvoyer, setARenvoyer] = useState<number | null>(null);
  const boutonDeConfirmation = useRef<HTMLButtonElement>(null);
  // L'Habitant dont la ligne vient de changer de groupe : la main suit son bouton, que le tableau a reposé ailleurs.
  const mainSurLaLigne = useRef<number | null>(null);

  // Échap referme le dépliant ouvert sans rien changer, et rend la main à son bouton.
  useEffect(() => {
    if (ouvert === null) return;
    function fermer(evenement: KeyboardEvent) {
      if (evenement.key !== "Escape") return;
      setOuvert(null);
      document.getElementById(`${prefixe}-choisir-${ouvert}`)?.focus();
    }
    document.addEventListener("keydown", fermer);
    return () => document.removeEventListener("keydown", fermer);
  }, [ouvert, prefixe]);

  // US-0330 : un toucher ou le focus ailleurs que sur « Confirmer le renvoi », ou Échap, annulent la confirmation.
  useEffect(() => {
    if (aRenvoyer === null) return;
    const ailleurs = (evenement: Event) => {
      if (!boutonDeConfirmation.current?.contains(evenement.target as Node)) setARenvoyer(null);
    };
    const echap = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setARenvoyer(null);
    };
    document.addEventListener("pointerdown", ailleurs);
    document.addEventListener("focusin", ailleurs);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", ailleurs);
      document.removeEventListener("focusin", ailleurs);
      document.removeEventListener("keydown", echap);
    };
  }, [aRenvoyer]);

  // Une ligne qui change de groupe est reposée ailleurs, et la main qu'avait son bouton se perd : elle le retrouve, une
  // fois. Dès que la main est ailleurs que sur lui, on ne la suit plus.
  useEffect(() => {
    const id = mainSurLaLigne.current;
    if (id === null) return;
    const actif = document.activeElement;
    if (actif && actif !== document.body) {
      if (actif.id !== idBouton(id)) mainSurLaLigne.current = null;
      return;
    }
    const bouton = document.getElementById(idBouton(id));
    if (!bouton) return;
    bouton.focus();
    mainSurLaLigne.current = null;
  });

  /** Donne le Métier `metier` à l'Habitant, ou le remet sans Métier (null, US-0311). */
  function donner(habitant: HabitantAffiche, metier: MetierAuChoix | null) {
    setOuvert(null);
    // Le Métier touché s'en va avec le dépliant : la main revient au bouton de la ligne, et le suit dans son nouveau groupe.
    document.getElementById(idBouton(habitant.id))?.focus();
    mainSurLaLigne.current = habitant.id;
    demarrer(async () => {
      montrerDAvance({ id: habitant.id, metier: metier?.nom ?? null });
      await (metier ? donnerUnMetier(habitant.id, metier.id) : retirerLeMetier(habitant.id));
    });
  }

  /** US-0312 : « + » et « − » d'un groupe : montre aussitôt le Métier de l'Habitant que la base choisira. */
  function repartir(habitant: HabitantAffiche | null, metier: string | null, action: () => Promise<void>) {
    if (!habitant) return;
    demarrer(async () => {
      montrerDAvance({ id: habitant.id, metier });
      await action();
    });
  }

  /**
   * US-0330 : le toucher sur « Renvoyer » : le premier demande la confirmation, le second renvoie l'Habitant, sauf s'il
   * n'est que le second clic d'un double clic.
   */
  function renvoyer(habitant: HabitantAffiche, evenement: MouseEvent) {
    if (aRenvoyer !== habitant.id) return setARenvoyer(habitant.id);
    if (evenement.detail > 1) return;
    setARenvoyer(null);
    setOuvert(null);
    // La ligne s'en va avec le bouton : la main passe à celle qui prend sa place, ou à celle d'avant ; US-0911 : à la
    // plus proche qui a son bouton, celle d'un explorateur parti n'en ayant pas.
    const aBouton = montres.filter((h) => h === habitant || h.etat !== EN_EXPEDITION);
    const rang = aBouton.indexOf(habitant);
    const voisin = aBouton[rang + 1] ?? aBouton[rang - 1];
    if (voisin) document.getElementById(idBouton(voisin.id))?.focus();
    demarrer(async () => {
      montrerDAvance({ id: habitant.id, renvoye: true });
      await renvoyerUnHabitant(habitant.id);
    });
  }

  /**
   * US-0314 : filtre le tableau sur un compteur, ou retire le filtre (null). Next.js relie replaceState à
   * useSearchParams : le tableau se relit sans requête, et l'historique ne garde pas chaque filtre essayé.
   */
  function filtrer(id: string | null) {
    const parametres = new URLSearchParams(recherche.toString());
    if (id === null) parametres.delete(PARAMETRE_DU_FILTRE);
    else parametres.set(PARAMETRE_DU_FILTRE, id);
    const suite = parametres.toString();
    window.history.replaceState(null, "", suite ? `?${suite}` : window.location.pathname);
  }

  const titre = (
    <h1 className={styles.titre} id={`${prefixe}-titre`}>
      Habitants
    </h1>
  );

  // US-0329 : sans Habitant, ni compteurs à zéro, ni filtre, ni tableau : une phrase, sous le titre.
  if (affiches.length === 0) {
    return (
      <section className={`${kit.panneau} ${styles.registre}`} aria-labelledby={`${prefixe}-titre`} data-seul="">
        <header className={styles.enTete}>{titre}</header>
        <p className={styles.personne}>Aucun Habitant pour l&apos;instant. Des Voyageurs finiront par passer aux portes.</p>
      </section>
    );
  }

  // Les sans Métier passent les premiers dans la liste, rangés comme la base les range (HabitantsMontres).
  const premierSansMetier = affiches.find((h) => h.metier === null) ?? null;
  // La barre sous chaque Métier du rail : sa part du Métier le plus exercé.
  const plusExerce = Math.max(1, ...effectifs.slice(1).map((e) => e.nombre));
  // Sous un compteur, ceux en Expédition : leur ligne le dit déjà, c'est seulement pour les yeux.
  const enExpedition = (nombre: number) =>
    nombre > 0 ? (
      <small className={styles.partis} aria-hidden="true">
        {`${nombre} en Expédition`}
      </small>
    ) : null;

  return (
    <>
      <div className={`${kit.panneau} ${styles.rail}`}>
        <p className={`${kit.etiquette} ${styles.titreRail}`}>Métiers</p>
        <ul className={styles.compteurs} aria-label="Effectifs par Métier">
          <li>
            <button type="button" className={styles.compteur} aria-pressed={filtre === null} onClick={() => filtrer(null)}>
              <Medaillon src={ICONE_HABITANTS} taille="md" className={styles.medaillonCompteur} />
              <span className={styles.nomCompteur}>
                <span className={styles.nom}>Tous</span>
                {enExpedition(partis(affiches))}
              </span>
              {/* Le nombre que la place du Territoire dit déjà : seulement pour les yeux, « Tous » garde son nom. */}
              <strong className={styles.nombreCompteur} aria-hidden="true">
                {affiches.length}
              </strong>
            </button>
          </li>
          {effectifs.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className={styles.compteur}
                aria-pressed={filtre?.id === e.id}
                data-personne={e.nombre === 0 ? "" : undefined}
                onClick={() => filtrer(filtre?.id === e.id ? null : e.id)}
              >
                {/* Le nom est écrit juste à côté : le médaillon est muet. */}
                <Medaillon src={e.icone ?? undefined} taille="md" className={styles.medaillonCompteur} />
                <span className={styles.nomCompteur}>
                  <span className={styles.nom}>
                    {e.nom}
                    {e.metier === null && e.nombre > 0 ? <span className={`${kit.repere} ${styles.repere}`} aria-hidden="true" /> : null}
                  </span>
                  {enExpedition(e.partis)}
                </span>{" "}
                <strong className={styles.nombreCompteur}>{e.nombre}</strong>
                {e.metier !== null ? (
                  <span className={styles.part} aria-hidden="true">
                    <i style={{ "--part": `${(100 * e.nombre) / plusExerce}%` } as CSSProperties} />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <section className={`${kit.panneau} ${styles.registre}`} aria-labelledby={`${prefixe}-titre`}>
        <header className={styles.enTete}>
          <span className={styles.decor} aria-hidden="true">
            <Image src={DECOR} alt="" fill sizes="(max-width: 1023px) 100vw, 50vw" className={styles.peinture} />
          </span>
          {titre}
          <p className={styles.vue}>
            {filtre?.nom ?? "Tous"} · <strong>{montres.length}</strong>
          </p>
          {/* US-0313 : compté sur les Habitants que montre la liste, Métier donné d'avance compris. */}
          <BandeauSansMetier nombre={effectifs[0].nombre} />
        </header>
        <div className={styles.defile}>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th scope="col" className={styles.colonnePrenom}>
                  Prénom
                </th>
                <th scope="col" className={styles.colonneMetier}>
                  Métier
                </th>
                <th scope="col" className={styles.colonneEtat}>
                  État
                </th>
                <th scope="col" className={styles.colonneArrivee}>
                  Arrivé le
                </th>
              </tr>
            </thead>
            {groupes.map((e) => {
              const ceux = affiches.filter((h) => h.metier === e.metier);
              const metier = metiers.find((m) => m.nom === e.metier);
              const auFoyer = e.metier === null ? null : dernierArrive(affiches, e.metier);
              return (
                <tbody key={e.id} className={styles.groupe} data-sans-metier={e.metier === null ? "" : undefined}>
                  <tr className={styles.teteDeGroupe}>
                    <th scope="rowgroup" colSpan={4}>
                      <div className={styles.tete}>
                        {metier && LIEUX[metier.id] ? (
                          <span className={styles.lieu} aria-hidden="true">
                            <Image src={LIEUX[metier.id]} alt="" fill sizes="(max-width: 760px) 50vw, 360px" className={styles.peinture} />
                          </span>
                        ) : null}
                        <Medaillon src={e.icone ?? undefined} taille="md" className={styles.medaillonGroupe} />
                        <span className={styles.titreGroupe}>
                          <span className={styles.nomGroupe}>{e.nom}</span>
                          {e.phrase ? <span className={styles.phrase}>{e.phrase}</span> : null}
                          {e.servira ? <span className={styles.servira}>{`Servira ${e.servira}.`}</span> : null}
                        </span>
                        {metier ? (
                          <span className={`${kit.pas} ${styles.pas}`}>
                            <button
                              type="button"
                              className={kit.pasBouton}
                              aria-label={`Un ${e.nom} de moins`}
                              disabled={auFoyer === null}
                              onClick={() => repartir(auFoyer, null, () => retirerDuMetier(metier.id))}
                            >
                              −
                            </button>
                            <span className={kit.pasValeur}>{e.nombre}</span>
                            <button
                              type="button"
                              className={kit.pasBouton}
                              aria-label={`Un ${e.nom} de plus`}
                              disabled={premierSansMetier === null}
                              onClick={() => repartir(premierSansMetier, e.metier, () => ajouterAuMetier(metier.id))}
                            >
                              +
                            </button>
                          </span>
                        ) : (
                          <span className={styles.effectifGroupe}>{e.nombre}</span>
                        )}
                      </div>
                    </th>
                  </tr>
                  {/* US-0314 : un filtre qui ne trouve personne le dit, à la place des lignes. */}
                  {ceux.length === 0 && filtre ? (
                    <tr className={styles.vide}>
                      <td colSpan={4}>
                        <p className={styles.personne}>{e.metier === null ? "Personne n'est sans Métier." : "Personne n'exerce ce Métier."}</p>
                      </td>
                    </tr>
                  ) : null}
                  {ceux.flatMap((h) => {
                    const parti = h.etat === EN_EXPEDITION;
                    // US-0911 : rien ne reste déplié sur la ligne d'un explorateur parti entre-temps.
                    const deplie = ouvert === h.id && !parti;
                    const confirmer = deplie && aRenvoyer === h.id;
                    const icone = metiers.find((m) => m.nom === h.metier)?.icone ?? null;
                    const ligne = (
                      <tr key={h.id} className={styles.habitant} data-ouvert={deplie ? "" : undefined}>
                        <th scope="row" className={styles.prenom}>
                          {h.prenom}
                        </th>
                        <td className={styles.metier}>
                          {metiers.length > 0 && !parti ? (
                            <BoutonDuMetier
                              id={idBouton(h.id)}
                              texte={h.metier ?? "Choisir un Métier"}
                              icone={icone}
                              aChoisir={h.metier === null}
                              deplie={deplie}
                              depliant={idChoix(h.id)}
                              className={styles.pastille}
                              onClick={() => setOuvert(deplie ? null : h.id)}
                            />
                          ) : (
                            <span className={styles.metierEcrit} data-sans-metier={h.metier === null ? "" : undefined}>
                              {metiers.length > 0 ? <Medaillon src={icone ?? undefined} taille="xs" /> : null}
                              {h.metier ?? "sans Métier"}
                            </span>
                          )}
                        </td>
                        <td className={styles.etat} data-absent={parti ? "" : undefined}>
                          <Etat etat={parti ? "expedition" : "libre"}>{h.etat}</Etat>
                        </td>
                        <td className={styles.arrivee}>{h.arriveLe}</td>
                      </tr>
                    );
                    if (!deplie) return [ligne];
                    return [
                      ligne,
                      // US-0308, US-0310, US-0311 : les Métiers au choix, sous la ligne, sur toute la largeur du tableau.
                      <tr key={`${h.id}-metiers`} className={styles.depliant}>
                        <td colSpan={4}>
                          <div className={styles.dedans}>
                            <p className={`${kit.etiquette} ${styles.quiChoisit}`}>{h.metier ? "Choisir son Métier" : "Choisir un Métier"}</p>
                            <MetiersAuChoix
                              id={idChoix(h.id)}
                              etiquette={`Métier de ${h.prenom}`}
                              metiers={metiers}
                              actuel={h.metier}
                              className={styles.choixDuMetier}
                              choisir={(m) => donner(h, m)}
                            />
                            {/* US-0330 : à part des Métiers, en dernier ; un lecteur d'écran entend aussi qui il renvoie. */}
                            <button
                              ref={confirmer ? boutonDeConfirmation : undefined}
                              type="button"
                              className={`${kit.bouton} ${kit.danger} ${styles.renvoyer}`}
                              aria-label={confirmer ? `Confirmer le renvoi ${de(h.prenom)}` : `Renvoyer ${h.prenom}`}
                              data-confirmer={confirmer ? "" : undefined}
                              onClick={(evenement) => renvoyer(h, evenement)}
                            >
                              {confirmer ? "Confirmer le renvoi" : "Renvoyer"}
                            </button>
                          </div>
                        </td>
                      </tr>,
                    ];
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>
    </>
  );
}
