import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import { PastilleRarete } from "@/components/PastilleRarete";
import { getPool } from "@/db";
import { especeDuTerritoire } from "@/monde/effectif";
import styles from "./page.module.css";

// Le titre reste celui de la Réserve : le nom d'une Espèce ne se lit pas sans la garde.
export const metadata: Metadata = { title: "Réserve" };

/** US-0803 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« souris », « peu_commune »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/**
 * US-0803 : la fiche de l'Espèce d'un Couple de la Réserve, qu'ouvre sa carte : son illustration en grand, son nom en
 * titre et sa Rareté, sur la pastille de ses couleurs. « Fermer » ramène à la Réserve. Seulement pour une Espèce dont le
 * joueur a réuni le Couple ou, US-0810, a des Bêtes : toute autre adresse est introuvable, sans dire si un autre joueur en
 * a. Ses caractéristiques arrivent avec US-0804 à US-0806.
 *
 * US-0810 : elle s'ouvre aussi depuis la page Bêtes (especeDuTerritoire), et rappelle l'effectif de l'Espèce, vide quand
 * ses seules Bêtes forment le Couple. Ouverte depuis la page Bêtes (`?depuis=betes`), « Fermer » y ramène.
 */
export default async function FicheDeLEspece({
  params,
  searchParams,
}: {
  params: Promise<{ espece: string }>;
  searchParams: Promise<{ depuis?: string | string[] }>;
}) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { espece } = await params;
  if (!IDENTIFIANT.test(espece)) notFound();
  const { territoireId } = await exigerCompte(`/jeu/reserve/${espece}`);
  // US-0810 : l'Espèce de la fiche, dont le joueur a réuni le Couple ou a des Bêtes, avec son effectif.
  const fiche = territoireId === null ? null : await especeDuTerritoire(getPool(), territoireId, espece);
  if (!fiche) notFound();
  const retour = (await searchParams).depuis === "betes" ? "/jeu/betes" : "/jeu/reserve";
  return (
    <main className={styles.page}>
      <article className={styles.fiche}>
        <IllustrationEspece espece={fiche} format="grand" className={styles.illustration} />
        <div className={styles.entete}>
          <h1 className={styles.nom}>{fiche.nom}</h1>
          <PastilleRarete rarete={fiche.rarete} />
          <p className={styles.effectif}>
            <span>Effectif</span> <strong className={styles.nombre}>{fiche.effectif}</strong>
          </p>
        </div>
        <Link href={retour} className={styles.fermer}>
          Fermer
        </Link>
      </article>
    </main>
  );
}
