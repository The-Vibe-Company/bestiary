import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { getPool } from "@/db";
import { betesReperees } from "@/expeditions/betes-reperees";
import { versLEcran } from "@/expeditions/choix-de-destination";
import { RETOUR_D_EXPEDITION, resumeDUnRetour } from "@/expeditions/resume-du-retour";
import { type Recit, type RencontreRacontee, recitsDuTerritoire } from "@/monde/recits";
import { PRESENCE_D_UNE_BETE_HEURES } from "@/reglages";
import { formaterHeure, formaterInstant, formaterJourEtHeure } from "@/temps/affichage";
import { maintenant } from "@/temps/horloge";
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

/** US-0949 : une Bête par sa Case et son numéro sur sa Case : « 3,-5,7 ». */
const cle = (laCase: { q: number; r: number }, numero: number) => `${laCase.q},${laCase.r},${numero}`;

/**
 * US-0949 : les Bêtes restées sur leur Case que racontent les Récits `recits` et que le joueur a encore repérées à l'heure
 * du jeu `instant` (betesReperees), par leur clé. Aucune lecture quand aucun Récit ne mène à la Case d'une Bête restée
 * vue depuis moins longtemps que sa présence (PRESENCE_D_UNE_BETE_HEURES) : vue avant, elle est forcément partie.
 */
async function encoreReperees(territoireId: number, recits: Recit[], instant: Date): Promise<Set<string>> {
  const depuis = instant.getTime() - PRESENCE_D_UNE_BETE_HEURES * 3_600_000;
  if (!recits.some((r) => r.rencontres?.some((x) => x.laCase && x.vueLe.getTime() > depuis))) return new Set();
  return new Set((await betesReperees(getPool(), territoireId, instant)).map((b) => cle(b.laCase, b.numero)));
}

/** US-0949 : l'écran d'Expédition qui revient chercher la Bête restée de la Rencontre `r`, si elle est encore repérée. */
function revenir({ issue, laCase, numero }: RencontreRacontee, reperees: Set<string>): string | undefined {
  return issue === "restee" && laCase && numero !== undefined && reperees.has(cle(laCase, numero)) ? versLEcran(laCase) : undefined;
}

/**
 * La page Récits (US-0324), ouverte depuis la navigation : ce qui est arrivé sur le Territoire, du plus
 * récent au plus ancien, chaque Récit avec sa date et son heure. Sans session, la garde mène à la
 * connexion, qui ramène ici. US-0949 : une Bête restée sur sa Case, que le joueur a encore repérée, mène à l'écran
 * d'Expédition qui revient la chercher.
 */
export default async function Recits() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/recits");
  const recits = territoireId === null ? [] : await recitsDuTerritoire(getPool(), territoireId);
  const reperees = territoireId === null ? new Set<string>() : await encoreReperees(territoireId, recits, maintenant());
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
              // US-0958 : les Couples que ce retour a réunis, annoncés en tête de son récit.
              ...(r.couples && { couples: r.couples.map(({ nom, illustration }) => ({ nom, illustration })) }),
              // US-0940 : les Rencontres d'un retour d'Expédition, chacune à son heure.
              ...(r.rencontres && {
                rencontres: r.rencontres.map((rencontre, i, toutes) => {
                  const { vueLe, nom, illustration, rarete, issue, repartieLe, sexe, nouvelleEspece, manque } = rencontre;
                  const versLaBete = revenir(rencontre, reperees);
                  return {
                    instant: vueLe.toISOString(),
                    heure: heureDUneRencontre(vueLe, i === 0 ? r.survenuLe : toutes[i - 1].vueLe),
                    nom,
                    illustration,
                    rarete,
                    issue,
                    // US-0950 : repartie, l'heure de son départ, et son jour s'il n'est plus celui de la Rencontre.
                    ...(repartieLe && {
                      repartie: { instant: repartieLe.toISOString(), heure: heureDUneRencontre(repartieLe, vueLe), autreJour: jour(repartieLe) !== jour(vueLe) },
                    }),
                    sexe,
                    nouvelleEspece,
                    ...(manque && { manque }),
                    // US-0949 : restée et encore repérée, l'écran d'Expédition qui revient la chercher.
                    ...(versLaBete && { revenir: versLaBete }),
                  };
                }),
              }),
            }))}
          />
        )}
      </Bloc>
    </main>
  );
}
