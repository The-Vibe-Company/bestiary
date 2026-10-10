import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { getPool } from "@/db";
import { RETOUR_D_EXPEDITION, resumeDUnRetour } from "@/expeditions/resume-du-retour";
import { recitsDuTerritoire } from "@/monde/recits";
import { formaterHeure, formaterInstant, formaterJourEtHeure } from "@/temps/affichage";
import { ListeDesRecits } from "./ListeDesRecits";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Récits" };

/** Le fuseau des dates, comme sur la page de contrôle, en attendant celui de chaque joueur. */
const FUSEAU = "Europe/Paris";

/** Le jour d'un instant dans le fuseau du joueur, pour comparer deux instants. */
const jour = (instant: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: FUSEAU }).format(instant);

/**
 * US-0940 : l'heure d'une Rencontre, « 14:05 » ; un séjour peut passer minuit, d'où son jour aussi, « 12 octobre à
 * 14:05 », quand il n'est plus celui de la Rencontre d'avant, ou du retour pour la première (`reference`).
 */
function heureDUneRencontre(vueLe: Date, reference: Date): string {
  return jour(vueLe) === jour(reference) ? formaterHeure(vueLe, FUSEAU) : formaterJourEtHeure(vueLe, FUSEAU);
}

/**
 * La page Récits (US-0324), ouverte depuis la navigation : ce qui est arrivé sur le Territoire, du plus
 * récent au plus ancien, chaque Récit avec sa date et son heure. Sans session, la garde mène à la
 * connexion, qui ramène ici.
 */
export default async function Recits() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/recits");
  const recits = territoireId === null ? [] : await recitsDuTerritoire(getPool(), territoireId);
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Récits</h1>
      <Bloc>
        {recits.length === 0 ? (
          <p className={styles.vide}>Rien à raconter pour l&apos;instant.</p>
        ) : (
          <ListeDesRecits
            recits={recits.map((r) => ({
              id: r.id,
              titre: r.titre,
              texte: r.texte,
              instant: r.survenuLe.toISOString(),
              quand: formaterInstant(r.survenuLe, FUSEAU),
              lu: r.luLe !== null,
              // US-0941 : un retour d'Expédition se résume en une ligne, en tête de son récit, qu'il ait vu des Bêtes ou non ;
              // sans combat (US-0944), son escorte ne perd encore aucune Bête.
              ...(r.titre === RETOUR_D_EXPEDITION && { resume: resumeDUnRetour(r.rencontres ?? [], 0) }),
              // US-0940 : les Rencontres d'un retour d'Expédition, chacune à son heure.
              ...(r.rencontres && {
                rencontres: r.rencontres.map(({ vueLe, nom, illustration, rarete, issue, sexe, nouvelleEspece, manque }, i, toutes) => ({
                  instant: vueLe.toISOString(),
                  heure: heureDUneRencontre(vueLe, i === 0 ? r.survenuLe : toutes[i - 1].vueLe),
                  nom,
                  illustration,
                  rarete,
                  issue,
                  sexe,
                  nouvelleEspece,
                  ...(manque && { manque }),
                })),
              }),
            }))}
          />
        )}
      </Bloc>
    </main>
  );
}
