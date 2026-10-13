import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Illustration } from "@/components/Illustration";
import kit from "@/components/kit.module.css";
import { EntreeDuJeu } from "./EntreeDuJeu";
import styles from "./page.module.css";

const VIGNETTE = "(max-width: 820px) 50vw, 240px";

/**
 * L'accueil, l'écran titre du jeu : une scène peinte, le Monde de Bestia sur sa table, fondu dans la sarcelle ; à sa
 * gauche la devise en Marcellus et les deux entrées. Dessous, un panneau orné : les espèces à découvrir et quatre
 * peintures du jeu.
 */
export default function Accueil() {
  // Tant que l'entrée du jeu est fermée, « Ouverture prochaine » tient sa place.
  const ouverte = entreeDuJeuOuverte();
  return (
    <main className={styles.accueil} data-entree="">
      <section className={styles.scene}>
        <Illustration
          chemin="accueil/plateau.webp"
          alt="Le monde de Bestia, sculpté comme un plateau de jeu : montagnes enneigées, forêts, savane, désert, jungle et, au centre, le Cœur sauvage"
          sizes="(max-width: 820px) 100vw, 720px"
          prioritaire
          className={styles.monde}
        />
        <div className={styles.titres}>
          {ouverte ? null : <span className={kit.ruban}>Ouverture prochaine</span>}
          <h1 className={styles.titre}>Un monde sauvage, des bêtes à apprivoiser.</h1>
          <p className={styles.intro}>Faites votre sac : l&apos;aventure vous attend.</p>
          {ouverte ? <EntreeDuJeu /> : null}
        </div>
      </section>

      <section className={`${kit.panneau} ${styles.galerie}`}>
        <p className={styles.chiffre}>
          <b>2000+</b>
          <span className={kit.etiquette}>espèces à découvrir</span>
        </p>
        <Illustration
          chemin="accueil/explorateurs.webp"
          alt="Deux explorateurs et leur lama découvrent une vallée"
          sizes={VIGNETTE}
          className={styles.vignette}
        />
        <Illustration chemin="accueil/mammouth.webp" alt="Un mammouth dans la neige au coucher du soleil" sizes={VIGNETTE} className={styles.vignette} />
        <Illustration chemin="prototype/ships/lightFighter.webp" alt="Un jeune loup qui hurle dans la forêt" sizes={VIGNETTE} className={styles.vignette} />
        <Illustration chemin="accueil/castors.webp" alt="Trois castors construisent un barrage" sizes={VIGNETTE} className={styles.vignette} />
      </section>
    </main>
  );
}
