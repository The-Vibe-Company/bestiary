import { Frise } from "@/components/Frise";
import kit from "@/components/kit.module.css";
import { Medaillon } from "@/components/Medaillon";
import { Paysage } from "@/components/Paysage";
import { RETOUR_D_EXPEDITION } from "@/expeditions/resume-du-retour";
import { CASE_INCONNUE, lireUnRetour, medaillonDuRecit, sorteDUnFait } from "./lecture-du-recit";
import type { RecitAffiche } from "./ListeDesRecits";
import styles from "./page.module.css";
import { Livre, RencontresDuRecit } from "./RencontresDuRecit";

/**
 * US-0941 : les faits du résumé en puces, sous l'en-tête du récit ouvert : les Bêtes ramenées avec la peinture de la
 * première, les nouvelles Espèces avec le livre du Bestiaire. Elles redisent aux yeux le résumé que porte déjà la ligne
 * du Récit : un lecteur d'écran ne les entend pas deux fois.
 */
function PucesDuResume({ resume, rencontres }: Pick<RecitAffiche, "resume" | "rencontres">) {
  const ramenee = rencontres?.find((r) => r.issue === "apprivoisee");
  return (
    <div className={styles.puces} aria-hidden="true">
      {resume!.map((fait) => (
        <span key={fait} className={styles.puce}>
          {/ramenée/.test(fait) ? (
            <Medaillon
              src={ramenee?.illustration ? `/illustrations/${ramenee.illustration}` : undefined}
              taille="xs"
              plein={Boolean(ramenee?.illustration)}
              className={styles.puceBete}
            />
          ) : /Bestiaire/.test(fait) ? (
            <Livre className={styles.livre} />
          ) : null}
          {fait}
        </span>
      ))}
    </div>
  );
}

/**
 * Un Récit ouvert, sous sa ligne : sur ordinateur, il se lit à droite de la liste, en tête son médaillon, son titre et sa
 * date (que la ligne du Récit dit déjà à un lecteur d'écran) ; sur un téléphone, il se déplie sous sa ligne.
 *
 * Un retour d'Expédition (US-0917) : les puces de son résumé (US-0941), ses faits ligne à ligne, ses durées sur la frise de
 * l'aller, du séjour et du retour ; puis chaque Bête vue, en carte (US-0940) ; sans Bête vue, le paysage de sa destination,
 * ou la brume d'une Case inconnue. Parmi les faits, un combat et ses pertes se marquent de braise (US-0947, US-0951), la
 * fuite des explorateurs et une Bête partie ailleurs (US-0964, US-0949) passent en discret (sorteDUnFait). Les autres
 * Récits, leur texte, ses retours à la ligne gardés.
 */
export function LectureDuRecit({ recit, id, hidden }: { recit: RecitAffiche; id: string; hidden: boolean }) {
  const retour = recit.titre === RETOUR_D_EXPEDITION ? lireUnRetour(recit.texte) : null;
  return (
    <div id={id} className={styles.lecture} hidden={hidden}>
      <div className={styles.enTeteLecture} aria-hidden="true">
        <Medaillon src={medaillonDuRecit(recit.titre)} taille="xl" />
        <div>
          <p className={styles.titreLecture}>{recit.titre}</p>
          <p className={styles.quandLecture}>{recit.quand}</p>
        </div>
      </div>
      {recit.resume?.length ? <PucesDuResume resume={recit.resume} rencontres={recit.rencontres} /> : null}
      {retour ? (
        <div className={styles.trajet}>
          <ul className={styles.faits}>
            {retour.faits.map((fait, i) => (
              <li key={i} data-fait={sorteDUnFait(fait) ?? undefined}>
                {fait}
              </li>
            ))}
          </ul>
          {retour.durees ? <Frise durees={retour.durees} className={styles.frise} /> : null}
        </div>
      ) : (
        <p className={styles.texte}>{recit.texte}</p>
      )}
      {recit.rencontres?.length ? (
        <RencontresDuRecit rencontres={recit.rencontres} />
      ) : retour?.biome ? (
        <Paysage
          biome={retour.biome === CASE_INCONNUE ? undefined : retour.biome}
          brume={retour.biome === CASE_INCONNUE}
          sizes="(max-width: 1023px) 100vw, 60vw"
          className={`${kit.vignette} ${styles.paysage}`}
        />
      ) : null}
    </div>
  );
}
