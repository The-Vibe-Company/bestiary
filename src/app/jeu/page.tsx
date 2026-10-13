import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte, recitsNonLusALHeure, voyageursALHeure } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { Illustration } from "@/components/Illustration";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { getPool } from "@/db";
import { recapitulatifDAbsence } from "@/monde/absence";
import { nombreDeBetes } from "@/monde/effectif";
import { departsNonLus, departsPendantLAbsence } from "@/monde/famine";
import { stocksDuTerritoire } from "@/monde/stocks";
import { foyerDuTerritoire } from "@/monde/territoire";
import { maintenant } from "@/temps/horloge";
import styles from "./page.module.css";
import { BlocProduction } from "./BlocProduction";
import { RecapAbsence } from "./RecapAbsence";

export const metadata: Metadata = { title: "Foyer" };

/** Tous les Foyers naissent en prairie (US-0152) : une seule illustration sert à tous. */
const ILLUSTRATION_DU_FOYER = { chemin: "foyer/prairie.webp", alt: "La hutte du chef, au toit de chaume et à la tête de loup, dans la prairie au petit matin" };

/** « Un Voyageur aux portes », « 2 Voyageurs aux portes ». */
const voyageursAuxPortes = (n: number) => `${n > 1 ? `${n} Voyageurs` : "Un Voyageur"} aux portes`;

/** « 1 Récit non lu », « 2 Récits non lus ». */
const recitsNonLus = (n: number) => `${n} ${n > 1 ? "Récits non lus" : "Récit non lu"}`;

/** Le médaillon de chaque écriteau : un Habitant pour ceux qui arrivent ou partent, la tablette pour les Récits. */
const ICONE_HABITANTS = "/illustrations/icones/habitants.webp";
const ICONE_RECITS = "/illustrations/metiers/chercheur.webp";

/** Un écriteau posé sur la scène : un panneau de verre orné, son médaillon, sa phrase en Marcellus et son bouton. */
const ecriteau = (...classes: string[]) => [kit.panneau, kit.verre, styles.ecriteau, ...classes].join(" ");

/**
 * L'écran du Foyer (US-0157), l'une des deux scènes pleines du jeu : la hutte du chef peinte, toute la place de l'écran
 * sous la barre du haut (sur un téléphone, en tête de la page), et posés dessus, en colonne à gauche, le Biome du Foyer en
 * grand, les écriteaux de verre de ce qui attend le chef, et le panneau de sa production horaire (US-0217). Rien d'autre :
 * le nom du chef est dans la barre du haut, et rien ne mène à une fonction qui n'existe pas encore (US-0163) ; au retour
 * d'une absence, ce que le Foyer a produit entre-temps (US-0216). Sans session, la garde mène à la connexion ; sans nom
 * de chef, à son choix.
 *
 * US-0327 : en haut, tant que le joueur n'a pas lu le Récit des départs de Famine, une ligne le signale, « 3 Habitants
 * sont partis pendant votre absence », et « Lire » mène aux Récits.
 *
 * Posés sur la scène comme des écriteaux, ce que la navigation signale déjà, lu de même : les Voyageurs qui attendent aux
 * portes (US-0332), « Voir » menant aux Habitants, et les Récits non lus (US-0324), « Lire » menant aux Récits.
 *
 * US-0810 : sous la production, le bloc « Bêtes » dit le total des Bêtes du Territoire et ouvre la page Bêtes : l'entrée
 * de son effectif, sans septième onglet dans la navigation.
 */
export default async function Foyer() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu");
  const foyer = territoireId === null ? null : await foyerDuTerritoire(getPool(), territoireId);
  const recap = territoireId === null ? { gains: [], pleins: [] } : await recapitulatifDAbsence(getPool(), territoireId, maintenant());
  const stocks = territoireId === null ? [] : await stocksDuTerritoire(getPool(), territoireId);
  const departs = territoireId === null ? null : await departsNonLus(getPool(), territoireId);
  const [voyageurs, nonLus] = territoireId === null ? [0, 0] : await Promise.all([voyageursALHeure(territoireId), recitsNonLusALHeure(territoireId)]);
  const betes = territoireId === null ? 0 : await nombreDeBetes(getPool(), territoireId);
  return (
    <main className={`${styles.page} ${foyer ? styles.avecProduction : ""}`}>
      {departs ? (
        <p className={ecriteau(styles.alerte)} data-avis="departs">
          <Medaillon src={ICONE_HABITANTS} taille="lg" />
          <strong className={styles.texteEcriteau}>{departsPendantLAbsence(departs.habitants)}</strong>{" "}
          <Link href="/jeu/recits" className={`${kit.bouton} ${kit.principal} ${styles.boutonEcriteau}`}>
            Lire
          </Link>
        </p>
      ) : null}
      <section className={styles.foyer}>
        <Illustration chemin={ILLUSTRATION_DU_FOYER.chemin} alt={ILLUSTRATION_DU_FOYER.alt} sizes="100vw" prioritaire className={styles.scene} />
        <RecapAbsence recap={recap} />
        <h1 className={styles.titre}>
          {foyer ? (
            <>
              Foyer <span className={styles.biome}>· {foyer.biome.nom.toLocaleLowerCase("fr")}</span>
            </>
          ) : (
            "Foyer"
          )}
        </h1>
      </section>
      {voyageurs > 0 ? (
        <p className={ecriteau(styles.enAvant)} data-avis="voyageurs">
          <Medaillon src={ICONE_HABITANTS} taille="lg" />
          <strong className={styles.texteEcriteau}>{voyageursAuxPortes(voyageurs)}</strong>{" "}
          <Link href="/jeu/habitants" className={`${kit.bouton} ${kit.principal} ${styles.boutonEcriteau}`}>
            Voir
          </Link>
        </p>
      ) : null}
      {nonLus > 0 ? (
        <p className={ecriteau()} data-avis="recits">
          <Medaillon src={ICONE_RECITS} taille="lg" />
          <strong className={styles.texteEcriteau}>{recitsNonLus(nonLus)}</strong>{" "}
          <Link href="/jeu/recits" className={`${kit.bouton} ${kit.secondaire} ${styles.boutonEcriteau}`}>
            Lire
          </Link>
        </p>
      ) : null}
      {foyer ? <BlocProduction biome={foyer.biome.nom} productions={stocks} /> : null}
      {foyer ? (
        <Link href="/jeu/betes" className={styles.lienBetes}>
          <Bloc titre="Bêtes" verre>
            <strong className={styles.nombreDeBetes}>{betes}</strong>
            <svg viewBox="0 0 12 12" className={styles.flecheBetes} aria-hidden="true">
              <path d="M4.5 2.5 8 6l-3.5 3.5" />
            </svg>
          </Bloc>
        </Link>
      ) : null}
    </main>
  );
}
