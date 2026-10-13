import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte, famineALHeure, famineImminenteALHeure, stocksALHeure } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { iconeDeRessource } from "@/components/icone-de-ressource";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { getPool } from "@/db";
import { type EntretienDesHabitants, entretienDesHabitants, habitantsDuTerritoire, placesDuTerritoire } from "@/monde/habitants";
import { iconeDeMetier, lesMetiers } from "@/monde/metiers";
import { nourriturePourEncore, tenueDeLaNourriture } from "@/monde/nourriture";
import { quantiteAffichee, quantiteExacte, soldeAffiche, soldeEnMots, soldeHoraire } from "@/monde/quantite";
import type { Stock } from "@/monde/stocks";
import { avertissementDeFamine, voyageursAuxPortes } from "@/monde/voyageurs";
import { maintenant, vitesse } from "@/temps/horloge";
import { AuxPortes } from "./AuxPortes";
import { ListeDesHabitants } from "./ListeDesHabitants";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Habitants" };

/** Le fuseau des dates, comme sur les pages Récits et Voyageurs, en attendant celui de chaque joueur. */
const FUSEAU = "Europe/Paris";

/** La date d'arrivée d'un Habitant, sans l'heure : « 2 octobre 2026 ». */
const DATE_D_ARRIVEE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU });

/** « 1 Habitant », « 3 Habitants ». */
function nombreDHabitants(nombre: number): string {
  return `${nombre} ${nombre > 1 ? "Habitants" : "Habitant"}`;
}

/** US-0305 : « 3 Habitants sur 5 places », « 1 Habitant sur 1 place ». */
function habitantsSurPlaces(habitants: number, places: number): string {
  return `${nombreDHabitants(habitants)} sur ${places} ${places > 1 ? "places" : "place"}`;
}

/** Le triangle d'alerte, devant ce qui manque. */
function Alerte() {
  return (
    <svg viewBox="0 0 12 12" className={styles.signe} aria-hidden="true">
      <path d="M6 1.4 11 10.4H1z" />
      <path d="M6 4.6v2.8" />
      <circle cx="6" cy="8.9" r=".75" />
    </svg>
  );
}

/** La coche, devant ce qui va bien. */
function Coche() {
  return (
    <svg viewBox="0 0 12 12" className={styles.signe} aria-hidden="true">
      <path d="M2.5 6.3 5 8.6 9.6 3.6" />
    </svg>
  );
}

/**
 * US-0305 : la place du Territoire : en grand, les Habitants sur les places, « Plus de place » quand elle est toute prise ;
 * une case par place, la jauge ; dessous, la phrase, « 24 Habitants sur 26 places », qui dit tout à un lecteur d'écran.
 */
function Place({ habitants, places }: { habitants: number; places: number }) {
  const plein = habitants >= places;
  return (
    <div className={`${kit.panneau} ${styles.place}`} data-plein={plein ? "" : undefined}>
      <div className={styles.hautDeLaPlace}>
        <p className={styles.compteDesPlaces} aria-hidden="true">
          <span className={kit.nombre}>{habitants}</span> / {places}
        </p>
        {plein ? (
          <p className={kit.marque}>
            <Alerte />
            Plus de place
          </p>
        ) : null}
      </div>
      <Jauge valeur={habitants} max={places} cases />
      <p className={styles.nombre}>{habitantsSurPlaces(habitants, places)}</p>
    </div>
  );
}

/**
 * US-0318 : l'Entretien des Habitants : la ligne du calcul, « 3 Habitants × 2 Nourriture = », puis le total ; dessous, la
 * Viande et les Végétaux qui le paient, leur quantité et leur solde par heure, comme la barre du haut les compte (US-0319) ;
 * US-0320 : enfin, combien de temps la Nourriture le paiera encore, au rythme du moment : « Nourriture assurée », ou
 * « Nourriture pour encore 7 h », en alerte.
 */
