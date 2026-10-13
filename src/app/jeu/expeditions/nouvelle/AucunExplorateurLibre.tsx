import Link from "next/link";
import { Bloc } from "@/components/Bloc";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { Paysage } from "@/components/Paysage";
import { formaterJourEtHeure } from "@/temps/affichage";
import styles from "./AucunExplorateurLibre.module.css";

/** Le fuseau des joueurs, pour l'heure du prochain retour. */
const FUSEAU = "Europe/Paris";

/** US-0903 : l'heure du prochain retour, dans le fuseau du joueur : « 9 octobre à 14:05 ». */
const quand = (instant: Date) => formaterJourEtHeure(instant, FUSEAU);

/**
 * US-0903 : à la place du formulaire de l'écran d'Expédition, quand aucun explorateur n'est libre : sans aucun
 * explorateur, pourquoi l'on ne peut pas partir ; quand tous sont déjà partis, l'heure du prochain retour
 * (`prochainRetour`, celui de leur Expédition, US-0911). Dans les deux cas, un lien mène à la page Habitants pour
 * donner ce Métier, au pouce sur mobile. Un panneau, les explorateurs en route peints en tête.
 */
export function AucunExplorateurLibre({ total, prochainRetour }: { total: number; prochainRetour: Date | null }) {
  return (
    <Bloc titre="Explorateurs" action={<Medaillon src="/illustrations/metiers/explorateur.webp" taille="xs" />} className={styles.bloc}>
      <Paysage peinture="accueil/explorateurs.webp" sizes="(max-width: 760px) 100vw, 640px" className={`${kit.vignette} ${styles.peinture}`} />
      <p className={styles.etat}>{total === 0 ? "Aucun explorateur" : "Tous les explorateurs sont déjà partis"}</p>
      {total === 0 ? <p className={styles.note}>Il faut au moins un explorateur pour partir.</p> : null}
      {total > 0 && prochainRetour ? (
        <p className={styles.note}>
          {"Prochain retour le "}
          <time dateTime={prochainRetour.toISOString()}>{quand(prochainRetour)}</time>
        </p>
      ) : null}
      <Link href="/jeu/habitants" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.habitants}`}>
        {"Donner le Métier d'explorateur"}
      </Link>
    </Bloc>
  );
}
