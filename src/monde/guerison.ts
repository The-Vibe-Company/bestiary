// La guérison des Blessés avec le temps (US-0954) : les Blessés qu'une Expédition ramène au Foyer (US-0951) guérissent
// seuls, GUERISON_DES_BLESSES_HEURES après son retour, la même durée pour toutes les Espèces. Ils redeviennent des Bêtes
// valides sans que rien ne change en base : blessesAuFoyer (src/monde/blesses.ts) cesse de les compter, tout se relit du
// retour. Seul un Récit dit chaque guérison, à son instant : le temps qui avance (src/temps/avancer.ts) l'écrit en
// chemin, page ouverte, à l'ouverture d'une page ou par la tâche planifiée, le joueur absent comme présent, et toujours le
// même. US-0955 : soignés à leur retour par un éleveur libre au Foyer, ils guérissent plus vite,
// GUERISON_DES_BLESSES_SOIGNES_HEURES après ce retour. Côté serveur uniquement.
import "server-only";
import type { PoolClient } from "pg";
import { dureesDeGuerison, gueriLe } from "./blesses";
import { LIBRE_EN_SQL } from "./etat-habitant";
import { type GuerisonDUneEspece, recitDeGuerison } from "./recit-de-guerison";
import { ecrireUnRecit } from "./recits";

/**
 * US-0955 : au retour au Foyer de l'Expédition `expeditionId` du Territoire, ses Blessés sont soignés si un éleveur libre
 * l'attend au Foyer : un Habitant éleveur qui ne s'occupe d'aucun Élevage (US-0843, LIBRE_EN_SQL). Les soins se décident
 * à cet instant, une fois pour toutes : un éleveur libéré ou engagé plus tard n'y change rien. Sans Blessé, rien ne se
 * note. Dans la transaction du retour (rentrerAuFoyer).
 */
export async function soignerLesBlesses(client: PoolClient, territoireId: number, expeditionId: number): Promise<void> {
  await client.query(
    `update expedition x set blesses_soignes = true
     where x.id = $2 and x.territoire_id = $1
       and exists (select 1 from expedition_escorte s where s.expedition_id = x.id and s.blessees > 0)
       and exists (select 1 from habitant h where h.territoire_id = $1 and h.metier = 'eleveur' and ${LIBRE_EN_SQL})`,
    [territoireId, expeditionId],
  );
}

/**
 * US-0954 : les Blessés du Territoire qui guérissent entre les instants du jeu `depuis` (exclu) et `jusqua` (inclus), ceux
 * des Expéditions rentrées au Foyer GUERISON_DES_BLESSES_HEURES plus tôt (US-0955 : ou
 * GUERISON_DES_BLESSES_SOIGNES_HEURES, soignés), à l'instant que dit gueriLe, comme blessesAuFoyer les compte : un Récit par
 * instant de guérison, daté de cet instant, dans l'ordre du temps, pour tous les Blessés qui guérissent alors (un ou
 * plusieurs groupes, US-0952), Espèce par Espèce, de la plus commune à la plus rare puis par nom, comme les pertes du récit
 * du retour. Le temps découpé autrement ne change rien : chaque instant de guérison tombe dans un seul de ces intervalles.
 *
 * Jamais plus de Blessés d'une Espèce que son effectif n'en compte, comme les pages les montrent juste avant (blessesAffiches) :
 * le groupe qui guérit est alors le premier à guérir de son Espèce. L'effectif baisse sans que les Blessés ne changent
 * (un Couple réuni part en Réserve, US-0956) : une Espèce sans plus aucune Bête n'a rien à dire, ni un Récit sans Espèce.
 * L'effectif lu est celui de la fin de l'intervalle : les morts d'une attaque qui arrête l'évolution à `jusqua` (US-0945),
 * après la guérison, en sont déjà sorties. Seul écart connu au découpage, accepté : il faut que l'attaque tue, dans la même
 * avancée, assez de Bêtes de la même Espèce pour que l'effectif passe sous le nombre de ses Blessés qui guérissent.
 */
export async function guerirLesBlesses(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date): Promise<void> {
  const { rows } = await client.query<GuerisonDUneEspece & { instant: Date }>(
    `select es.nom, least(sum(g.blessees), coalesce(f.nombre, 0))::int as nombre, g.gueri as instant
     from (select s.espece_id, s.blessees, ${gueriLe("$4", "$5")} as gueri
           from expedition_escorte s join expedition x on x.id = s.expedition_id
           where x.territoire_id = $1 and x.rentree_le is not null and s.blessees > 0) g
       join espece es on es.id = g.espece_id join rarete r on r.id = es.rarete_id
       left join (select espece_id, sum(nombre) as nombre from effectif where territoire_id = $1 group by espece_id) f on f.espece_id = g.espece_id
     where g.gueri > $2 and g.gueri <= $3
     group by g.gueri, es.id, es.nom, r.rang, f.nombre
     having least(sum(g.blessees), coalesce(f.nombre, 0)) > 0
     order by g.gueri, r.rang, es.nom`,
    [territoireId, depuis, jusqua, ...dureesDeGuerison()],
  );
  const parInstant = new Map<number, GuerisonDUneEspece[]>();
  for (const { instant, ...espece } of rows) parInstant.set(instant.getTime(), [...(parInstant.get(instant.getTime()) ?? []), espece]);
  for (const [instant, especes] of parInstant) await ecrireUnRecit(client, territoireId, recitDeGuerison(especes, new Date(instant)));
}
