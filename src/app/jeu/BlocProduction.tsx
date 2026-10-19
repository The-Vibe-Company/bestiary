import { Bloc } from "@/components/Bloc";
import { iconeDeRessource } from "@/components/icone-de-ressource";
import { Medaillon } from "@/components/Medaillon";
import { productionAffichee } from "@/monde/quantite";
import styles from "./page.module.css";

/**
 * US-0217 : ce que le Territoire produit par heure, Ressource par Ressource, avec le Biome du Foyer
 * qui l'explique ; une Ressource que le Biome ne donne pas reste à sa place, éteinte, à « 0/h », sans le redire en
 * phrase à chaque visite (retour d'Antoine, 2026-10-15). Un panneau de verre sur la scène du Foyer : chaque Ressource
 * son médaillon, son nom, et ce qu'elle rapporte, en feuille.
 */
export function BlocProduction({ biome, productions }: { biome: string; productions: { id: string; nom: string; parHeure: string }[] }) {
  return (
    <Bloc titre={`Production · ${biome.toLocaleLowerCase("fr")}`} verre className={styles.production}>
      <ul className={styles.productions}>
        {productions.map((p) =>
          Number(p.parHeure) > 0 ? (
            <li key={p.id} className={styles.ligneProduction}>
              <Medaillon src={iconeDeRessource(p.id)} taille="md" />
              <span className={styles.nomProduction}>{p.nom}</span>
              <span className={styles.parHeure}>{productionAffichee(p.parHeure)}</span>
            </li>
          ) : (
            <li key={p.id} className={styles.ligneProduction} data-nulle="">
              <Medaillon src={iconeDeRessource(p.id)} taille="md" className={styles.medaillonEteint} />
              <span className={styles.nomProduction}>{p.nom}</span>
              <span className={styles.parHeure}>0/h</span>
            </li>
          ),
        )}
      </ul>
    </Bloc>
  );
}
