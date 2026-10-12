import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { Illustration } from "@/components/Illustration";
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

/**
 * L'écran du Foyer (US-0157) : la hutte du chef en grand, et le Biome du Foyer posé dessus. Rien
 * d'autre : le nom du chef est dans la barre du haut, et rien ne mène à une fonction qui n'existe
 * pas encore (US-0163) ; au retour d'une absence, ce que le Foyer a produit entre-temps (US-0216) ;
 * à côté, ou dessous sur mobile, sa production horaire (US-0217). Sans session, la garde mène à la
 * connexion ; sans nom de chef, à son choix.
 *
 * US-0327 : en haut, tant que le joueur n'a pas lu le Récit des départs de Famine, une ligne le signale, « 3 Habitants
 * sont partis pendant votre absence », et « Lire » mène aux Récits.
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
  const betes = territoireId === null ? 0 : await nombreDeBetes(getPool(), territoireId);
  return (
    <main className={`${styles.page} ${foyer ? styles.avecProduction : ""}`}>
      {departs ? (
        <p className={styles.departs}>
          <strong className={styles.nombreDeDeparts}>{departsPendantLAbsence(departs.habitants)}</strong>{" "}
          <Link href="/jeu/recits" className={styles.lireDeparts}>
            Lire
          </Link>
        </p>
      ) : null}
      <section className={styles.foyer}>
        <Illustration
          chemin={ILLUSTRATION_DU_FOYER.chemin}
          alt={ILLUSTRATION_DU_FOYER.alt}
          sizes="(max-width: 1180px) 100vw, 1180px"
          prioritaire
          className={styles.remplir}
        />
        <RecapAbsence recap={recap} />
        <h1 className={styles.legende}>{foyer ? `Foyer · ${foyer.biome.nom.toLocaleLowerCase("fr")}` : "Foyer"}</h1>
      </section>
      {foyer ? (
        <div className={styles.cote}>
          <BlocProduction biome={foyer.biome.nom} productions={stocks} />
          <Link href="/jeu/betes" className={styles.lienBetes}>
            <Bloc titre="Bêtes">
              <strong className={styles.nombreDeBetes}>{betes}</strong>
            </Bloc>
          </Link>
        </div>
      ) : null}
    </main>
  );
}
