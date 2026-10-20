// La production continue du Territoire (US-0210) et l'Entretien de ses Habitants (US-0316), appliqués
// ensemble par le mécanisme unique du temps, qui tient aussi l'avertissement « famine imminente » (US-0322) et la
// Famine (US-0325).
import "server-only";
import type { Pool, PoolClient } from "pg";
import { ENTRETIEN_HABITANT_PAR_HEURE, FAMINE_IMMINENTE_HEURES, FAMINE_IMMINENTE_MARGE_HEURES } from "@/reglages";
import { AU_FOYER, faireRepartirUnHabitant, finirLaFamine } from "./famine";
import type { EntretienDesBetesLu } from "./nourriture";

/**
 * Ce que le Territoire $1 produit par heure, Ressource par Ressource : la somme de toutes ses Cases,
 * chacune selon son Biome. La même requête sert au calcul et à l'affichage (US-0212).
 */
export const PRODUCTION_DU_TERRITOIRE = `
  select pb.ressource_id, sum(pb.par_heure) as par_heure
  from territoire t join case_du_monde c on c.chef_id = t.chef_id
    join production_biome pb on pb.biome_id = c.biome_id
  where t.id = $1
  group by pb.ressource_id`;

/**
 * US-0316 : l'Entretien de tous les Habitants du Territoire $1, en Nourriture par heure, qu'ils aient un
 * Métier ou non. Le calcul et l'affichage le lisent tous deux ici. US-0921 : les explorateurs partis en
 * Expédition compris : ils mangent toujours, sur les Stocks du Territoire, et l'avertissement « famine
 * imminente » (US-0322) comme la Famine (US-0325) les comptent donc aussi.
 */
export const ENTRETIEN_DU_TERRITOIRE = `
  select (${ENTRETIEN_HABITANT_PAR_HEURE} * count(*))::numeric as par_heure from habitant where territoire_id = $1`;

// Le calcul compte le temps en pas d'une microseconde, la plus petite durée du jeu, et chaque Stock en
// unités de reste : S = quantite × 3 600 000 000 + reste (US-0219). Une production de p par heure ajoute
// alors exactement p à chaque pas, et un Entretien de c par heure en retire exactement c.

/** Le Stock s après un pas où il paie c et produit p : sa production ne le pousse pas au-delà de sa limite l. */
const unPas = (s: string, p: string, c: string, l: string) => `greatest(${s} - ${c}, least(${s} + ${p} - ${c}, ${l}))`;

/**
 * Le Stock s après n pas comme unPas, d'un coup (n'importe quand avant pasImpaye) : sous sa limite, il monte
 * ou descend de p - c par pas, sans dépasser sa limite ; au-dessus (US-0230), il ne produit plus et
 * descend de c par pas jusqu'à elle, puis reprend comme sous sa limite.
 */
const apresPas = (s: string, p: string, c: string, l: string, n: string) => `(case
    when ${s} <= ${l} then least(${s} + (${p} - ${c}) * (${n}), ${l})
    when ${c} = 0 then ${s}
    when ${n} <= div(${s} - ${l}, ${c}) then ${s} - ${c} * (${n})
    else least(least(${s} - ${c} * div(${s} - ${l}, ${c}) + ${p} - ${c}, ${l}) + (${p} - ${c}) * (${n} - 1 - div(${s} - ${l}, ${c})), ${l})
  end)`;

/** Le premier pas, compté depuis 0, où le Stock s ne peut plus payer c (s + p < c) ; null s'il le peut toujours. */
const pasImpaye = (s: string, p: string, c: string, l: string) => `(case
    when ${p} >= ${c} then null
    when ${s} <= ${l} then div(${s}, ${c} - ${p})
    when ${s} - ${c} * div(${s} - ${l}, ${c}) + ${p} < ${c} then div(${s} - ${l}, ${c})
    else div(${s} - ${l}, ${c}) + 1 + div(least(${s} - ${c} * div(${s} - ${l}, ${c}) + ${p} - ${c}, ${l}), ${c} - ${p})
  end)`;

/**
 * US-0216 : sur des pas où le Stock paie c à chaque pas, la production entrée vaut la hausse de
 * S + c × (pas comptés depuis l'origine des temps). Ce compteur ne dépend que de l'état et de l'instant :
 * en millionièmes entiers, il donne la même somme quel que soit le découpage du temps (à moins d'un
 * millionième par bascule de la valeur exacte), sans colonne de plus.
 */
