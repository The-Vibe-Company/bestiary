import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Bloc } from "@/components/Bloc";
import { Grille } from "@/components/Grille";
import { PastilleRarete } from "@/components/PastilleRarete";
import { chefParNom } from "@/chefs/chef";
import { motDePasseAccepte } from "@/controle/acces";
import { modificationsPermises } from "@/controle/stocks";
import { getPool } from "@/db";
import { biomesEnBase, especesEnBase, raretesEnBase, rolesEnBase } from "@/donnees/en-base";
import { couronneEnBase, territoiresSuivis } from "@/monde/en-base";
import { emplacementsDeFoyers } from "@/monde/foyers";
import { quantiteExacte } from "@/monde/quantite";
import { stocksDuTerritoire } from "@/monde/stocks";
import { JOURNAL_TACHE_JOURS } from "@/reglages";
import { derniersPassages, type PassageNote } from "@/temps/absents";
import { formaterInstant } from "@/temps/affichage";
import { maintenant, vitesse } from "@/temps/horloge";
import { rattraper } from "@/temps/rattraper";
import { CarteCouronne } from "./CarteCouronne";
import { FicheEspece } from "./FicheEspece";
import { sauter } from "./actions";
import { FixerStock } from "./FixerStock";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Contrôle", robots: { index: false, follow: false } };

const FUSEAU = "Europe/Paris";