function Entretien({ entretien, stocks }: { entretien: EntretienDesHabitants; stocks: Stock[] }) {
  const nourriture = stocks.filter((s) => s.famille === "nourriture");
  const [viande, vegetaux] = nourriture.map((s) => ({ quantite: Number(s.quantite), parHeure: Number(s.parHeure), limite: Number(s.limite) }));
  const heures = viande && vegetaux ? nourriturePourEncore(viande, vegetaux, Number(entretien.parHeure)) : null;
  return (
    <section className={`${kit.panneau} ${styles.entretien}`} data-alerte={heures === null ? undefined : ""}>
      <h2 className={kit.etiquette}>Entretien</h2>
      <p className={styles.ligneEntretien}>
        {`${nombreDHabitants(entretien.habitants)} × ${quantiteExacte(String(entretien.parHabitant))} Nourriture = `}
        <strong className={styles.totalEntretien}>{`${quantiteExacte(entretien.parHeure)} Nourriture par heure`}</strong>
      </p>
      {nourriture.length > 0 ? (
        <ul className={styles.nourriture}>
          {nourriture.map((s) => {
            const solde = soldeHoraire(s.parHeure, s.entretienParHeure);
            return (
              <li key={s.id} className={styles.stock}>
                <Medaillon src={iconeDeRessource(s.id)} taille="sm" />
                <span className={styles.nomDuStock}>{s.nom}</span>{" "}
                <strong className={styles.quantite}>{quantiteAffichee(s.quantite)}</strong>{" "}
                <span className={styles.solde} data-negatif={solde < 0 ? "" : undefined}>
                  <span aria-hidden="true">{soldeAffiche(solde)}</span>
                  <span className={styles.annonce}>{`, ${soldeEnMots(solde)}`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {viande && vegetaux ? (
        <p className={styles.tenue} data-baisse={heures === null ? undefined : ""}>
          {heures === null ? <Coche /> : <Alerte />}
          {tenueDeLaNourriture(heures)}
        </p>
      ) : null}
    </section>
  );
}

/**
 * La page Habitants (US-0302), ouverte depuis la navigation : l'écran de stratégie, en trois zones. À gauche, le rail des
 * Métiers, leurs effectifs (US-0309), qui filtrent le tableau (US-0314) ; au centre, sous « Habitants » et le bandeau des
 * Habitants sans Métier (US-0313), une ligne par Habitant, groupées par Métier, avec son prénom, son Métier, son état et
 * la date de son arrivée, dans l'ordre de la lecture (US-0303), d'où l'on donne un Métier à un Habitant sans Métier
 * (US-0308), en change (US-0310), le retire (US-0311) ou le renvoie (US-0330) ; en tête de chaque groupe, le Métier et sa
 * phrase (US-0307), où l'on répartit les Habitants avec « − » et « + » (US-0312) ; sans aucun Habitant, une phrase à leur
 * place (US-0329). À droite, la colonne de contexte : les Voyageurs aux portes (US-0332), la place du Territoire, avec
 * « Plus de place » quand elle est toute prise (US-0305), l'Entretien des Habitants par heure (US-0318) et combien de temps
 * la Nourriture le paiera (US-0320), d'après les Stocks lus une fois le Territoire mis à l'heure. Sur une tablette et un
 * téléphone, le rail devient une bande, et la colonne de contexte passe au-dessus du tableau.
 * Tout est lu à chaque affichage.
 * Sans session, la garde mène à la connexion, qui ramène ici.
 */
export default async function Habitants() {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { territoireId } = await exigerCompte("/jeu/habitants");
  const [habitants, places, entretien, metiers, stocks, voyageurs, famineDepuis, famine] = await Promise.all([
    territoireId === null ? [] : habitantsDuTerritoire(getPool(), territoireId),
    territoireId === null ? 0 : placesDuTerritoire(getPool(), territoireId),
    territoireId === null ? null : entretienDesHabitants(getPool(), territoireId),
    lesMetiers(getPool()),
    territoireId === null ? [] : stocksALHeure(territoireId),
    territoireId === null ? [] : voyageursAuxPortes(getPool(), territoireId),
    territoireId === null ? null : famineImminenteALHeure(territoireId),
    territoireId === null ? null : famineALHeure(territoireId),
  ]);
  const montres = habitants.map(({ id, prenom, metier, etat, arriveLe }) => ({ id, prenom, metier, etat, arriveLe: DATE_D_ARRIVEE.format(arriveLe) }));
  const auChoix = metiers.map(({ id, nom }) => ({ id, nom, icone: iconeDeMetier(id) }));
  const auTableau = metiers.map(({ id, nom, phrase, servira }) => ({ id, nom, phrase, servira, icone: iconeDeMetier(id) }));
  return (
    <main className={styles.page}>
      {/* US-0309, US-0314 : le rail des Métiers ; US-0303, US-0307, US-0312 : le tableau des Habitants, groupé par Métier. */}
      <ListeDesHabitants habitants={montres} metiers={auTableau} />
      <div className={styles.contexte}>
        {/* US-0332 : les Voyageurs aux portes, en tête de la colonne : ils repartent s'ils attendent trop. */}
        {/* US-0333 : leur compte à rebours suit le temps du jeu, à sa vitesse ; US-0338 : la place qui reste règle l'accueil. */}
        {/* US-0340 : la famine imminente lui fait confirmer, sur les Stocks et l'Entretien lus à l'heure. */}
        {/* US-0341 : pendant une Famine, lue à l'heure, les Voyageurs évitent le Territoire. */}
        {/* US-0335 : les mêmes Métiers au choix que le tableau, pour en donner un dès l'accueil. */}
        <AuxPortes
          voyageurs={voyageurs}
          maintenant={maintenant()}
          vitesse={vitesse()}
          placesLibres={places - habitants.length}
          famineImminente={entretien !== null && avertissementDeFamine(stocks, entretien.parHeure, famineDepuis)}
          famine={famine !== null}
          metiers={auChoix}
        />
        <Place habitants={habitants.length} places={places} />
        {entretien ? <Entretien entretien={entretien} stocks={stocks} /> : null}
      </div>
    </main>
  );
}
