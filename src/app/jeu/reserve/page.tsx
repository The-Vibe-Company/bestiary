import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import { PastilleRarete } from "@/components/PastilleRarete";
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
 */
export default async function Reserve() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/reserve");
  const couples = territoireId === null ? [] : await couplesEnReserve(getPool(), territoireId);
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Réserve</h1>
      {couples.length === 0 ? (
        <Bloc>
          <p className={styles.vide}>Aucun Couple pour l&apos;instant</p>
          <Link href="/jeu/expeditions/nouvelle" className={styles.envoyer}>
            Envoyer une Expédition
          </Link>
        </Bloc>
      ) : (
        <Bloc>
          <p className={styles.lieu}>Le lieu protégé de votre Territoire : vos Couples y vivent à l&apos;abri, loin des combats.</p>
          <p className={styles.couples}>
            <strong className={styles.nombre}>{couples.length}</strong> {couples.length > 1 ? "Couples" : "Couple"}
          </p>
        </Bloc>
      )}
      {couples.length > 0 ? (
        <ul className={styles.liste} aria-label="Couples">
          {couples.map((couple) => (
            <li key={couple.especeId}>
              <Link href={`/jeu/reserve/${couple.especeId}`} className={styles.lien} aria-label={`${couple.nom}, ${couple.rarete.nom}`}>
                <Bloc className={styles.couple}>
                  <div className={styles.betes} role="img" aria-label={`${couple.nom}, deux Bêtes`}>
                    <IllustrationEspece espece={couple} format="paire" className={styles.bete} />
                    <IllustrationEspece espece={couple} format="paire" className={styles.bete} />
                  </div>
                  <p className={styles.espece}>
                    <span className={styles.nom}>{couple.nom}</span>
                    <PastilleRarete rarete={couple.rarete} />
                  </p>
                </Bloc>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
