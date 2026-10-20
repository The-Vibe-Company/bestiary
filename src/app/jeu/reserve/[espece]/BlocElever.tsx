"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Bloc } from "@/components/Bloc";
import { Jauge } from "@/components/Jauge";
import kit from "@/components/kit.module.css";
import { PlacesDeLHabitat } from "@/components/PlacesDeLHabitat";
import { quantiteMontee } from "@/components/Ressources";
import { betesPayables, estUnManque, ilManque, type StockQuiPaie } from "@/monde/payer-un-elevage";
import { type ElevageEnCours, FILE_PLEINE, finDeLElevage, laFile, ouEnEstLElevage, tempsAvant } from "@/monde/suivi-d-elevage";
import { formaterJourEtHeure, formaterMinutes } from "@/temps/affichage";
import { useHeureDuJeu, useRelireLaPageA } from "@/temps/heure-du-jeu";
import { type EtatDeLElevage, elever } from "./actions";
import styles from "./BlocElever.module.css";
import { lireUneQuantite, QUANTITE_LA_PLUS_GRANDE, QUANTITE_REFUSEE } from "./quantite";

const SANS_REFUS: EtatDeLElevage = { refus: null };

/** US-0814 : le fuseau des joueurs, pour l'heure où naîtra la dernière Bête. */
const FUSEAU = "Europe/Paris";

const MINUTE_MS = 60_000;

/** US-0814 : ce que le bloc dit d'un coût ou d'une durée qu'il ne peut pas chiffrer (une quantité refusée, une date hors du calendrier). */
const AUCUNE = "—";