const compteur = (s: string, c: string, t: string) => `div(${s} + (${c}) * (${t}), 3600)`;

/** x ÷ y arrondi au-dessus, exactement. */
const auDessus = (x: string, y: string) => `(div(${x}, ${y}) + case when mod(${x}, ${y}) = 0 then 0 else 1 end)`;

/** US-0322 : le seuil de l'avertissement « famine imminente », en pas d'une microseconde. */
const SEUIL_FAMINE_IMMINENTE = `${FAMINE_IMMINENTE_HEURES} * 3600000000`;
/** US-0323 : au-delà, en pas d'une microseconde, le danger est passé et l'avertissement est retiré. */
const FIN_FAMINE_IMMINENTE = `${FAMINE_IMMINENTE_HEURES + FAMINE_IMMINENTE_MARGE_HEURES} * 3600000000`;

/**
 * La mise à l'heure des Stocks du Territoire $1 entre les instants $2 et $3 : la production (US-0210) et
 * l'Entretien des Habitants (US-0316), ensemble, en décimaux exacts.
 *
 * À chaque pas, un Stock paie sa part de l'Entretien puis reçoit sa production (unPas). Une Ressource que
 * personne ne mange ne fait que produire. US-0219 : le Stock garde ses millionièmes entiers (div) et le
 * reste exact, rien ne se perd. US-0221 : ce qui dépasserait la limite est perdu, le Stock s'y arrête
 * exactement. US-0230 : au-dessus de sa limite, un Stock ne produit plus ; rien ne retire son surplus, sauf
 * l'Entretien. US-0228 : le calcul note l'instant exact où un Stock atteint sa limite.
 *
 * US-0316 : la Viande et les Végétaux paient chacun la moitié de l'Entretien tant que les deux le peuvent.
 * Au premier pas où l'un ne le peut plus (d1), il donne tout ce qu'il a et l'autre paie le reste ; ensuite,
 * vide, il ne donne plus que sa production, à mesure, et l'autre paie tout le reste de l'Entretien. Au
 * premier pas où l'autre ne le peut plus non plus (d2), il donne tout ce qu'il a ; les deux restent alors à
 * zéro, chacun ne donnant que sa production : un Stock ne descend jamais sous zéro, et ce qui manque n'est
 * pas payé (c'est la Famine, US-0325).
 *
 * Le calcul ne déroule pas les pas : entre deux bascules, apresPas donne l'état d'un coup, et pasImpaye le
 * pas de la bascule. Le résultat est exactement celui du déroulement pas à pas, quel que soit le découpage du
 * temps : mille calculs d'une minute donnent exactement un calcul de mille minutes, reste compris. Les bornes
 * $2 et $3 tombent toujours sur un pas, les instants du jeu étant comptés en microsecondes.
 *
 * US-0322 : la même mise à l'heure tient l'avertissement « famine imminente » du Territoire. Elle déroule la
 * même règle depuis $2, sans s'arrêter à $3, jusqu'au pas où l'Entretien ne sera plus payé en entier : la
 * Nourriture tient jusque-là (comme nourriturePourEncore). Entre $2 et $3, rien ne change les débits : ce temps
 * baisse d'un pas à chaque pas, et la famine devient imminente au pas exact où il ne vaut plus que
 * FAMINE_IMMINENTE_HEURES heures. Si ce pas tombe avant $3, son instant est noté, et gardé tant que la famine
 * reste imminente. Déjà sous le seuil en $2 sans être noté (un Habitant de plus, ou un Territoire calculé avant
 * la mise en ligne d'US-0322), l'avertissement part de $2 : on ne remonte pas dans le passé. C'est le même pas
 * quel que soit le découpage du temps : page ouverte, fermée ou tâche planifiée donnent le même instant.
 *
 * US-0323 : l'avertissement est retiré (remis à null) dès que la Nourriture est assurée, ou qu'elle couvre plus de
 * FAMINE_IMMINENTE_HEURES + FAMINE_IMMINENTE_MARGE_HEURES heures ; entre les deux, il garde son état. Entre $2 et
 * $3, ce temps ne fait que baisser : il ne remonte que par un changement fait en $2 (un Habitant parti, de la
 * Nourriture ajoutée), et le retrait se fait donc en $2, à l'instant même du changement ; l'avertissement peut
 * ensuite reparaître au seuil, dans le même intervalle.
 *
 * US-0325 : la Famine commence au pas exact où ce temps tombe à zéro, la Viande et les Végétaux ensemble ne payant
 * plus l'Entretien en entier : son instant est noté s'il tombe d'ici $3. Elle dure tant que la Nourriture ne le paie
 * pas : les deux Stocks restent vides, et chacun ne donne que sa production. Elle ne finit donc qu'en $2, par un
 * changement (un Habitant parti, de la Nourriture ajoutée) : l'instant retenu revient alors à null, et une nouvelle
 * Famine peut commencer plus loin, dans le même intervalle. Déjà en Famine en $2 sans être notée (un Habitant de
 * plus, ou un Territoire calculé avant la mise en ligne d'US-0325), elle part de $2 : on ne remonte pas dans le passé.
 *
 * US-0326 : en Famine, un Habitant s'en va une heure pile après son début, puis d'heure en heure, tant qu'il en reste
 * plus d'un. Un départ change l'Entretien, donc la suite du calcul : celui-ci s'arrête au premier départ qui tombe
 * d'ici $3 et rend l'instant atteint (atteint, en texte à la microseconde) et s'il y a un départ à y appliquer
 * (depart) ; produire() le fait partir, puis reprend de là. Les départs tombent aux heures pleines depuis le début de
 * la Famine, que le Territoire retient : les mêmes quel que soit le découpage du temps. Un départ à l'instant $3
 * même est appliqué dans ce calcul-ci. US-0921 : seul un Habitant resté au Foyer s'en va ; sans plus personne au
 * Foyer, les explorateurs étant absents, la Famine dure sans départ.
 *
 * US-0328 : la Famine finit en $2 quand la Nourriture y paie de nouveau l'Entretien (un départ qui l'a ramené sous la
 * production, de la Nourriture ajoutée) : le calcul rend alors son début (famineFinie), pour le Récit de sa fin, et
 * ne programme plus de départ.
 *
 * US-0826 : l'Entretien des Bêtes de l'effectif s'y prélève aussi, par heure, dans les mêmes pas : celui des carnivores
 * ($4) sur la seule Viande, celui des herbivores ($5) sur les seuls Végétaux, celui des omnivores ($6) comme celui des
 * Habitants, avec qui ils forment la demande partagée : la moitié sur chaque Stock tant que les deux le peuvent, puis tout
 * sur celui qui reste. Chaque Stock paie d'abord les Bêtes qui ne mangent que lui ; le premier qui ne le peut plus donne
 * tout ce qu'il a, à elles d'abord, puis sa production, et l'autre paie ses propres Bêtes et tout le reste de la demande
 * partagée, jusqu'à se vider à son tour. Une Bête qui n'est pas nourrie n'a pas encore de conséquence (étape 36). La
 * Famine des Habitants garde son sens : elle commence quand ce que les Stocks donnent à la demande partagée, une fois
 * payées les Bêtes qui ne mangent qu'eux, ne paie plus l'Entretien des Habitants (e) ; les omnivores ont faim avant eux.
 */
