import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import kit from "@/components/kit.module.css";
import { Paysage } from "@/components/Paysage";
import { getPool } from "@/db";
import { expeditionsEnCours } from "@/expeditions/en-cours";
import { maintenant, vitesse } from "@/temps/horloge";
import { ListeDesExpeditions } from "./ListeDesExpeditions";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Expéditions en cours" };

/**
 * US-0911 : la liste des Expéditions en cours, où mène un départ : chacune y apparaît aussitôt partie, à l'aller, avec sa
 * destination (son Biome, ou « Case inconnue » sous le brouillard) et sa distance au Foyer ; sa phase se lit à l'heure du
 * jeu. Sans session, la garde mène à la connexion, qui ramène ici.
 *
 * US-0918 : toutes les Expéditions en cours au même endroit, chacune son grand panneau illustré (PanneauDeLExpedition) :
 * le paysage de sa destination, sa phase, son temps restant, ses explorateurs, son escorte et son retour prévu, lus à
 * l'heure du jeu, puis en direct, au rythme du jeu, sans recharger la page (ListeDesExpeditions). Sans Expédition en
 * cours, un panneau : les explorateurs en route, « Aucune Expédition en cours » et un bouton vers l'écran d'Expédition
 * pour en préparer une.
 */
export default async function ExpeditionsEnCours() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  // US-0916 : l'heure de la lecture, prise avant la mise à l'heure du Territoire : une Expédition encore listée rentre
  // toujours après elle, et la liste se relit à son retour.
  const instant = maintenant();
  const { territoireId } = await exigerCompte("/jeu/expeditions");
  const expeditions = territoireId === null ? [] : await expeditionsEnCours(getPool(), territoireId, instant);
  return (
    <main className={styles.page}>
      <div className={kit.enTeteEcran}>
        <h1 className={kit.titreEcran}>Expéditions en cours</h1>
      </div>
      {expeditions.length === 0 ? (
        <section className={`${kit.panneau} ${styles.aucune}`}>
          <Paysage peinture="accueil/explorateurs.webp" sizes="(max-width: 760px) 100vw, 640px" className={styles.paysage} />
          <p className={styles.vide}>Aucune Expédition en cours</p>
          <Link href="/jeu/expeditions/nouvelle" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.preparer}`}>
            Préparer une Expédition
          </Link>
        </section>
      ) : (
        <ListeDesExpeditions expeditions={expeditions} maintenant={instant} vitesse={vitesse()} />
      )}
    </main>
  );
}
