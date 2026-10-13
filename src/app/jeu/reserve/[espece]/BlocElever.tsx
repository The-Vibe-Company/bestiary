"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Bloc } from "@/components/Bloc";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { PlacesDeLHabitat } from "@/components/PlacesDeLHabitat";
import { type EtatDeLElevage, elever } from "./actions";
import styles from "./BlocElever.module.css";
import { lireUneQuantite, QUANTITE_LA_PLUS_GRANDE, QUANTITE_REFUSEE } from "./quantite";

const SANS_REFUS: EtatDeLElevage = { refus: null };

/**
 * US-0812 : le bloc « Élever » de la fiche d'une Espèce dont le joueur a réuni le Couple (la fiche ne le pose que pour
 * elles), ancré en « #elever » pour que le récit du Couple réuni y mène (US-0958). Son bouton « Élever » demande
 * l'Élevage de l'Espèce (actions.ts), qui refuse toute Espèce sans Couple et le dit, juste dessous ; il reste grisé tant
 * que l'Élevage ne se lance pas : le lancement arrive avec US-0815.
 * US-0822 : au-dessus du bouton, le même compteur des Places de l'Habitat du Foyer que la page Bêtes, et sa jauge fine
 * (qui ne sert qu'aux yeux). Le bouton est celui de l'action principale du kit, éteint tant qu'il est grisé ; le refus
 * se dit en braise.
 * US-0813 : la quantité de Bêtes à élever, 1 d'abord, dans le pas du kit (« − 1 + », le champ au milieu), que « − » et
 * « + » changent d'une Bête et que « Max » porte au plus grand nombre que les Stocks de Nourriture permettent de payer
 * (`max`, cout-d-elevage.ts) ; une quantité nulle, négative ou non entière est refusée, dite en braise sous le pas dès
 * qu'elle s'écrit (ou, vide, quand on quitte le champ). Le champ prend neuf chiffres au plus, la plus grande quantité qui
 * se lit.
 * US-0843 : sous les Places, l'éleveur libre qui s'en occupera (`eleveur`, son prénom) ; sans éleveur libre, la raison,
 * avec un lien vers la page Habitants, et « Élever » grisé qui la donne pour description. Le bloc reste : l'Élevage de
 * l'Espèce est acquis sans éleveur, seul son lancement en demande un.
 */
export function BlocElever({
  especeId,
  places,
  max,
  eleveur,
}: {
  especeId: string;
  places: { occupees: number; total: number };
  max: number;
  eleveur: string | null;
}) {
  const [{ refus }, envoyer] = useActionState(elever, SANS_REFUS);
  const idRefus = useId();
  const idSansEleveur = useId();
  const idQuantite = useId();
  const idQuantiteRefusee = useId();
  const [texte, setTexte] = useState("1");
  const [quitte, setQuitte] = useState(false);
  // Ce que « − », « + » et « Max » font du champ, dit aux lecteurs d'écran : la main reste sur le bouton.
  const [annonce, setAnnonce] = useState("");
  const quantite = lireUneQuantite(texte);
  const refusee = quantite === null && (texte.trim() !== "" || quitte);
  const plafond = Math.min(max, QUANTITE_LA_PLUS_GRANDE);
  const choisir = (n: number) => {
    setTexte(String(n));
    setQuitte(false);
    setAnnonce(`Quantité : ${n}`);
  };
  return (
    <div id="elever" className={styles.elever}>
      <Bloc titre="Élever">
        <div className={styles.places}>
          <PlacesDeLHabitat {...places} />
          <Jauge valeur={Math.ceil(places.occupees)} max={places.total} fine />
        </div>
        {eleveur !== null ? (
          <p className={styles.eleveur}>
            Éleveur : <strong className={styles.prenom}>{eleveur}</strong>
          </p>
        ) : (
          <p id={idSansEleveur} className={styles.eleveur}>
            Aucun éleveur libre.{" "}
            <Link href="/jeu/habitants" className={kit.lien}>
              Habitants
            </Link>
          </p>
        )}
        <form action={envoyer} className={styles.formulaire}>
          <input type="hidden" name="espece" value={especeId} />
          <div className={styles.quantite}>
            <label htmlFor={idQuantite} className={kit.etiquette}>
              Quantité
            </label>
            <div className={styles.reglage}>
              <span className={`${kit.pas} ${kit.pasGrand} ${styles.pas}`}>
                <button
                  type="button"
                  className={`${kit.pasBouton} ${styles.pasBouton}`}
                  aria-label="Une Bête de moins"
                  disabled={quantite === null || quantite <= 1}
                  onClick={() => choisir(quantite! - 1)}
                >
                  −
                </button>
                <input
                  id={idQuantite}
                  name="quantite"
                  className={`${kit.pasValeur} ${styles.champ}`}
                  inputMode="numeric"
                  maxLength={String(QUANTITE_LA_PLUS_GRANDE).length}
                  autoComplete="off"
                  enterKeyHint="done"
                  value={texte}
                  onChange={(e) => {
                    setTexte(e.target.value);
                    setQuitte(false);
                    setAnnonce("");
                  }}
                  onBlur={() => setQuitte(true)}
                  aria-invalid={refusee ? true : undefined}
                  aria-describedby={refusee ? idQuantiteRefusee : undefined}
                />
                <button
                  type="button"
                  className={`${kit.pasBouton} ${styles.pasBouton}`}
                  aria-label="Une Bête de plus"
                  disabled={quantite !== null && quantite >= QUANTITE_LA_PLUS_GRANDE}
                  onClick={() => choisir((quantite ?? 0) + 1)}
                >
                  +
                </button>
              </span>
              <button type="button" className={`${kit.bouton} ${kit.secondaire} ${styles.max}`} disabled={plafond < 1} onClick={() => choisir(plafond)}>
                Max
              </button>
            </div>
            <output className={styles.annonce}>{annonce}</output>
            {refusee ? (
              <p id={idQuantiteRefusee} className={styles.refus} role="alert">
                {QUANTITE_REFUSEE}
              </p>
            ) : null}
          </div>
          <button type="submit" className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.bouton}`} disabled aria-describedby={[eleveur === null ? idSansEleveur : null, refus ? idRefus : null].filter(Boolean).join(" ") || undefined}>
            Élever
          </button>
          {refus ? (
            <p id={idRefus} className={styles.refus} role="alert">
              {refus}
            </p>
          ) : null}
        </form>
      </Bloc>
    </div>
  );
}