export const PRODUIRE = `
  with production as (${PRODUCTION_DU_TERRITOIRE}),
  entretien as (${ENTRETIEN_DU_TERRITOIRE}),
  -- Le premier pas du calcul, compté depuis l'origine des temps, et le nombre de pas jusqu'à $3.
  pas as (
    select extract(epoch from $2::timestamptz) * 1000000 as t0,
      (extract(epoch from $3::timestamptz) - extract(epoch from $2::timestamptz)) * 1000000 as k
  ),
  -- Chaque Stock en unités de reste ; tant que les deux le peuvent, la Viande et les Végétaux paient chacun la moitié de l'Entretien.
  -- US-0826 : e, l'Entretien des Habitants ; dd, celui des Bêtes qui ne mangent que ce Stock (les carnivores $4 la Viande,
  -- les herbivores $5 les Végétaux) ; sh, la demande partagée, les Habitants et les omnivores $6. Chaque Stock de
  -- Nourriture paie ses Bêtes, puis la moitié de la demande partagée.
  etat as (
    select s.ressource_id, r.famille = 'nourriture' as nourriture, s.quantite * 3600000000 + s.reste as s0,
      s.limite * 3600000000 as l, coalesce(production.par_heure, 0) as p, entretien.par_heure as e,
      case s.ressource_id when 'viande' then $4::numeric when 'vegetaux' then $5::numeric else 0 end as dd,
      entretien.par_heure + $6::numeric as sh,
      case when r.famille = 'nourriture'
        then case s.ressource_id when 'viande' then $4::numeric when 'vegetaux' then $5::numeric else 0 end + (entretien.par_heure + $6::numeric) / 2
        else 0 end as c1, pas.t0
    from stock s join ressource r on r.id = s.ressource_id
      left join production on production.ressource_id = s.ressource_id
      cross join entretien cross join pas
    where s.territoire_id = $1
  ),
  partage as (select etat.*, ${pasImpaye("s0", "p", "c1", "l")} as da from etat),
  -- US-0322 : le pas, compté depuis $2, où la Nourriture ne paiera plus l'Entretien en entier, au-delà de $3 s'il le
  -- faut : f1, le premier où un Stock de Nourriture ne peut plus payer sa moitié (null : la Nourriture est assurée),
  -- puis, comme d1 et d2 plus bas, celui où l'autre ne peut plus payer tout le reste.
  famine_d1 as materialized (select partage.*, min(da) over () as f1 from partage where nourriture),
  famine_s1 as materialized (select famine_d1.*, ${apresPas("s0", "p", "c1", "l", "f1")} as fs1 from famine_d1),
  -- US-0826 : au pas f1, le Stock qui ne peut plus payer donne tout ce qu'il a, à ses Bêtes d'abord ; l'autre paie ses Bêtes
  -- et tout le reste de la demande partagée s'il le peut (fc2) ; ensuite, le premier ne donne que sa production, l'autre
  -- paie tout le reste (fc3).
  famine_pas as (
    select famine_s1.*,
      case when da = f1 then fs1 + p
        else least(fs1 + p, dd + sh - greatest(0, (sum(fs1 + p) over () - (fs1 + p)) - (sum(dd) over () - dd))) end as fc2,
      case when da = f1 then p else dd + sh - greatest(0, (sum(p) over () - p) - (sum(dd) over () - dd)) end as fc3
    from famine_s1
  ),
  famine_s2 as materialized (select famine_pas.*, ${unPas("fs1", "p", "fc2", "l")} as fs2 from famine_pas),
  -- g2 : les pas, après f1, où l'autre paie tout le reste ; au suivant, il donne tout ce qu'il a (fs3 + p).
  famine_s3 as materialized (select famine_s2.*, ${pasImpaye("fs2", "p", "fc3", "l")} as g2 from famine_s2),
  famine_s4 as materialized (select famine_s3.*, ${apresPas("fs2", "p", "fc3", "l", "g2")} as fs3 from famine_s3),
  -- US-0325, US-0826 : la Famine commence au premier pas où les Habitants ne reçoivent plus tout leur Entretien e : ce que
  -- les deux Stocks donnent à la demande partagée, une fois payées leurs Bêtes, n'y suffit plus. Au pas f1 ; sinon, les
  -- deux vides dès f1, au suivant si leur production n'y suffit pas ; sinon, au pas où l'autre se vide à son tour, ou au
  -- suivant ; jamais si sa production, ou leur production à tous deux, y suffit.
  famine as (
    select case
        when sum(greatest(0, fc2 - dd)) < min(e) then min(f1)
        when bool_and(coalesce(da = f1, false)) then case when sum(greatest(0, p - dd)) < min(e) then min(f1) + 1 end
        when min(g2) is null then null
        when sum(case when g2 is null then greatest(0, p - dd) else greatest(0, fs3 + p - dd) end) < min(e) then min(f1) + 1 + min(g2)
        when sum(greatest(0, p - dd)) < min(e) then min(f1) + 2 + min(g2)
      end as pas
    from famine_s4
  ),
  -- US-0326 : le pas du prochain départ de Famine, compté depuis $2 : une heure pleine après le début de la Famine
  -- (debut, avant $2 quand elle dure déjà, comme le Territoire le retient), toujours après $2 ; null hors Famine, ou
  -- quand il ne reste qu'un Habitant. US-0921 : ou quand plus personne n'est resté au Foyer pour s'en aller.
  depart as (
    select case when debut is not null and (select count(*) from habitant where territoire_id = $1) > 1
        and exists (select 1 from habitant where territoire_id = $1 and ${AU_FOYER})
        then debut + 3600000000 * greatest(1, div(-debut, 3600000000) + 1)
      end as pas
    from (
      select case when f.pas = 0 and t.famine_depuis is not null then extract(epoch from t.famine_depuis) * 1000000 - pas.t0 else f.pas end as debut
      from famine f cross join pas left join territoire t on t.id = $1
    ) en_famine
  ),
  -- k : les pas calculés, jusqu'à $3 ou jusqu'au prochain départ s'il tombe avant.
  fenetre as (select least(pas.k, d.pas) as k, coalesce(d.pas <= pas.k, false) as depart from pas cross join depart d),
  famines as (
    update territoire t set famine_imminente_depuis = case
        when f.pas <= ${FIN_FAMINE_IMMINENTE} and t.famine_imminente_depuis is not null then t.famine_imminente_depuis
        when f.pas <= ${SEUIL_FAMINE_IMMINENTE} + w.k
          then $2::timestamptz + make_interval(secs => (greatest(0, f.pas - ${SEUIL_FAMINE_IMMINENTE}) / 1000000)::double precision)
        else null
      end,
      -- US-0325 : déjà en Famine en $2, elle garde son instant ; sinon, elle commence d'ici la fin du calcul ou pas du tout.
      famine_depuis = case
        when f.pas = 0 and t.famine_depuis is not null then t.famine_depuis
        when f.pas <= w.k then $2::timestamptz + f.pas * interval '1 microsecond'
        else null
      end
    from famine f cross join fenetre w
    where t.id = $1
  ),
  -- d1 : le premier pas où l'un des deux Stocks de Nourriture ne peut plus payer sa moitié ; k s'il n'y en a pas.
  bascule as (select partage.*, w.k, least(w.k, min(da) over (partition by nourriture)) as d1 from partage cross join fenetre w),
  -- « materialized » : chaque étape est calculée une fois ; sans cela, Postgres recopierait ses formules dans les suivantes.
  avant_d1 as materialized (select bascule.*, ${apresPas("s0", "p", "c1", "l", "d1")} as s1 from bascule),
  -- Au pas d1, le Stock qui ne peut plus payer donne tout ce qu'il a (s1 + p), l'autre le reste de l'Entretien s'il le peut (c2) ;
  -- ensuite, le premier ne donne que sa production, l'autre tout le reste (c3). Il n'y a que deux Stocks de Nourriture.
  -- US-0826 : le Stock qui ne peut plus payer donne à ses Bêtes d'abord ; l'autre paie ses Bêtes et tout le reste de la
  -- demande partagée, les Habitants et les omnivores.
  pas_d1 as (
    select avant_d1.*,
      case when da = d1 then s1 + p
        else least(s1 + p, dd + sh - greatest(0, (sum(s1 + p) over meme_famille - (s1 + p)) - (sum(dd) over meme_famille - dd))) end as c2,
      case when da = d1 then p else dd + sh - greatest(0, (sum(p) over meme_famille - p) - (sum(dd) over meme_famille - dd)) end as c3
    from avant_d1
    window meme_famille as (partition by nourriture)
  ),
  apres_d1 as materialized (select pas_d1.*, ${unPas("s1", "p", "c2", "l")} as s2 from pas_d1),
  -- d2 : le premier pas où l'autre ne peut plus payer tout le reste ; il donne alors tout ce qu'il a, et les deux restent vides.
  seul as materialized (select apres_d1.*, least(k, d1 + 1 + ${pasImpaye("s2", "p", "c3", "l")}) as d2 from apres_d1),
  avant_d2 as materialized (select seul.*, ${apresPas("s2", "p", "c3", "l", "d2 - d1 - 1")} as s3 from seul),
  fin as materialized (
    select avant_d2.*,
      case when d1 >= k then s1 when d2 >= k then s3 else 0 end as sf,
      -- La production entrée, en millionièmes : sur chaque suite de pas où le Stock paie la même chose.
      ${compteur("s1", "c1", "t0 + d1")} - ${compteur("s0", "c1", "t0")}
        + case when d1 >= k then 0 else
            ${compteur("s2", "c2", "t0 + d1 + 1")} - ${compteur("s1", "c2", "t0 + d1")}
            + ${compteur("s3", "c3", "t0 + d2")} - ${compteur("s2", "c3", "t0 + d1 + 1")}
            + case when d2 >= k then 0 else
                ${compteur("0", "s3 + p", "t0 + d2 + 1")} - ${compteur("s3", "s3 + p", "t0 + d2")}
                + ${compteur("0", "p", "t0 + k")} - ${compteur("0", "p", "t0 + d2 + 1")}
              end
          end as produit
    from avant_d2
  ),
  stocks as (
    update stock s set
      quantite = div(f.sf, 3600) / 1000000,
      reste = f.sf - div(f.sf, 3600) * 3600,
      -- US-0216 : la production entrée, sans en retirer l'Entretien.
      produit_depuis_visite = s.produit_depuis_visite + f.produit / 1000000,
      -- US-0228 : l'instant exact où le Stock a atteint sa limite ; null dès qu'il repasse dessous.
      plein_depuis = case
        when f.sf < f.l then null
        when f.s0 >= f.l then coalesce(s.plein_depuis, $2::timestamptz)
        else $2::timestamptz + make_interval(secs => (case
          when f.s1 >= f.l then ${auDessus("f.l - f.s0", "f.p - f.c1")}
          when f.s2 >= f.l then f.d1 + 1
          else f.d1 + 1 + ${auDessus("f.l - f.s2", "f.p - f.c3")}
        end / 1000000)::double precision)
      end
    from fin f
    where s.territoire_id = $1 and s.ressource_id = f.ressource_id
  )
  -- US-0326 : l'instant atteint, à la microseconde, et s'il faut y faire partir un Habitant. US-0328 : le début de la
  -- Famine qui a fini en $2, l'Entretien de nouveau payé (null sinon) ; la requête lit l'état d'avant sa mise à jour.
  select ($2::timestamptz + w.k * interval '1 microsecond')::text as atteint, w.depart,
    case when f.pas is distinct from 0 then t.famine_depuis::text end as "famineFinie"
  from fenetre w cross join famine f left join territoire t on t.id = $1`;

