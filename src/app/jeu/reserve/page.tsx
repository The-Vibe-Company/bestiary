import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import kit from "@/components/kit.module.css";
import { PastilleRarete } from "@/components/PastilleRarete";
import { Paysage } from "@/components/Paysage";
import { getPool } from "@/db";
import { couplesEnReserve } from "@/monde/couple";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Réserve" };

/**
 * US-0801 : la Réserve du Territoire, qu'ouvre son entrée de la navigation : le lieu protégé où vivent les Couples réunis
 * (US-0956), à l'abri, loin des combats, et combien elle en abrite. Sans session, la garde mène à la connexion, qui ramène
 * ici.
 *
 * US-0802 : dessous, chaque Couple réuni, du premier au dernier : ses deux Bêtes, sous l'illustration de leur Espèce,
 * puis son nom et sa Rareté ; le sexe ne s'y dit pas. Un lecteur d'écran lit la paire d'un seul nom, « Poule, deux
 * Bêtes ». Seule la Réserve du joueur connecté : la page ne prend rien de l'adresse, et ne lit que le Territoire de sa
 * session. US-0803 : toucher un Couple ouvre la fiche de son Espèce (/jeu/reserve/<Espèce>).
 *
 * US-0809 : tant qu'aucun Couple n'est réuni, la Réserve, sobre, dit seulement « Aucun Couple pour l'instant », sans autre
 * phrase, avec un bouton « Envoyer une Expédition » vers l'écran d'Expédition (US-0901) ; dès le premier Couple, la
 * présentation, le nombre et la liste prennent leur place.
 *
 * Sur le fond du jeu : le titre de l'écran, puis un panneau orné, les castors à l'abri en bandeau, la présentation et le
 * nombre en grand ; dessous, une carte ornée par Couple, ses deux Bêtes peintes côte à côte, son nom en Bree Serif et sa
 * Rareté en puce. Vide, le même panneau, le mot et le bouton principal, comme les Expéditions en cours.
 */
export default async function Reserve() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/reserve");
  const couples = territoireId === null ? [] : await couplesEnReserve(getPool(), territoireId);
  return (
    <main className={styles.page}>
      <h1 className={`${kit.titreEcran} ${styles.titre}`}>Réserve</h1>
      {couples.length === 0 ? (
        <section className={`${kit.panneau} ${styles.aucun}`}>
          <Paysage peinture="accueil/castors.webp" sizes="(max-width: 760px) 100vw, 640px" className={styles.paysage} />
          <p className={styles.vide}>Aucun Couple pour l&apos;instant</p>
          <Link href="/jeu/expeditions/nouvelle" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.envoyer}`}>
            Envoyer une Expédition
          </Link>
        </section>
      ) : (
        <section className={`${kit.panneau} ${styles.abri}`}>
          <Paysage peinture="accueil/castors.webp" sizes="(max-width: 760px) 100vw, 280px" className={`${kit.vignette} ${styles.bandeau}`} />
          <p className={styles.lieu}>Le lieu protégé de votre Territoire : vos Couples y vivent à l&apos;abri, loin des combats.</p>
          <p className={styles.couples}>
            <strong className={styles.nombre}>{couples.length}</strong> {couples.length > 1 ? "Couples" : "Couple"}
          </p>
        </section>
      )}
      {couples.length > 0 ? (
        <ul className={styles.liste} aria-label="Couples">
          {couples.map((couple) => (
            <li key={couple.especeId}>
              <Link href={`/jeu/reserve/${couple.especeId}`} className={`${kit.panneau} ${styles.lien}`} aria-label={`${couple.nom}, ${couple.rarete.nom}`}>
                <div className={styles.betes} role="img" aria-label={`${couple.nom}, deux Bêtes`}>
                  <IllustrationEspece espece={couple} format="paire" className={`${kit.vignette} ${styles.bete}`} />
                  <IllustrationEspece espece={couple} format="paire" className={`${kit.vignette} ${styles.bete}`} />
                </div>
                <p className={styles.espece}>
                  <span className={`${kit.titreServif} ${styles.nom}`}>{couple.nom}</span>
                  <PastilleRarete rarete={couple.rarete} />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
