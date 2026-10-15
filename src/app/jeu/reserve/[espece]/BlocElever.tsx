"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bloc } from "@/components/Bloc";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { PlacesDeLHabitat } from "@/components/PlacesDeLHabitat";
import { quantiteMontee } from "@/components/Ressources";
import { betesPayables, estUnManque, ilManque, type StockQuiPaie } from "@/monde/payer-un-elevage";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { useHeureDuJeu } from "@/temps/heure-du-jeu";
import { type EtatDeLElevage, elever } from "./actions";
import styles from "./BlocElever.module.css";
import { lireUneQuantite, QUANTITE_LA_PLUS_GRANDE, QUANTITE_REFUSEE } from "./quantite";

const SANS_REFUS: EtatDeLElevage = { refus: null };

/** US-0814 : le fuseau des joueurs, pour l'heure où naîtra la dernière Bête. */
const FUSEAU = "Europe/Paris";

const MINUTE_MS = 60_000;

/** US-0814 : ce que le bloc dit d'un coût ou d'une durée qu'il ne peut pas chiffrer (une quantité refusée, une date hors du calendrier). */
const AUCUNE = "—";

/** US-0814 : un coût en Nourriture, entier (celui d'une Bête l'est), à la française : « 1 680 », sans coupure. */
const enNourriture = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\u00a0");

const annee = new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: FUSEAU });
const jourHeureEtAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });

/**
 * US-0814 : l'heure où naîtra la dernière Bête, « 14 octobre à 03:48 », avec l'année quand ce n'est pas celle de l'heure
 * du jeu (`maintenant`) : « 12 novembre 2027 à 11:00 », pour un long Élevage.
 */
const quand = (derniere: Date, maintenant: Date) =>
  annee.format(derniere) === annee.format(maintenant) ? formaterJourEtHeure(derniere, FUSEAU) : jourHeureEtAnnee.format(derniere);

/**
 * US-0814 : ce que coûte et ce que dure l'Élevage d'une Bête de l'Espèce (src/monde/cout-d-elevage.ts) : son coût en
 * Nourriture entière, la Nourriture de son régime qui le paie, telle que la fiche la dit (« Viande ou Végétaux »), et sa durée
 * d'Élevage en minutes.
 */
export type ElevageDUneBete = { cout: number; nourriture: string; dureeMinutes: number };

/**
 * US-0812 : le bloc « Élever » de la fiche d'une Espèce dont le joueur a réuni le Couple (la fiche ne le pose que pour
 * elles), ancré en « #elever » pour que le récit du Couple réuni y mène (US-0958). Son bouton « Élever » demande
 * l'Élevage de l'Espèce (actions.ts), qui refuse toute Espèce sans Couple et le dit, juste dessous.
 * US-0816 : tant que la Nourriture du régime (`nourriture`, les Stocks qui paient) ne paie pas la quantité choisie,
 * « Élever » est grisé, et le bloc dit ce qui manque, juste au-dessus ; les Stocks montent dans le bloc comme dans la
 * barre du haut (quantiteMontee, au rythme du jeu), si bien que « Élever » s'active dès qu'ils suffisent, et « Max » suit ;
 * le lancement relit les Stocks au clic. Un refus du serveur ne vaut que pour la quantité refusée (changée, ou renvoyée,
 * il s'efface) ; faute de Nourriture, c'est la ligne de ce qui manque qui le montre, à jour.
 * US-0815 : « Élever » lance l'Élevage de la quantité choisie ; actif avec un éleveur libre et une quantité valable, grisé
 * pendant l'envoi (un double clic n'envoie qu'une demande, et le serveur n'en lance qu'une) ; lancé, le bloc le dit
 * (combien de Bêtes, confiées à quel éleveur), et la page relue montre les Stocks payés.
 * US-0822 : au-dessus du bouton, le même compteur des Places de l'Habitat du Foyer que la page Bêtes, et sa jauge fine
 * (qui ne sert qu'aux yeux). Le bouton est celui de l'action principale du kit, éteint tant qu'il est grisé ; le refus
 * se dit en braise.
 * US-0813 : la quantité de Bêtes à élever, 1 d'abord, dans le pas du kit (« − 1 + », le champ au milieu), que « − » et
 * « + » changent d'une Bête et que « Max » porte au plus grand nombre que les Stocks de Nourriture permettent de payer
 * (betesPayables, src/monde/payer-un-elevage.ts) ; une quantité nulle, négative ou non entière est refusée, dite en braise sous le pas dès
 * qu'elle s'écrit (ou, vide, quand on quitte le champ). Le champ prend neuf chiffres au plus, la plus grande quantité qui
 * se lit.
 * US-0843 : sous les Places, l'éleveur libre qui s'en occupera (`eleveur`, son prénom) ; sans éleveur libre, la raison,
 * avec un lien vers la page Habitants, et « Élever » grisé qui la donne pour description. Le bloc reste : l'Élevage de
 * l'Espèce est acquis sans éleveur, seul son lancement en demande un.
 * US-0814 : sous la quantité, ce qu'elle coûte et ce qu'elle dure, mis à jour à chaque changement : le coût total en
 * Nourriture (celui d'une Bête fois la quantité), la durée d'Élevage d'une Bête, la durée totale, et l'heure où naîtra
 * la dernière Bête d'un Élevage lancé maintenant : l'heure du jeu à l'ouverture de la fiche (`maintenant`), qui avance en
 * direct au rythme du jeu (`vitesse`, useHeureDuJeu), comme les Expéditions en cours (US-0918).
 * Une quantité refusée ne se chiffre pas.
 */