/**
 * Met à l'heure les Stocks du Territoire entre deux instants : ce que toutes ses Cases produisent, chacune
 * selon son Biome (donnees/biomes.yaml), au prorata du temps écoulé, moins l'Entretien de ses Habitants
 * (US-0316). Le Foyer produit comme une Case ordinaire ; une Ressource que rien ne produit ni ne mange ne
 * bouge pas. Ce qui est produit est aussi compté à part depuis la dernière visite du joueur (US-0216).
 *
 * US-0326 : en Famine, le calcul s'arrête à chaque départ d'un Habitant, le fait partir, et reprend de là jusqu'à
 * `jusqua`. Les départs sont calculés ici plutôt que programmés comme des événements : ils ne se connaissent qu'une
 * fois la Famine commencée, au milieu d'un calcul, et le mécanisme du temps n'applique à leur instant que les
 * événements programmés avant le calcul en cours. Après un départ à `jusqua` même, un calcul de durée nulle note
 * aussitôt ce qu'il change à la Famine. US-0328 : une Famine finie en chemin, son Récit est écrit à l'instant de sa fin.
 * US-0826 : avec l'Entretien des Bêtes `betes`, lu au début de la tranche (entretienDesBetes) : l'effectif ne change pas
 * pendant elle, le temps s'arrêtant à chaque naissance, à chaque attaque et à chaque retour.
 */
