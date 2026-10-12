import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { getPool } from "@/db";
import { couplesDuTerritoire } from "@/monde/couple";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Réserve" };

/**
 * US-0801 : la Réserve du Territoire, qu'ouvre son entrée de la navigation : le lieu protégé où vivent les Couples réunis
 * (US-0956), à l'abri, loin des combats, et combien elle en abrite. La liste des Couples arrive avec US-0802, la Réserve
 * vide avec US-0809. Sans session, la garde mène à la connexion, qui ramène ici.
 */
export default async function Reserve() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/reserve");
  const couples = territoireId === null ? [] : await couplesDuTerritoire(getPool(), territoireId);
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Réserve</h1>
      <Bloc>
        <p className={styles.lieu}>Le lieu protégé de votre Territoire : vos Couples y vivent à l&apos;abri, loin des combats.</p>
        <p className={styles.couples}>
          <strong className={styles.nombre}>{couples.length}</strong> {couples.length > 1 ? "Couples" : "Couple"}
        </p>
      </Bloc>
    </main>
  );
}
