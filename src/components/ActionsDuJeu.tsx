import { connection } from "next/server";
import {
  couplesReunisALHeure,
  entretienALHeure,
  famineALHeure,
  famineImminenteALHeure,
  habitantsALHeure,
  joueurConnecte,
  recitsNonLusALHeure,
  sansMetierALHeure,
  stocksALHeure,
  voyageursALHeure,
} from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { nourriturePourEncoreDesStocks } from "@/monde/nourriture";
import { vitesse } from "@/temps/horloge";
import { CompteurHabitants } from "./CompteurHabitants";
import { BoutonDeconnexion } from "./Deconnexion";
import { FamineImminente } from "./FamineImminente";
import { MenuChef } from "./MenuChef";
import { Navigation } from "./Navigation";
import { Presence } from "./Presence";
import { Ressources } from "./Ressources";

/**
 * Les actions du joueur dans la barre du haut, sur les pages du jeu : son nom de chef et son menu
 * (US-0140), ou « Se déconnecter » seul tant qu'il n'a pas de nom ; la navigation du jeu (US-0302) avec
 * le nombre de ses Récits non lus (US-0324), celui des Voyageurs à ses portes (US-0332) et celui de ses
 * Habitants sans Métier (US-0313), ses ressources (US-0203) et le nombre de ses Habitants (US-0304) une
 * fois entré dans son Foyer, pas avant son récit d'arrivée, tous lus en même temps. Posées par
 * l'emplacement @actions de la mise en page (src/app/@actions/jeu). Elles ne font que montrer : la page
 * du jeu, à côté, exige la session et le nom.
 *
 * US-0321 : au bas de la barre, l'avertissement « famine imminente », compté sur les Stocks et l'Entretien
 * lus avec le reste ; tant que la Nourriture baisse, il est posé, prêt à paraître page ouverte au seuil.
 * US-0322 : avec depuis quand le Territoire retient la famine imminente, lu avec le reste après le rattrapage.
 * US-0323 : la Nourriture assurée, le danger est passé : l'avertissement n'est plus posé, même retenu.
 * US-0325 : en Famine, la même bande dit « Famine », avec depuis quand le Territoire la retient, lu avec le reste.
 * US-0958 : le menu du chef dit le nombre de ses Couples réunis, lu avec le reste une fois entré dans son Foyer.
 */
export async function ActionsDuJeu() {
  await connection();
  if (!entreeDuJeuOuverte()) return null;
  const joueur = await joueurConnecte();
  if (!joueur) return null;
  if (!joueur.nomDeChef) return <BoutonDeconnexion />;
  const territoireId = joueur.recitLu ? joueur.territoireId : null;
  const [stocks, habitants, recitsNonLus, voyageurs, sansMetier, entretien, famineImminente, enFamine, couplesReunis] =
    territoireId !== null
      ? await Promise.all([
          stocksALHeure(territoireId),
          habitantsALHeure(territoireId),
          recitsNonLusALHeure(territoireId),
          voyageursALHeure(territoireId),
          sansMetierALHeure(territoireId),
          entretienALHeure(territoireId),
          famineImminenteALHeure(territoireId),
          famineALHeure(territoireId),
          couplesReunisALHeure(territoireId),
        ])
      : [null, null, null, null, null, null, null, null, null];
  // US-0321 : dans combien d'heures de jeu la Nourriture ne paiera plus l'Entretien ; null quand elle est assurée.
  const famine = stocks && entretien !== null ? nourriturePourEncoreDesStocks(stocks, entretien) : null;
  return (
    <>
      {stocks ? <Navigation recitsNonLus={recitsNonLus ?? 0} voyageurs={voyageurs ?? 0} sansMetier={sansMetier ?? 0} /> : null}
      {/* US-0213 : la clé change avec les quantités, pour que la barre reparte des nouvelles après un recalage. */}
      {stocks ? (
        <Ressources key={stocks.map((s) => s.quantite).join("|")} stocks={stocks} vitesse={vitesse()}>
          {/* US-0304 : le nombre d'Habitants, relu à chaque affichage et à chaque recalage de la barre. */}
          {habitants !== null ? <CompteurHabitants nombre={habitants} /> : null}
        </Ressources>
      ) : null}
      {stocks ? <Presence key={`presence-${stocks.map((s) => s.quantite).join("|")}`} /> : null}
      <MenuChef nom={joueur.nomDeChef} couplesReunis={couplesReunis ?? undefined} />
      {/* US-0321 : comme les quantités, l'avertissement repart du nouveau temps à chaque recalage de la barre. */}
      {famine !== null ? (
        <FamineImminente
          key={`famine-${famine}-${famineImminente}-${enFamine}`}
          heures={famine}
          depuis={famineImminente}
          famine={enFamine}
          vitesse={vitesse()}
        />
      ) : null}
    </>
  );
}