/** La page de contrôle interne (US-0034) : le temps du jeu et les données en base. Aucun lien n'y mène. */
export default async function Controle({ searchParams }: PageProps<"/controle">) {
  await connection();
  // Le proxy demande déjà le mot de passe ; la page vérifie à nouveau, au cas où il serait contourné.
  if (!motDePasseAccepte((await headers()).get("authorization"))) notFound();
  const pool = getPool();
  const [passages, biomes, especes, raretes, roles, couronne, territoires] = await Promise.all([
    derniersPassages(pool),
    biomesEnBase(pool),
    especesEnBase(pool),
    raretesEnBase(pool),
    rolesEnBase(pool),
    couronneEnBase(pool),
    territoiresSuivis(pool),
  ]);
  const facteur = vitesse();
  const { chef: cherche } = await searchParams;
  const joueur = typeof cherche === "string" && cherche.trim() ? await stocksDuJoueur(cherche) : null;

  return (
    <main className={styles.page}>
      <h1 className={styles.titre}>Contrôle</h1>
      <Grille>
        <Bloc titre="Heure du jeu" largeur={6}>
          <p className={styles.valeur}>{formaterInstant(maintenant(), FUSEAU)}</p>
          <p className={styles.note}>Heure de Paris.</p>
          {/* US-0038 : un saut dans le temps, hors production. */}
          {modificationsPermises() ? (
            <form action={sauter} className={styles.sauts}>
              <button type="submit" name="saut" value="heure" className={styles.bouton}>
                +1 heure
              </button>
              <button type="submit" name="saut" value="jour" className={styles.bouton}>
                +1 jour
              </button>
              <button type="submit" name="saut" value="semaine" className={styles.bouton}>
                +1 semaine
              </button>
            </form>
          ) : null}
        </Bloc>
        <Bloc titre="Vitesse du temps" largeur={6} teinte={facteur === 1 ? undefined : "citron"}>
          <p className={styles.valeur}>×{facteur}</p>
          <p className={styles.note}>{facteur === 1 ? "Vitesse normale." : "Temps accéléré."}</p>
        </Bloc>
        <Bloc titre="Territoires suivis par le temps" largeur={6}>
          <p className={styles.valeur}>{territoires.nombre}</p>
          <p className={styles.note}>
            {territoires.plusAncien === null
              ? "Aucun Territoire pour l'instant."
              : `Le plus en retard a été calculé ${retard(maintenant().getTime() - territoires.plusAncien.getTime())}.`}
          </p>
        </Bloc>
        <Bloc titre="Stocks d'un joueur">
          <form className={styles.recherche}>
            <input id="chef" name="chef" defaultValue={typeof cherche === "string" ? cherche : ""} aria-label="Nom de chef" className={styles.champ} required />
            <button type="submit" className={styles.bouton}>
              Chercher
            </button>
          </form>
          {joueur === null ? null : joueur.chef === null ? (
            <p className={styles.note}>Aucun chef de ce nom.</p>
          ) : joueur.stocks === null ? (
            <p className={styles.note}>{joueur.chef.nom} n&apos;a pas encore de Territoire.</p>
          ) : (
            <div className={styles.defilement}>
              <table className={styles.tableau}>
                <caption className={styles.note}>
                  {joueur.chef.nom} · Territoire {joueur.chef.territoireId}
                </caption>
                <thead>
                  <tr>
                    <th>Ressource</th>
                    <th>Stock</th>
                    {modificationsPermises() ? <th>Fixer à</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {joueur.stocks.map((s) => (
                    <tr key={s.id}>
                      <td>{s.nom}</td>
                      <td>{quantiteExacte(s.quantite)}</td>
                      {modificationsPermises() ? (
                        <td>
                          <FixerStock territoireId={joueur.chef.territoireId!} ressourceId={s.id} nom={s.nom} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloc>
        <Bloc titre="Derniers passages de la tâche planifiée">
          {passages.length === 0 ? (
            <p className={styles.note}>Aucun passage noté ces {JOURNAL_TACHE_JOURS} derniers jours.</p>
          ) : (
            <div className={styles.defilement}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>Début</th>
                    <th>Résultat</th>
                    <th>Rattrapés</th>
                    <th>Restants</th>
                    <th>Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {passages.map((p) => (
                    <tr key={p.debut.toISOString()}>
                      <td>{formaterInstant(p.debut, FUSEAU)}</td>
                      <td className={p.echecs > 0 ? styles.echec : undefined}>{resultat(p)}</td>
                      <td>{p.rattrapes}</td>
                      <td>{p.restants}</td>
                      <td>{(p.dureeMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloc>
        <Bloc titre={`Couronne${couronne ? ` de ${couronne.monde} · ${couronne.cases.length} Cases` : ""}`}>
          {couronne && couronne.cases.length > 0 ? (
            <CarteCouronne
              couronne={couronne}
              noms={Object.fromEntries(biomes.map((b) => [b.id, b.nom]))}
              emplacements={emplacementsDeFoyers(
                couronne.cases,
                couronne.cases.filter((c) => c.foyer),
              )}
            />
          ) : (
            <p className={styles.note}>Aucune Case de la Couronne en base : lancez npm run monde:couronne.</p>
          )}
          {/* US-0412 : le Monde entier, généré à la volée ou lu en base. */}
          <p className={styles.note}>
            <Link href="/controle/monde">Le Monde entier</Link>
          </p>
        </Bloc>
        <Bloc titre={`Biomes en base · ${biomes.length}`}>
          {biomes.length === 0 ? (
            <p className={styles.note}>Aucun Biome en base : lancez npm run db:donnees.</p>
          ) : (
            <ul className={styles.liste}>
              {biomes.map((b) => (
                <li key={b.id}>
                  <span className={styles.nom}>{b.nom}</span> <code className={styles.id}>{b.id}</code>
                  {b.production.length > 0 ? (
                    <p className={styles.note}>
                      {b.production.map((p) => `${quantiteExacte(p.parHeure)} ${p.ressource}`).join(" · ")} par heure
                    </p>
                  ) : null}
                  {b.variantes.length > 0 ? (
                    <ul className={styles.variantes} aria-label={`Les ${b.variantes.length} formes : ${b.nom}`}>
                      {b.variantes.map((v) => (
                        <li key={v.id}>
                          {v.nom} <code className={styles.id}>{v.id}</code>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Bloc>
        <Bloc titre={`Espèces en base · ${especes.length}`}>
          {especes.length === 0 ? (
            <p className={styles.note}>Aucune Espèce en base : lancez npm run db:donnees.</p>
          ) : (
            especes.map((e) => <FicheEspece key={e.id} espece={e} />)
          )}
        </Bloc>
        <Bloc titre={`Raretés en base · ${raretes.length}`} largeur={6}>
          <ul className={styles.lignes}>
            {raretes.map((r) => (
              <li key={r.id}>
                <PastilleRarete rarete={r} /> <code className={styles.id}>{r.id}</code>
                <span className={styles.note}>
                  rang {r.rang} · {r.selevent ? "s'élèvent" : "ne s'élèvent pas"}
                </span>
              </li>
            ))}
          </ul>
          {/* US-0931 : les Raretés des Bêtes sauvages d'un Monde simulées sur une longue période, Anneau par Anneau. */}
          <p className={styles.note}>
            <Link href="/controle/raretes">Simulation par Anneau</Link>
          </p>
        </Bloc>
        <Bloc titre={`Rôles en base · ${roles.length}`} largeur={6}>
          <ul className={styles.lignes}>
            {roles.map((r) => (
              <li key={r.id}>
                <span className={styles.nom}>{r.nom}</span> <code className={styles.id}>{r.id}</code>
                <span className={styles.note}>{r.phrase}</span>
              </li>
            ))}
          </ul>
        </Bloc>
        {/* US-0968 : les chances des Rencontres disputées, simulées par le vrai tirage du jeu. */}
        <Bloc titre="Rencontres disputées" largeur={6}>
          <p className={styles.note}>
            <Link href="/controle/chances">Simulation des chances</Link>
          </p>
        </Bloc>
      </Grille>
    </main>
  );
}

/** US-0208 : le chef cherché par son nom, et ses Stocks après la mise à l'heure de son Territoire. */
async function stocksDuJoueur(nom: string) {
  const chef = await chefParNom(getPool(), nom);
  if (!chef || chef.territoireId === null) return { chef, stocks: null };
  await rattraper("territoire", chef.territoireId);
  return { chef, stocks: await stocksDuTerritoire(getPool(), chef.territoireId) };
}

function resultat(p: PassageNote): string {
  if (p.echecs === 0) return "Réussi";
  const raison = p.erreurs[0]?.raison;
  return `${p.echecs} échec${p.echecs > 1 ? "s" : ""}${raison ? ` : ${raison}` : ""}`;
}

/** Il y a combien de temps, en mots : « il y a 3 min », « à l'instant ». */
function retard(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 120) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

