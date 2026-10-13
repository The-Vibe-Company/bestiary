import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import kit from "@/components/kit.module.css";
import { Paysage } from "@/components/Paysage";
import { getPool } from "@/db";
import { type SortDuVoyageur, voyageursPasses } from "@/monde/voyageurs";
import { formaterInstant } from "@/temps/affichage";
import { maintenant } from "@/temps/horloge";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Voyageurs" };

/** Le fuseau des dates, comme sur la page Récits, en attendant celui de chaque joueur. */
const FUSEAU = "Europe/Paris";

/** US-0342 : le sort d'un Voyageur, tel que sa ligne le dit. */
const SORTS: Record<SortDuVoyageur, string> = { accueilli: "accueilli", refuse: "refusé", reparti: "reparti" };

/**
 * La page Voyageurs (US-0342), ouverte par « Historique » depuis la partie « Aux portes » de la page Habitants : sur le
 * fond du jeu, à la marge des autres écrans, le titre, puis un panneau orné de toute la largeur ; à gauche, la hutte au
 * bout de son chemin, peinte en bandeau, et sous elle les Voyageurs accueillis et les Voyageurs perdus, refusés ou repartis
 * d'eux-mêmes, en grands nombres ; à droite, une ligne par Voyageur passé, du plus récent sort au plus ancien, avec son
 * prénom, l'heure de son arrivée et son sort, en pastille, en colonnes alignées ; le tout sur les
 * HISTORIQUE_VOYAGEURS_JOURS derniers jours de jeu. Sans session, la garde mène à la connexion, qui ramène ici.
 */
export default async function Voyageurs() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/habitants/voyageurs");
  const passes = territoireId === null ? [] : await voyageursPasses(getPool(), territoireId, maintenant());
  const accueillis = passes.filter((v) => v.sort === "accueilli").length;
  return (
    <main className={styles.page}>
      <h1 className={`${kit.titreEcran} ${styles.titre}`}>Voyageurs</h1>
      <section className={`${kit.panneau} ${styles.registre}`}>
        <Paysage peinture="entree/connexion.webp" sizes="(max-width: 1023px) 100vw, 340px" className={`${kit.vignette} ${styles.portes}`} />
        <dl className={styles.compteurs}>
          <div className={styles.compteur}>
            <dt className={kit.etiquette}>Accueillis</dt>
            <dd className={kit.nombre}>{accueillis}</dd>
          </div>
          <div className={styles.compteur}>
            <dt className={kit.etiquette}>Perdus</dt>
            <dd className={kit.nombre}>{passes.length - accueillis}</dd>
          </div>
        </dl>
        {passes.length === 0 ? (
          <p className={styles.vide}>Aucun Voyageur n&apos;est encore passé.</p>
        ) : (
          <ul className={styles.voyageurs}>
            {passes.map((v) => (
              <li key={v.id} className={styles.voyageur} data-sort={v.sort}>
                <span className={styles.prenom}>{v.prenom}</span>
                <span className={styles.arrivee}>
                  arrivé le <time dateTime={v.arriveLe.toISOString()}>{formaterInstant(v.arriveLe, FUSEAU)}</time>
                </span>
                <span className={`${kit.puce} ${styles.sort}`}>{SORTS[v.sort]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
