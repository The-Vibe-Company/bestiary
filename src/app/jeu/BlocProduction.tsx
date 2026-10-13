import { Bloc } from "@/components/Bloc";
import { iconeDeRessource } from "@/components/icone-de-ressource";
import { Medaillon } from "@/components/Medaillon";
import { productionAffichee } from "@/monde/quantite";
import styles from "./page.module.css";

/**
 * US-0217 : ce que le Territoire produit par heure, Ressource par Ressource, avec le Biome du Foyer
 * qui l'explique ; une Ressource que le Biome ne donne pas est dite comme telle. Un panneau de verre sur la
 * scène du Foyer : chaque Ressource son médaillon, son nom, et ce qu'elle rapporte, en feuille.
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
              <span>Ce Biome ne donne pas de {p.nom}.</span>
            </li>
          ),
        )}
      </ul>
    </Bloc>
  );
}
