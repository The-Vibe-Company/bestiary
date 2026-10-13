import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { PastilleRarete } from "@/components/PastilleRarete";
import { Paysage } from "@/components/Paysage";
import { PlacesDeLHabitat } from "@/components/PlacesDeLHabitat";
import { getPool } from "@/db";
import { effectifParEspece } from "@/monde/effectif";
import { placesDeLHabitat } from "@/monde/habitat";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Bêtes" };

/** « 1 Bête », « 12 Bêtes ». */
const betes = (nombre: number) => (nombre > 1 ? "Bêtes" : "Bête");

/**
 * US-0810 : la page Bêtes, qu'ouvre le bloc « Bêtes » du Foyer : le total des Bêtes du joueur en haut, puis chaque Espèce
 * de son effectif (effectifParEspece), de la plus commune à la plus rare : sa vignette, son nom, sa Rareté et son
 * effectif. Les Bêtes d'un Couple, en Réserve, n'y comptent pas. Toucher une Espèce ouvre sa fiche (US-0803), qui se
 * referme ici. Sans session, la garde mène à la connexion, qui ramène ici.
 *
 * US-0811 : tant que le joueur n'a aucune Bête, la page, sobre, dit seulement « Aucune Bête pour l'instant », sans autre
 * phrase, avec un bouton « Envoyer une Expédition » vers l'écran d'Expédition (US-0901), comme la Réserve vide (US-0809) ;
 * dès la première Bête ramenée, le total et la liste prennent leur place.
 *
 * US-0822 : sous le total, « Places : occupées / total » pour l'Habitat du Foyer (placesDeLHabitat) ; pas sur la page
 * vide, qui n'a pas d'autre phrase.
 *
 * Sur le fond du jeu, à la marge des autres écrans : le titre de l'écran, puis un panneau orné en bandeau, le mammouth
 * peint à droite, fondu vers la gauche, où se lisent le total en grand et les Places et leur jauge fine (qui ne sert
 * qu'aux yeux) ; dessous, l'effectif en cartes ornées, autant par ligne que la largeur en tient : la peinture de l'Espèce,
 * son nom en Bree Serif, sa Rareté en puce et son effectif en grand. Vide, le mammouth remplit le panneau, le mot et le
 * bouton principal à sa gauche, comme la Réserve vide.
 */
export default async function Betes() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/betes");
  const especes = territoireId === null ? [] : await effectifParEspece(getPool(), territoireId);
  const total = especes.reduce((somme, espece) => somme + espece.effectif, 0);
  const places = territoireId === null || especes.length === 0 ? null : await placesDeLHabitat(getPool(), territoireId);
  return (
    <main className={styles.page}>
      <h1 className={`${kit.titreEcran} ${styles.titre}`}>Bêtes</h1>
      {especes.length === 0 ? (
        <section className={`${kit.panneau} ${styles.aucune}`}>
          <Paysage peinture="accueil/mammouth.webp" sizes="(max-width: 820px) 100vw, 75vw" className={styles.paysage} />
          <p className={styles.vide}>Aucune Bête pour l&apos;instant</p>
          <Link href="/jeu/expeditions/nouvelle" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.envoyer}`}>
            Envoyer une Expédition
          </Link>
        </section>
      ) : (
        <section className={`${kit.panneau} ${styles.bilan}`}>
          <Paysage peinture="accueil/mammouth.webp" sizes="(max-width: 820px) 60vw, 70vw" className={styles.bandeau} />
          <p className={styles.total}>
            <strong className={styles.nombre}>{total}</strong> {betes(total)}
          </p>
          {places ? (
            <div className={styles.places}>
              <PlacesDeLHabitat {...places} />
              <Jauge valeur={Math.ceil(places.occupees)} max={places.total} fine />
            </div>
          ) : null}
        </section>
      )}
      {especes.length > 0 ? (
        <ul className={styles.especes} aria-label="Effectif">
          {especes.map((espece) => (
            <li key={espece.especeId}>
              <Link
                href={`/jeu/reserve/${espece.especeId}?depuis=betes`}
                className={`${kit.panneau} ${styles.espece}`}
                aria-label={`${espece.nom}, ${espece.rarete.nom}, ${espece.effectif} ${betes(espece.effectif)}`}
              >
                <IllustrationEspece espece={espece} format="carte" className={`${kit.vignette} ${styles.peinture}`} />
                <span className={styles.identite}>
                  <span className={`${kit.titreServif} ${styles.nom}`}>{espece.nom}</span>
                  <PastilleRarete rarete={espece.rarete} />
                </span>
                <span className={styles.effectif}>{espece.effectif}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
