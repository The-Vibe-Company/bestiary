// Les règles qui font vivre chaque élément dans le temps. Le Monde n'a encore rien qui évolue :
// avancer, c'est seulement déplacer son marque-page. Un Territoire produit en continu (US-0210), ses
// Habitants y prennent leur Entretien (US-0316) et des Voyageurs s'y présentent de temps en temps (US-0331),
// puis repartent au bout de leur attente s'ils n'ont pas été accueillis (US-0337) ; ses Expéditions y retiennent leurs
// Rencontres, à leur instant exact (US-0932), et y rentrent au Foyer à leur heure (US-0916) : le temps évolue jusqu'au
// retour avant de l'appliquer, toutes les Rencontres du séjour sont donc retenues quand il s'applique ; le brouillard
// s'y lève sur leur chemin, à leur passage (US-0914) ; les Blessés qu'elles ramènent y guérissent à leur heure (US-0954) ;
// les Bêtes de ses Élevages y naissent l'une après l'autre (US-0817), et mangent leur Entretien (US-0826) ; les Attaques
// s'ajouteront ici.
import "server-only";
import { leverLeBrouillard } from "@/expeditions/brouillard";
import { mettreEnFuite } from "@/expeditions/fuite";
import { retenirLesRencontres } from "@/expeditions/rencontres";
import { RETOUR_EXPEDITION, rentrerAuFoyer } from "@/expeditions/retour";
import { guerirLesBlesses } from "@/monde/guerison";
import { entretienDesBetes } from "@/monde/entretien-des-betes";
import { faireNaitreLesBetes, prochaineNaissance } from "@/monde/naissances";
import { produire } from "@/monde/production";
import { ARRIVEE_VOYAGEUR, arriveeDUnVoyageur, DEPART_VOYAGEUR, departDUnVoyageur } from "@/monde/voyageurs";
import type { Regles } from "./avancer";
import type { ElementSuivi } from "./marque-page";

export const REGLES: Record<ElementSuivi, Regles> = {
  monde: {},
  territoire: {
    evoluer: async (client, id, depuis, jusqua) => {
      // US-0945 : les Rencontres d'abord : une attaque met son Expédition en fuite, et avance son retour ; le temps s'arrête
      // alors à son instant (arret), et reprend après, le retour à son heure exacte.
      // US-0817 : et le temps s'arrête à la fin d'un Élevage, que son éleveur soit libre pour la suite du calcul ; US-0826 :
      // à chaque naissance, que la Bête née mange dès sa naissance.
      const borne = (await prochaineNaissance(client, id, depuis, jusqua)) ?? jusqua;
      // US-0826 : l'Entretien des Bêtes, lu avant les Rencontres : une Bête tuée à l'attaque qui arrête la tranche mange
      // jusqu'à cet instant. L'effectif ne change pas pendant la tranche.
      const betes = await entretienDesBetes(client, id);
      const { jusqua: arret, fuites } = await retenirLesRencontres(client, id, depuis, borne);
      await mettreEnFuite(client, fuites);
      if (arret.getTime() > depuis.getTime()) {
        await produire(client, id, depuis, arret, betes);
        await leverLeBrouillard(client, id, depuis, arret);
        // US-0954 : jusqu'à l'arrêt seulement : le temps reprend de là, et chaque guérison n'est dite qu'une fois.
        await guerirLesBlesses(client, id, depuis, arret);
        // US-0817 : les naissances des Élevages, jusqu'à l'arrêt seulement, de même : chacune une fois.
        await faireNaitreLesBetes(client, id, depuis, arret);
      }
      return arret;
    },
    evenements: { [ARRIVEE_VOYAGEUR]: arriveeDUnVoyageur, [DEPART_VOYAGEUR]: departDUnVoyageur, [RETOUR_EXPEDITION]: rentrerAuFoyer },
  },
};
