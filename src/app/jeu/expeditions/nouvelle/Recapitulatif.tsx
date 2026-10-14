"use client";

import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useId, useState } from "react";
import { Bloc } from "@/components/Bloc";
import { Frise } from "@/components/Frise";
import kit from "@/components/kit.module.css";
import { Paysage } from "@/components/Paysage";
import { dureeDuTrajetMinutes, sansEscorte } from "@/expeditions/allure";
import { forceQuiManque } from "@/expeditions/apprivoisement";
import { casesDuFoyer } from "@/expeditions/choix-de-destination";
import { forceDeLEscorte } from "@/expeditions/force";
import { horaireDuSejour } from "@/expeditions/sejour";
import type { EspeceDisponible } from "@/monde/effectif";
import type { Coordonnees } from "@/monde/hex";
import { formaterJourEtHeure } from "@/temps/affichage";
import { eclaireursChoisis, entier, escorteChoisie } from "./Escorte";
import { explorateursChoisis } from "./Explorateurs";
import { Partir } from "./Partir";
import styles from "./Recapitulatif.module.css";
import { useSejourAffiche } from "./Sejour";

/** Le fuseau des joueurs, pour l'heure de retour prévue. */
const FUSEAU = "Europe/Paris";

const MINUTE_MS = 60_000;

/** Ce que le récapitulatif dit d'une heure qu'il ne peut pas chiffrer sans destination. */
const AUCUNE = "—";

/** « Souris grise × 3 » : une Espèce de l'escorte et ses Bêtes qui partent, que le nombre ne quitte jamais (espaces insécables). */
const uneEspece = (nom: string, nombre: number) => `${nom} × ${nombre}`;

/**
 * US-0910 : la destination choisie, telle que le récapitulatif la montre : son Biome (null sous le brouillard) et sa
 * distance au Foyer. US-0911 : et sa Case, que « Partir » envoie.
 */
export type DestinationChoisie = Coordonnees & { biome: string | null; distance: number };

/**
 * US-0949 : une Bête repérée sur la Case de destination, telle que le récapitulatif la compare à l'escorte : le nom et la
 * force de son Espèce, sa Rareté, et l'instant du jeu jusqu'auquel elle devrait rester sur sa Case.
 */
export type BeteAChercher = { espece: string; force: number; rareteId: string; jusquA: Date };

/**
 * US-0910 : le récapitulatif de l'écran d'Expédition, à relire avant de partir. Il relit l'adresse, comme les autres
 * blocs, et suit chaque choix au fil de la composition, le séjour pas à pas au curseur : les explorateurs, l'escorte
 * Espèce par Espèce et sa force, ou « Sans escorte » à la place (US-0909) ; la destination et son Biome, ou « inconnu » ;
 * les durées de l'aller, du séjour et du retour, sur leur frise (Frise) ; l'heure de retour prévue d'un départ à l'heure
 * du jeu : celle de l'ouverture de l'écran (`maintenant`), qui avance en direct au rythme du jeu (`vitesse`, donnée par
 * le serveur) sur l'horloge du navigateur, comme le compte à rebours des Voyageurs (US-0333). Il rappelle que ceux qui
 * partent mangent toujours (US-0921), et finit sur « Partir ». En tête, les explorateurs en route, peints. Sur
 * ordinateur, il tient la hauteur de l'écran à côté de ce qu'on compose, et reste en vue quand la page défile. Sur un
 * téléphone, il reste en bas de l'écran pendant qu'on compose, replié sur l'heure de retour prévue (data-essentiel) et
 * le départ ; un bouton le déplie. US-0911 : « Partir » envoie ce qu'il montre : la destination, les explorateurs et
 * l'escorte. US-0912 : l'aller et le retour d'une escorte vont au pas de sa Bête la plus lente, d'après la vitesse de
 * son Espèce, ou des explorateurs s'ils sont plus lents.
 * US-0949 : pour chaque Bête repérée sur la destination (`betes`), son Espèce et sa force, puis si l'escorte est assez
 * forte pour elle (aPortee), en feuille, ou la force qui lui manque (forceQuiManque), en braise : les mots le disent
 * toujours. Quand elle devrait être partie à l'arrivée prévue, qui avance avec l'heure du jeu, une ligne le dit en la
 * nommant, en braise au-dessus du retour prévu, gardée en vue même replié.
 * US-0976 : après la force de l'escorte, ses Éclaireurs, Espèce par Espèce, quand il y en a : ils n'y ajoutent rien, et
 * « Partir » les envoie aussi.
 */
