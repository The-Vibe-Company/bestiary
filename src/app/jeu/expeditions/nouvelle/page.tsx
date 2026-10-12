import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Bloc } from "@/components/Bloc";
import { getPool } from "@/db";
import { betesReperees } from "@/expeditions/betes-reperees";
import { casesDuFoyer } from "@/expeditions/choix-de-destination";
import { destinationDUneCase } from "@/expeditions/destination";
import { betesDisponibles } from "@/monde/effectif";
import { explorateursDuTerritoire, prochainRetourDUnExplorateur } from "@/monde/explorateurs";
import type { Fiche, FicheInconnue } from "@/monde/fiche";
import { type Coordonnees, coordonneeValable } from "@/monde/hex";
import { maintenant, vitesse } from "@/temps/horloge";
import { AucunExplorateurLibre } from "./AucunExplorateurLibre";
import { Escorte } from "./Escorte";
import { Explorateurs } from "./Explorateurs";
import styles from "./page.module.css";
import { type BeteAChercher, type DestinationChoisie, Recapitulatif } from "./Recapitulatif";
import { SansEscorte } from "./SansEscorte";
import { Sejour } from "./Sejour";
import { VersLaCarte } from "./VersLaCarte";

export const metadata: Metadata = { title: "Nouvelle Expédition" };

/** L'écran d'Expédition, où mènent la fiche d'une Case et la navigation. */
const ECRAN = "/jeu/expeditions/nouvelle";

/** Une coordonnée de l'adresse (« -5 »), si c'est un entier que la base peut tenir ; null sinon. */
function coordonnee(texte: string | string[] | undefined): number | null {
  if (typeof texte !== "string" || !/^-?\d{1,10}$/.test(texte)) return null;
  const n = Number(texte);
  return coordonneeValable(n) ? n : null;
}

/** US-0901 : la Case en paramètre de l'adresse (« ?q=3&r=-5 »), ou null si l'une de ses coordonnées manque ou est fausse. */
function caseEnParametre(recherche: { q?: string | string[]; r?: string | string[] }): Coordonnees | null {
  const [q, r] = [coordonnee(recherche.q), coordonnee(recherche.r)];
  return q === null || r === null ? null : { q, r };
}

/** US-0901 : la destination choisie : son Biome, « inconnu » sous le brouillard (US-0907), et sa distance au Foyer. */
function Destination({ fiche }: { fiche: Fiche | FicheInconnue }) {
  return (
    <dl className={styles.details}>
      <div>
        <dt>Biome</dt>
        <dd>{"inconnue" in fiche ? "inconnu" : fiche.biome}</dd>
      </div>
      <div>
        <dt>Distance</dt>
        <dd>{casesDuFoyer(fiche.distance)}</dd>
      </div>
    </dl>
  );
}

/**
 * US-0910 : d'une destination, ce que le récapitulatif en montre : son Biome (null sous le brouillard) et sa distance au
 * Foyer. US-0911 : et sa Case, que « Partir » envoie.
 */
const destinationChoisie = (fiche: Fiche | FicheInconnue): DestinationChoisie => ({
  q: fiche.q,
  r: fiche.r,
  biome: "inconnue" in fiche ? null : fiche.biome,
  distance: fiche.distance,
});

/**
 * US-0949 : les Bêtes que le joueur a repérées sur la Case `c` (betesReperees), à l'heure du jeu `instant`, telles que le
 * récapitulatif les compare à l'escorte : le nom et la force de leur Espèce, sa Rareté, et jusqu'à quand chacune devrait
 * rester.
 */
async function betesAChercher(territoireId: number, c: Coordonnees, instant: Date): Promise<BeteAChercher[]> {
  return (await betesReperees(getPool(), territoireId, instant))
    .filter((b) => b.laCase.q === c.q && b.laCase.r === c.r)
    .map(({ espece, force, rareteId, jusquA }) => ({ espece, force, rareteId, jusquA }));
}