export async function produire(client: PoolClient, territoireId: number, depuis: Date, jusqua: Date, betes: EntretienDesBetesLu): Promise<void> {
  // Les instants des départs tombent à la microseconde : ils passent en texte, qu'une Date arrondirait.
  let debut: Date | string = depuis;
  for (;;) {
    const calcul: { atteint: string; depart: boolean; famineFinie: string | null } | undefined = (
      await client.query<{ atteint: string; depart: boolean; famineFinie: string | null }>(PRODUIRE, [
        territoireId,
        debut,
        jusqua,
        betes.viande,
        betes.vegetaux,
        betes.omnivores,
      ])
    ).rows[0];
    // US-0328 : la Famine a fini en `debut`, par un départ ou de la Nourriture ajoutée : un Récit le dit.
    if (calcul?.famineFinie) await finirLaFamine(client, territoireId, calcul.famineFinie, debut);
    if (!calcul?.depart) return;
    await faireRepartirUnHabitant(client, territoireId, calcul.atteint);
    debut = calcul.atteint;
  }
}

/**
 * US-0322 : depuis combien d'heures de jeu la famine est imminente, à l'instant jusqu'où le Territoire est
 * calculé, celui de ses Stocks ; null quand elle ne l'est pas.
 */
export async function famineImminenteDepuis(base: Pool | PoolClient, territoireId: number): Promise<number | null> {
  const { rows } = await base.query<{ heures: string | null }>(
    "select extract(epoch from calcule_jusqu_a - famine_imminente_depuis) / 3600 as heures from territoire where id = $1",
    [territoireId],
  );
  return rows[0]?.heures == null ? null : Number(rows[0].heures);
}
