import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte, PAGE_ARRIVEE } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { BOUTON_ENTREE, PageEntree } from "@/components/PageEntree";
import { getPool } from "@/db";
import { betesDeNaissancePresentes } from "@/monde/betes-de-naissance";
import { foyerDuTerritoire } from "@/monde/territoire";
import { maintenant } from "@/temps/horloge";
import styles from "../../entree.module.css";
import { entrerDansLeFoyer } from "./actions";
import { recitDArrivee } from "./recit";

export const metadata: Metadata = { title: "Arrivée" };

/**
 * Le récit d'arrivée (US-0158), juste après le nom de chef : le nom du chef, la prairie, la Couronne
 * au bord du Monde, et un bouton vers le Foyer. Il reste là tant que le joueur n'est pas entré dans
 * son Foyer ; ensuite, y revenir mène droit au Foyer. US-0975 : tant que ses Bêtes de naissance sont
 * là, il dit qu'elles rôdent dans les abords, sans dire où.
 */
export default async function Arrivee() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { nomDeChef, territoireId, recitLu } = await exigerCompte(PAGE_ARRIVEE);
  const [foyer, betes] =
    territoireId === null || recitLu
      ? [null, 0]
      : await Promise.all([foyerDuTerritoire(getPool(), territoireId), betesDeNaissancePresentes(getPool(), territoireId, maintenant())]);
  if (!foyer) redirect("/jeu");
  return (
    <PageEntree titre={`${nomDeChef}.`} illustration={{ chemin: "accueil/plateau.webp", alt: "Le monde de Bestia, sculpté comme un plateau de jeu" }}>
      <p className={styles.recit}>{recitDArrivee(foyer.monde, betes > 0)}</p>
      <form action={entrerDansLeFoyer} className={styles.action}>
        <button type="submit" className={`${BOUTON_ENTREE} ${styles.envoyer}`}>
          Entrer dans mon Foyer
        </button>
      </form>
    </PageEntree>
  );
}