/**
 * US-0901 : l'écran d'Expédition, une page du jeu. Depuis la fiche d'une Case, la Case est en paramètre et devient la
 * destination, lue dans le Monde du Territoire de la garde, jamais dans l'adresse, qui ne dit que la Case. Depuis la
 * navigation, sans Case, il n'a pas de destination et mène à la carte pour en choisir une ; de même pour une Case que
 * l'adresse dit mal ou que le Monde n'a pas. US-0907 : la carte s'ouvre pour choisir la destination, et la Case qu'on
 * y touche revient ici ; une destination déjà choisie se change de même. Une Case d'un Territoire, le sien (son Foyer
 * compris) ou celui d'un autre joueur, est refusée par un message, à la place de la destination. Sur un téléphone,
 * une seule colonne, et chaque choix au pouce. Sans session, la garde mène à la connexion, qui ramène ici avec la
 * même Case. US-0910 : l'écran finit sur le récapitulatif, et son départ. US-0949 : avec les Bêtes que le joueur a
 * repérées sur la Case de destination, pour qu'il compare son escorte à chacune avant de partir la chercher.
 */
export default async function NouvelleExpedition({ searchParams }: PageProps<"/jeu/expeditions/nouvelle">) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const laCase = caseEnParametre(await searchParams);
  const { territoireId } = await exigerCompte(laCase ? `${ECRAN}?q=${laCase.q}&r=${laCase.r}` : ECRAN);
  const destination = laCase && territoireId !== null ? await destinationDUneCase(getPool(), territoireId, laCase) : null;
  // US-0902 : les explorateurs libres sur total, lus à chaque affichage ; aucun pour un chef sans Territoire.
  const explorateurs = territoireId !== null ? await explorateursDuTerritoire(getPool(), territoireId) : { libres: 0, total: 0 };
  // US-0903 : sans explorateur libre, un message à la place du formulaire ; l'heure du prochain retour si tous sont partis.
  if (explorateurs.libres === 0) {
    const prochainRetour = explorateurs.total > 0 && territoireId !== null ? await prochainRetourDUnExplorateur(getPool(), territoireId) : null;
    return (
      <main className={styles.page}>
        <h1 className={styles.titre}>Nouvelle Expédition</h1>
        <AucunExplorateurLibre total={explorateurs.total} prochainRetour={prochainRetour} />
      </main>
    );
  }
  // US-0904 : les Bêtes disponibles pour l'escorte, par Espèce, lues à chaque affichage du formulaire.
  const escorte = territoireId !== null ? await betesDisponibles(getPool(), territoireId) : [];
  const instant = maintenant();
  const choisie = destination && "fiche" in destination ? destinationChoisie(destination.fiche) : null;
  // US-0949 : les Bêtes repérées sur la Case de destination ; aucune sans destination.
  const betes = choisie && territoireId !== null ? await betesAChercher(territoireId, choisie, instant) : [];
  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Nouvelle Expédition</h1>
      <Bloc titre="Destination">
        {destination && "fiche" in destination ? (
          <>
            <Destination fiche={destination.fiche} />
            <VersLaCarte className={`${styles.choisir} ${styles.changer}`}>Changer de destination</VersLaCarte>
          </>
        ) : (
          <>
            {destination ? <p className={styles.refus}>{destination.refus}</p> : <p className={styles.aucune}>Aucune destination</p>}
            <VersLaCarte className={styles.choisir}>Choisir sur la carte</VersLaCarte>
          </>
        )}
      </Bloc>
      <Explorateurs {...explorateurs} />
      {/* US-0909 : sans Bête disponible, pas d'escorte à choisir : l'Expédition part sans, et l'écran le dit à sa place. */}
      {escorte.length > 0 ? <Escorte especes={escorte} /> : <SansEscorte />}
      <Sejour />
      {/* US-0910 : tout ce qui a été choisi, à relire avant de partir, à l'heure et au rythme du jeu ; rien d'une Case refusée. */}
      <Recapitulatif libres={explorateurs.libres} especes={escorte} destination={choisie} betes={betes} maintenant={instant} vitesse={vitesse()} />
    </main>
  );
}