/** US-0814 : un entier à la française, un coût en Nourriture (celui d'une Bête l'est) ou des Bêtes : « 1 680 », sans coupure. */
const enEntier = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\u00a0");

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
 * US-0818 : pendant l'Élevage de l'Espèce (`elevageEnCours`, un seul à la fois), le bloc le suit à la place de l'éleveur
 * libre, de la quantité et du bouton : son éleveur (« Aucun » s'il n'est plus là), ses Bêtes nées sur la quantité
 * demandée, le temps avant la prochaine naissance et l'heure de la dernière, lus de l'heure du jeu, qui avance en direct :
 * le décompte avance sans recharger, et la page relue (ou ouverte ailleurs) repart du même point. Une seconde réelle après
 * chaque naissance, la page se relit (l'effectif, les Places ; l'éleveur libre et la quantité, à la fin). Lancé, l'Élevage
 * se dit aux lecteurs d'écran (la région du lancement, invisible : le suivi le montre), et la main va à son suivi.
 * US-0819 : les Élevages de l'Espèce (`elevages`, sa file : celui en cours d'abord, laFile) ; sous le suivi, la file de
 * ceux qui le suivront, chacun sa quantité et l'heure de sa dernière Bête ; puis la quantité, le coût et la durée d'un
 * Élevage à ajouter, qui partira à la fin de la file (sa dernière Bête s'en compte), et « Ajouter à la file » à la place
 * d'« Élever », qui le dit à la demande (« file ») ; grisé, file pleine (FILE_PLEINE, dit au-dessus). L'éleveur libre ne
 * compte pas : la file est celle de l'éleveur de l'Espèce. Ajouté, l'Élevage se dit comme un lancement.
 */
export function BlocElever({
  especeId,
  places,
  nourriture,
  eleveur,
  elevage,
  elevages = [],
  maintenant,
  vitesse = 1,
}: {
  especeId: string;
  places: { occupees: number; total: number };
  nourriture: StockQuiPaie[];
  eleveur: string | null;
  elevage: ElevageDUneBete;
  elevages?: ElevageEnCours[];
  maintenant: Date;
  vitesse?: number;
}) {
  const [{ refus, lance }, envoyer, enCours] = useActionState(elever, SANS_REFUS);
  const suivi = useRef<HTMLElement>(null);
  // US-0819 : la file de l'Espèce : l'Élevage en cours, ceux qui suivent, et l'instant où elle finit.
  const file = laFile(elevages);
  const elevageEnCours = file.enCours;
  const suiviAffiche = elevageEnCours !== null;
  const idRefus = useId();
  const idSansEleveur = useId();
  const idManque = useId();
  const idQuantite = useId();
  const idQuantiteRefusee = useId();
  const [texte, setTexte] = useState("1");
  // La quantité de la dernière demande envoyée : le refus du serveur ne vaut que pour elle.
  const [demandee, setDemandee] = useState<string | null>(null);
  // US-0818 : le suivi qui paraît ou s'en va, à la page relue, tourne la page du formulaire : la réponse à la demande
  // d'avant ne vaut plus (un refus ne revient pas avec le formulaire, à la fin), et l'Élevage lancé d'ici n'est plus à
  // dire une fois fini (`lanceDit`). Le suivi qui paraît prend la main (`prendLaMain`, décidé à cet instant) pour un
  // Élevage tout juste lancé d'ici, ou quand le formulaire, qui s'en va, l'avait (un refus parce qu'un autre appareil
  // l'a lancé) ; jamais à l'ouverture de la fiche, ni quand elle est ailleurs, sur une relecture de fond.
  const [formulaireALaMain, setFormulaireALaMain] = useState(false);
  const [vue, setVue] = useState({ suivi: suiviAffiche, lanceDit: lance, prendLaMain: false });
  const lanceNouveau = lance !== undefined && lance !== vue.lanceDit;
  if (vue.suivi !== suiviAffiche) {
    setVue({ suivi: suiviAffiche, lanceDit: suiviAffiche ? vue.lanceDit : lance, prendLaMain: suiviAffiche && (lanceNouveau || formulaireALaMain) });
    setDemandee(null);
    setFormulaireALaMain(false);
  }
  useEffect(() => {
    if (vue.suivi && vue.prendLaMain) suivi.current?.focus();
  }, [vue.suivi, vue.prendLaMain]);
  const idSuivi = useId();
  const idFile = useId();
  const idFilePleine = useId();
  const [quitte, setQuitte] = useState(false);
  // Ce que « − », « + » et « Max » font du champ, dit aux lecteurs d'écran : la main reste sur le bouton.
  const [annonce, setAnnonce] = useState("");
  const quantite = lireUneQuantite(texte);
  const refusee = quantite === null && (texte.trim() !== "" || quitte);
  const lancement = useHeureDuJeu(maintenant, vitesse);
  // US-0818 : où en est l'Élevage en cours, à l'heure du jeu qui avance ; la page relue à sa prochaine naissance.
  const enCeMoment = elevageEnCours ? ouEnEstLElevage(elevageEnCours, lancement) : null;
  useRelireLaPageA(elevageEnCours ? ouEnEstLElevage(elevageEnCours, maintenant).prochaine : null, maintenant, vitesse);
  // US-0816 : la Nourriture du régime à l'instant, montée depuis l'affichage comme dans la barre du haut.
  const ecoule = (lancement.getTime() - maintenant.getTime()) / vitesse;
  const disponible = nourriture.reduce((somme, stock) => somme + quantiteMontee(stock, ecoule, vitesse), 0);
  const plafond = Math.min(betesPayables(disponible, elevage.cout), QUANTITE_LA_PLUS_GRANDE);
  // US-0816 : le refus du serveur, tant qu'il vaut : pas pendant un nouvel envoi, ni une fois la quantité changée. Un
  // refus faute de Nourriture (les Stocks ont baissé avant le clic) ne s'affiche pas : la ligne de ce qui manque, juste
  // au-dessus du bouton, le dit à l'instant, et il est dit aux lecteurs d'écran à son arrivée (annonce).
  const refusVaut = refus !== null && !enCours && demandee === texte;
  const refusEnCours = refusVaut && !estUnManque(refus) ? refus : null;
  // Faute de Nourriture, le refus est dit aux lecteurs d'écran à son arrivée, dans la sortie de la quantité.
  const annonceDuBloc = refusVaut && estUnManque(refus) ? refus : annonce;
  // US-0816 : la Nourriture qui manque pour payer la quantité choisie, au millionième près ; rien, quand elle suffit.
  const manque = quantite === null ? 0 : Math.round((elevage.cout * quantite - disponible) * 1e6) / 1e6;
  const ceQuiManque = manque > 0 ? ilManque(manque, elevage.nourriture) : null;
  // US-0819 : un Élevage ajouté part à la fin de la file ; sans file, à l'instant.
  const debutDuProchain = file.fin !== null && file.fin.getTime() > lancement.getTime() ? file.fin : lancement;
  const derniere = quantite === null ? null : new Date(debutDuProchain.getTime() + quantite * elevage.dureeMinutes * MINUTE_MS);
  const peutPartir = suiviAffiche ? !file.pleine : eleveur !== null;
  const choisir = (n: number) => {
    setTexte(String(n));
    setQuitte(false);
    setAnnonce(`Quantité : ${n}`);
    // Une autre quantité choisie : la réponse du serveur à la demande précédente ne vaut plus, même en y revenant.
    setDemandee(null);
  };
  return (
    <div id="elever" className={styles.elever}>
      <Bloc titre="Élever">
        <div className={styles.places}>
          <PlacesDeLHabitat {...places} />
          <Jauge valeur={Math.ceil(places.occupees)} max={places.total} fine />
        </div>
        {elevageEnCours && enCeMoment ? (
          <section ref={suivi} tabIndex={-1} aria-labelledby={idSuivi} className={styles.suivi}>
            <h3 id={idSuivi} className={kit.etiquette}>
              Élevage en cours
            </h3>
            <dl className={`${kit.cles} ${styles.chiffres}`}>
              <dt>Éleveur</dt>
              <dd>{elevageEnCours.eleveur ?? "Aucun"}</dd>
              <dt>Bêtes nées</dt>
              <dd>{`${enEntier(enCeMoment.nees)} / ${enEntier(elevageEnCours.quantite)}`}</dd>
              <dt>Prochaine Bête</dt>
              <dd>{enCeMoment.prochaine ? `dans ${tempsAvant(enCeMoment.prochaine, lancement)}` : AUCUNE}</dd>
              <dt>Dernière Bête</dt>
              <dd>{Number.isNaN(enCeMoment.derniere.getTime()) ? AUCUNE : quand(enCeMoment.derniere, lancement)}</dd>
            </dl>
          </section>
        ) : null}
        {/* US-0819 : les Élevages qui suivront celui en cours, chacun sa quantité et l'heure de sa dernière Bête. */}
        {file.suite.length > 0 ? (
          <section aria-labelledby={idFile} className={styles.file}>
            <h3 id={idFile} className={kit.etiquette}>
              File
            </h3>
            <ol className={styles.listeFile}>
              {file.suite.map((e, i) => (
                <li key={i}>
                  <span className={styles.quantiteEnFile}>{`${enEntier(e.quantite)} ${e.quantite > 1 ? "Bêtes" : "Bête"}`}</span>
                  <span className={styles.finEnFile}>{quand(finDeLElevage(e), lancement)}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {suiviAffiche ? null : eleveur !== null ? (
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
        <form
          action={envoyer}
          onSubmit={() => setDemandee(texte)}
          onFocus={() => setFormulaireALaMain(true)}
          onBlur={() => setFormulaireALaMain(false)}
          className={styles.formulaire}
        >
          <input type="hidden" name="espece" value={especeId} />
          {suiviAffiche ? <input type="hidden" name="file" value="1" /> : null}
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
                    setDemandee(null);
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
            <dd>{quantite === null ? AUCUNE : `${enEntier(elevage.cout * quantite)} ${elevage.nourriture}`}</dd>
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
          {suiviAffiche && file.pleine ? (
            <p id={idFilePleine} className={styles.manque}>
              {FILE_PLEINE}
            </p>
          ) : null}
          <button
            type="submit"
            className={`${kit.bouton} ${kit.principal} ${kit.grand} ${styles.bouton}`}
            disabled={!peutPartir || quantite === null || manque > 0 || enCours}
            aria-describedby={
              [
                !suiviAffiche && eleveur === null ? idSansEleveur : null,
                suiviAffiche && file.pleine ? idFilePleine : null,
                ceQuiManque ? idManque : null,
                refusEnCours ? idRefus : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            {suiviAffiche ? "Ajouter à la file" : "Élever"}
          </button>
          {refusEnCours ? (
            <p id={idRefus} className={styles.refus} role="alert">
              {refusEnCours}
            </p>
          ) : null}
        </form>
        <p className={styles.lance} role="status">
          {lance && lanceNouveau
            ? `${lance.enFile ? "Élevage ajouté à la file" : "Élevage lancé"} : ${lance.quantite} ${lance.quantite > 1 ? "Bêtes" : "Bête"}, confié à ${lance.eleveur}.`
            : ""}
        </p>
      </Bloc>
    </div>
  );
}