export function BlocElever({
  especeId,
  places,
  nourriture,
  eleveur,
  elevage,
  maintenant,
  vitesse = 1,
}: {
  especeId: string;
  places: { occupees: number; total: number };
  nourriture: StockQuiPaie[];
  eleveur: string | null;
  elevage: ElevageDUneBete;
  maintenant: Date;
  vitesse?: number;
}) {
  const [{ refus, lance }, envoyer, enCours] = useActionState(elever, SANS_REFUS);
  // US-0815 : l'Élevage lancé, dit dans une région toujours là (annoncée à coup sûr), où va la main : le bouton s'est grisé.
  const dit = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (lance) dit.current?.focus();
  }, [lance]);
  const idRefus = useId();
  const idSansEleveur = useId();
  const idManque = useId();
  const idQuantite = useId();
  const idQuantiteRefusee = useId();
  const [texte, setTexte] = useState("1");
  // La quantité de la dernière demande envoyée : le refus du serveur ne vaut que pour elle.
  const [demandee, setDemandee] = useState<string | null>(null);
  const [quitte, setQuitte] = useState(false);
  // Ce que « − », « + » et « Max » font du champ, dit aux lecteurs d'écran : la main reste sur le bouton.
  const [annonce, setAnnonce] = useState("");
  const quantite = lireUneQuantite(texte);
  const refusee = quantite === null && (texte.trim() !== "" || quitte);
  const lancement = useHeureDuJeu(maintenant, vitesse);
  // US-0816 : la Nourriture du régime à l'instant, montée depuis l'affichage comme dans la barre du haut.
  const ecoule = (lancement.getTime() - maintenant.getTime()) / vitesse;
  const disponible = nourriture.reduce((somme, stock) => somme + quantiteMontee(stock, ecoule, vitesse), 0);
  const plafond = Math.min(betesPayables(disponible, elevage.cout), QUANTITE_LA_PLUS_GRANDE);
  // US-0816 : le refus du serveur, tant qu'il vaut : pas pendant un nouvel envoi, et pour la quantité qu'il a refusée. Un
  // refus faute de Nourriture (les Stocks ont baissé avant le clic) ne s'affiche pas : la ligne de ce qui manque, juste
  // au-dessus du bouton, le dit à l'instant, et il est dit aux lecteurs d'écran à son arrivée (annonce).
  const refusVaut = refus !== null && !enCours && demandee === texte;
  const refusEnCours = refusVaut && !estUnManque(refus) ? refus : null;
  // Faute de Nourriture, le refus est dit aux lecteurs d'écran à son arrivée, dans la sortie de la quantité.
  const annonceDuBloc = refusVaut && estUnManque(refus) ? refus : annonce;
  // US-0816 : la Nourriture qui manque pour payer la quantité choisie, au millionième près ; rien, quand elle suffit.
  const manque = quantite === null ? 0 : Math.round((elevage.cout * quantite - disponible) * 1e6) / 1e6;
  const ceQuiManque = manque > 0 ? ilManque(manque, elevage.nourriture) : null;
  const derniere = quantite === null ? null : new Date(lancement.getTime() + quantite * elevage.dureeMinutes * MINUTE_MS);
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
        <form action={envoyer} onSubmit={() => setDemandee(texte)} className={styles.formulaire}>
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
            <output className={styles.annonce}>{annonceDuBloc}</output>
            {refusee ? (
              <p id={idQuantiteRefusee} className={styles.refus} role="alert">
                {QUANTITE_REFUSEE}
              </p>
            ) : null}
          </div>
          <dl className={`${kit.cles} ${styles.cout}`}>
            <dt>Coût</dt>
            <dd>{quantite === null ? AUCUNE : `${enNourriture(elevage.cout * quantite)} ${elevage.nourriture}`}</dd>
            <dt>Durée par Bête</dt>
            <dd>{formaterMinutes(elevage.dureeMinutes)}</dd>
            <dt>Durée totale</dt>
            <dd>{quantite === null ? AUCUNE : formaterMinutes(quantite * elevage.dureeMinutes)}</dd>
            <dt>Dernière Bête</dt>
            <dd>{derniere === null || Number.isNaN(derniere.getTime()) ? AUCUNE : quand(derniere, lancement)}</dd>
          </dl>
          {ceQuiManque ? (
            <p id={idManque} className={styles.manque}>
              {ceQuiManque}
            </p>
          ) : null}
          <button
            type="submit"
            className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.bouton}`}
            disabled={eleveur === null || quantite === null || manque > 0 || enCours}
            aria-describedby={[eleveur === null ? idSansEleveur : null, ceQuiManque ? idManque : null, refusEnCours ? idRefus : null].filter(Boolean).join(" ") || undefined}
          >
            Élever
          </button>
          {refusEnCours ? (
            <p id={idRefus} className={styles.refus} role="alert">
              {refusEnCours}
            </p>
          ) : null}
          <p ref={dit} className={styles.lance} role="status" tabIndex={-1}>
            {lance ? `Élevage lancé : ${lance.quantite} ${lance.quantite > 1 ? "Bêtes" : "Bête"}, confié à ${lance.eleveur}.` : ""}
          </p>
        </form>
      </Bloc>
    </div>
  );
}