export function Recapitulatif({
  libres,
  especes,
  destination,
  betes = [],
  maintenant,
  vitesse = 1,
}: {
  libres: number;
  especes: EspeceDisponible[];
  destination: DestinationChoisie | null;
  betes?: BeteAChercher[];
  maintenant: Date;
  vitesse?: number;
}) {
  const recherche = useSearchParams();
  const idLignes = useId();
  const [deplie, setDeplie] = useState(false);
  const sejour = useSejourAffiche(recherche);
  const base = maintenant.getTime();
  // Le temps écoulé depuis l'affichage, mesuré pour cette heure du jeu-là : celui d'une heure déjà dépassée ne compte plus.
  const [ecoule, setEcoule] = useState<{ base: number; ms: number } | null>(null);
  useEffect(() => {
    const depart = performance.now();
    const battement = setInterval(() => setEcoule({ base, ms: performance.now() - depart }), 1000);
    return () => clearInterval(battement);
  }, [base]);

  const explorateurs = explorateursChoisis(recherche, libres);
  const choix = escorteChoisie(recherche, especes);
  const escorte = especes.filter((e) => choix.get(e.id)! > 0);
  const eclaireurs = eclaireursChoisis(recherche, especes);
  const eclaireuses = especes.filter((e) => eclaireurs.get(e.id)! > 0);
  const force = sansEscorte(choix) ? null : forceDeLEscorte(escorte.map((e) => ({ force: e.force, nombre: choix.get(e.id)! })));
  const aller = destination ? dureeDuTrajetMinutes(destination.distance, escorte.map((e) => ({ vitesse: e.vitesse, nombre: choix.get(e.id)! }))) : null;
  // Un départ à l'heure du jeu, qui avance au rythme du jeu ; le retour dure autant que l'aller (US-0912), après le
  // séjour, qui ne commence qu'à l'arrivée (US-0906).
  const depart = new Date(base + (ecoule?.base === base ? vitesse * ecoule.ms : 0));
  const horaire = aller === null ? null : horaireDuSejour(depart, aller * MINUTE_MS, sejour);
  const retour = horaire && aller !== null ? new Date(horaire.fin.getTime() + aller * MINUTE_MS) : null;

  return (
    <Bloc titre="Récapitulatif" className={deplie ? `${styles.recap} ${styles.deplie}` : styles.recap}>
      <button
        type="button"
        className={styles.deplier}
        aria-label="Tout le récapitulatif"
        aria-expanded={deplie}
        aria-controls={idLignes}
        onClick={() => setDeplie(!deplie)}
      >
        <svg viewBox="0 0 12 12" className={styles.fleche} aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {/* Sur un téléphone, déplié, les lignes défilent ici, entre le titre et « Partir », qui restent en vue. */}
      <div className={styles.defilant}>
        <Paysage peinture="accueil/explorateurs.webp" sizes="372px" className={`${kit.vignette} ${styles.peinture}`} />
        <dl id={idLignes} className={styles.lignes}>
          <div>
            <dt>Explorateurs</dt>
            <dd>{explorateurs > 0 ? explorateurs : "Aucun"}</dd>
          </div>
          <div>
            <dt>Escorte</dt>
            <dd>{sansEscorte(choix) ? "Sans escorte : Bêtes communes seulement" : escorte.map((e) => uneEspece(e.nom, choix.get(e.id)!)).join(", ")}</dd>
          </div>
          {force === null ? null : (
            <div>
              <dt>Force</dt>
              <dd>{entier(force)}</dd>
            </div>
          )}
          {eclaireuses.length > 0 ? (
            <div>
              <dt>Éclaireurs</dt>
              <dd>{eclaireuses.map((e) => uneEspece(e.nom, eclaireurs.get(e.id)!)).join(", ")}</dd>
            </div>
          ) : null}
          <div>
            <dt>Destination</dt>
            <dd>{destination ? casesDuFoyer(destination.distance) : "Aucune"}</dd>
          </div>
          {destination ? (
            <div>
              <dt>Biome</dt>
              <dd>{destination.biome ?? "inconnu"}</dd>
            </div>
          ) : null}
          {/* US-0949 : chaque Bête repérée sur la destination, face à l'escorte. */}
          {betes.map((bete, i) => {
            const manque = forceQuiManque(force, bete);
            return (
              <Fragment key={i}>
                <div>
                  <dt>Bête repérée</dt>
                  <dd>{`${bete.espece}, force ${entier(bete.force)}`}</dd>
                </div>
                <div>
                  <dt>Votre escorte</dt>
                  <dd data-force={manque > 0 ? "manque" : "assez"}>{manque > 0 ? `Trop faible : il manque ${entier(manque)} de force` : "Assez forte"}</dd>
                </div>
              </Fragment>
            );
          })}
        </dl>
        {/* L'aller, le séjour et le retour, chacun sa durée et son trait à sa mesure. */}
        <Frise durees={{ aller, sejour, retour: aller }} className={styles.frise} />
        <dl className={styles.retourPrevu}>
          {/* US-0949 : une Bête repérée partie avant l'arrivée prévue ne sera plus là. */}
          {betes.map((bete, i) =>
            horaire && bete.jusquA <= horaire.debut ? (
              <div key={i} data-essentiel="" data-partie="">
                <dt>À l&apos;arrivée</dt>
                <dd>{`${bete.espece} ne sera plus là`}</dd>
              </div>
            ) : null,
          )}
          <div data-essentiel="">
            <dt>Retour prévu</dt>
            <dd>{retour ? <time dateTime={retour.toISOString()}>{formaterJourEtHeure(retour, FUSEAU)}</time> : AUCUNE}</dd>
          </div>
        </dl>
        <p className={styles.manger}>Ceux qui partent continuent de manger pendant toute l&apos;absence.</p>
      </div>
      {/* US-0911 : un départ refusé se dit jusqu'au prochain choix du joueur, que l'adresse garde ; l'écran relu ne l'efface pas. */}
      <Partir
        key={recherche.toString()}
        destination={destination && { q: destination.q, r: destination.r }}
        explorateurs={explorateurs}
        escorte={choix}
        eclaireurs={eclaireurs}
      />
    </Bloc>
  );
}
