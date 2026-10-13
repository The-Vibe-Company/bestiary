import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Illustration } from "@/components/Illustration";
import kit from "@/components/kit.module.css";
import type { Sexe } from "@/monde/betes-sauvages";
import type { IssueDUneRencontre } from "@/monde/recits";
import styles from "./RencontresDuRecit.module.css";

/**
 * US-0940 : une Rencontre telle que le Récit d'un retour la montre : son heure, déjà écrite par le serveur dans le fuseau du
 * joueur, l'Espèce de la Bête avec son illustration et sa Rareté, et ce qu'il en advint ; restée sur sa Case, la force
 * qui manquait à l'escorte (US-0942) ; repartie, ou emmenée par une autre Expédition (US-0964), l'heure de son départ
 * (US-0950), avec son jour s'il n'est plus celui de la Rencontre (`autreJour`). US-0949 : restée et toujours sur sa Case,
 * l'adresse de l'écran d'Expédition qui revient la chercher (`revenir`).
 */
export type RencontreAffichee = {
  instant: string;
  heure: string;
  nom: string;
  illustration: string | null;
  rarete: { id: string; nom: string };
  issue: IssueDUneRencontre;
  repartie?: { instant: string; heure: string; autreJour: boolean };
  sexe: Sexe | null;
  nouvelleEspece: boolean;
  manque?: number;
  revenir?: string;
};

const SEXES: Record<Sexe, string> = { male: "mâle", femelle: "femelle" };

/** US-0942 : une force en chiffres, comme la Force de l'écran d'Expédition : « 37 340 », à espace insécable. */
const entier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\u00a0");

/**
 * US-0940 : « Apprivoisée, femelle », « Trop forte, restée sur sa Case : il manquait 37 340 de force », « Repartie à la
 * fin de sa durée ». US-0950 : « Repartie à 17:15, à la fin de sa durée », « Repartie le 13 octobre à 01:10, … ». US-0964 :
 * « Partie à 17:15 avec une autre Expédition », sans nommer personne.
 */
function ceQuIlAdvint({ issue, repartie, sexe, manque }: Pick<RencontreAffichee, "issue" | "repartie" | "sexe" | "manque">): ReactNode {
  if (issue === "apprivoisee") return sexe ? `Apprivoisée, ${SEXES[sexe]}` : "Apprivoisée";
  if (issue === "repartie" && repartie) {
    return (
      <>
        Repartie {repartie.autreJour ? "le" : "à"} <time dateTime={repartie.instant}>{repartie.heure}</time>, à la fin de sa durée
      </>
    );
  }
  if (issue === "repartie") return "Repartie à la fin de sa durée";
  if (issue === "emmenee" && repartie) {
    return (
      <>
        Partie {repartie.autreJour ? "le" : "à"} <time dateTime={repartie.instant}>{repartie.heure}</time> avec une autre Expédition
      </>
    );
  }
  if (issue === "emmenee") return "Partie avec une autre Expédition";
  return manque ? `Trop forte, restée sur sa Case : il manquait ${entier(manque)} de force` : "Trop forte, restée sur sa Case";
}

/** Le livre ouvert du Bestiaire : sur le ruban d'une nouvelle Espèce, et sur la puce du résumé qui les compte. */
export function Livre({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinejoin="round">
      <path d="M8 4.2C6.6 3 4.4 2.7 2 3v9.6c2.4-.3 4.6 0 6 1.2 1.4-1.2 3.6-1.5 6-1.2V3c-2.4-.3-4.6 0-6 1.2zM8 4.2v9.6" />
    </svg>
  );
}

/** Le sablier, devant l'heure d'une Rencontre. */
function Sablier() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.5h6M3 10.5h6M3.6 1.5c0 2.6 4.8 2.6 4.8 4.5S3.6 7.9 3.6 10.5M8.4 1.5c0 2.6-4.8 2.6-4.8 4.5s4.8 1.9 4.8 4.5" />
    </svg>
  );
}

/**
 * US-0940 : le récit de Rencontre : chaque Bête vue, à son heure, dans l'ordre des apparitions, en carte : la peinture de
 * son Espèce (ou la tête de loup), son heure, son nom et sa Rareté, puis ce qu'il en advint. Une Bête apprivoisée, ou dont
 * l'Espèce entre au Bestiaire, est mise en avant d'un filet de cuivre ; « Nouvelle Espèce au Bestiaire » le dit en toutes
 * lettres, sur le ruban. Une seule Bête prend toute la place ; plusieurs se rangent côte à côte, plus petites. Sur un
 * téléphone, la peinture passe au-dessus de son texte. US-0949 : une Bête restée sur sa Case, tant qu'elle y est, finit
 * sur « Revenir la chercher », un bouton au contour vert.
 */
export function RencontresDuRecit({ rencontres }: { rencontres: RencontreAffichee[] }) {
  return (
    <ol className={styles.rencontres} aria-label="Rencontres" data-plusieurs={rencontres.length > 1 ? "" : undefined}>
      {rencontres.map((r, i) => (
        <li key={i} className={styles.rencontre} data-en-avant={r.issue === "apprivoisee" || r.nouvelleEspece ? "" : undefined}>
          <Illustration chemin={r.illustration} alt={r.nom} sizes="(max-width: 760px) 100vw, 360px" className={styles.peinture} />
          <div className={styles.corps}>
            {/* La même peinture, très floue, en lueur derrière le texte. */}
            {r.illustration ? <Image src={`/illustrations/${r.illustration}`} alt="" fill sizes="48px" className={styles.lueur} /> : null}
            <span className={styles.heure}>
              <Sablier />
              <time dateTime={r.instant}>{r.heure}</time>
            </span>
            <p className={styles.bete}>
              <span className={styles.nom}>{r.nom}</span>
              <span className={`${kit.puce} ${styles.rarete}`} data-rarete={r.rarete.id}>
                {r.rarete.nom}
              </span>
            </p>
            <p className={styles.issue} data-issue={r.issue}>
              {ceQuIlAdvint(r)}
            </p>
            {r.nouvelleEspece ? (
              <p className={`${kit.ruban} ${styles.nouvelleEspece}`}>
                <Livre />
                Nouvelle Espèce au Bestiaire
              </p>
            ) : null}
            {r.revenir ? (
              <Link href={r.revenir} className={`${kit.bouton} ${kit.secondaire} ${styles.revenir}`}>
                Revenir la chercher
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
