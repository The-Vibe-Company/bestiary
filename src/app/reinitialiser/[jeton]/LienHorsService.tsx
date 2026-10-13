import Link from "next/link";
import { BOUTON_ENTREE, TitreEntree } from "@/components/PageEntree";
import styles from "../../entree.module.css";
import { LIEN_HORS_SERVICE, type LienHorsService as Raison } from "./etat";

/** Un lien qui ne sert plus (US-0129) : pourquoi, en titre, et où aller ensuite. */
export function LienHorsService({ raison }: { raison: Raison }) {
  const { titre, bouton } = LIEN_HORS_SERVICE[raison];
  return (
    <div className={styles.confirmation} role="alert">
      <TitreEntree>{titre}</TitreEntree>
      <Link href={bouton.lien} className={`${BOUTON_ENTREE} ${styles.envoyer}`}>
        {bouton.texte}
      </Link>
    </div>
  );
}
