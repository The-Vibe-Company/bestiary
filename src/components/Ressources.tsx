"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { productionAffichee, quantiteAffichee, quantiteDetaillee, soldeAffiche, soldeEnMots, soldeHoraire } from "@/monde/quantite";
import { PRESQUE_PLEIN_POURCENT, RECALER_LA_BARRE_MINUTES } from "@/reglages";
import { formaterDuree } from "@/temps/affichage";
import { iconeDeRessource } from "./icone-de-ressource";
import styles from "./BarreHaut.module.css";

type Famille = "nourriture" | "materiaux";

/**
 * Ce que la barre montre d'un Stock : la Ressource, sa famille, sa quantité exacte, sa production horaire,
 * l'Entretien pris sur lui par heure (US-0316) et ses sources, en texte.
 */
export type RessourceDeLaBarre = {
  id: string;
  nom: string;
  famille: Famille;
  quantite: string;
  limite: string;
  parHeure: string;
  entretienParHeure: string;
  sources: { libelle: string; parHeure: string }[];
};

/** US-0205 : les deux groupes de Ressources, sous les mots du glossaire. */
const NOM_DE_FAMILLE: Record<Famille, string> = { nourriture: "Nourriture", materiaux: "Matériaux" };

/** Les Ressources rangées par famille, dans leur ordre : la Nourriture, puis les Matériaux. */
function parFamille(stocks: RessourceDeLaBarre[]): { famille: Famille; stocks: RessourceDeLaBarre[] }[] {
  const groupes: { famille: Famille; stocks: RessourceDeLaBarre[] }[] = [];
  for (const stock of stocks) {
    const dernier = groupes.at(-1);
    if (dernier?.famille === stock.famille) dernier.stocks.push(stock);
    else groupes.push({ famille: stock.famille, stocks: [stock] });
  }
  return groupes;
}

/**
 * US-0213 : la quantité d'un Stock `ecoule` millisecondes réelles après sa lecture, au rythme du jeu
 * (accéléré comme lui) : elle monte de sa production et descend de l'Entretien pris sur lui (US-0316),
 * sans passer sous zéro ni dépasser la limite (US-0221). Au-dessus de sa limite (US-0230), le Stock ne
 * produit plus : seul l'Entretien le fait descendre, jusqu'à elle ; sans Entretien, il ne bouge pas.
 */
export function quantiteMontee(stock: Pick<RessourceDeLaBarre, "quantite" | "limite" | "parHeure" | "entretienParHeure">, ecoule: number, vitesse: number): number {
  const quantite = Number(stock.quantite);
  const limite = Number(stock.limite);
  const entretien = Number(stock.entretienParHeure);
  let heures = (vitesse * Math.max(0, ecoule)) / 3_600_000;
  let depart = quantite;
  if (quantite > limite) {
    if (entretien * heures <= quantite - limite) return quantite - entretien * heures;
    heures -= (quantite - limite) / entretien;
    depart = limite;
  }
  return Math.min(limite, Math.max(0, depart + (Number(stock.parHeure) - entretien) * heures));
}

/**
 * Les quatre ressources du joueur dans la barre du haut (US-0203), toujours dans l'ordre Viande,
 * Végétaux, Bois, Pierre : leur icône, puis la quantité (US-0204), en deux groupes séparés d'un
 * trait, la Nourriture et les Matériaux (US-0205). Le nom de la ressource est le texte de l'icône ;
 * avec celui de son groupe, il paraît dans une bulle au survol ou au toucher, que toucher ailleurs
 * ou Échap referme. Au milieu de la barre ; sur mobile, en bande juste en dessous (voir formes.css).
 *
 * US-0213 : page ouverte, les quantités montent d'elles-mêmes au rythme de la production, depuis leur
 * arrivée dans la page ; la barre se recale sur les quantités exactes du jeu toutes les
 * RECALER_LA_BARRE_MINUTES minutes et dès qu'on revient sur l'onglet (une action, elle, recharge déjà
 * la page). De nouvelles quantités arrivent avec une nouvelle clé (ActionsDuJeu) : tout repart d'elles.
 *
 * US-0319 : à côté de chaque quantité, son solde horaire, production moins Entretien ; le détail de la
 * Nourriture met la production d'un côté, l'Entretien de l'autre. Sur mobile, le détail s'ouvre dans un
 * panneau en bas de l'écran, au-dessus des onglets.
 *
 * `children` : ce qui suit les ressources dans la même bande, hors de leur groupe : le compteur
 * d'Habitants (US-0304).
 */
export function Ressources({ stocks, vitesse = 1, children }: { stocks: RessourceDeLaBarre[]; vitesse?: number; children?: ReactNode }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [ecoule, setEcoule] = useState<number | null>(null);
  const racine = useRef<HTMLDivElement>(null);
  const routeur = useRouter();

  useEffect(() => {
    // Le temps écoulé depuis l'arrivée des quantités, sur l'horloge du navigateur : sans écart possible avec celle du serveur.
    const depart = performance.now();
    const battement = setInterval(() => setEcoule(performance.now() - depart), 1000);
    const recalage = setInterval(() => routeur.refresh(), RECALER_LA_BARRE_MINUTES * 60_000);
    const retour = () => {
      if (document.visibilityState === "visible") routeur.refresh();
    };
    document.addEventListener("visibilitychange", retour);
    return () => {
      clearInterval(battement);
      clearInterval(recalage);
      document.removeEventListener("visibilitychange", retour);
    };
  }, [routeur]);

  useEffect(() => {
    if (!ouverte) return;
    const toucherDehors = (evenement: PointerEvent) => {
      if (!racine.current?.contains(evenement.target as Node)) setOuverte(null);
    };
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setOuverte(null);
    };
    document.addEventListener("pointerdown", toucherDehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", toucherDehors);
      document.removeEventListener("keydown", touche);
    };
  }, [ouverte]);

  return (
    <div className={styles.ressources} data-bande-ressources="">
      <div ref={racine} role="group" className={styles.groupes} aria-label="Ressources">
      {parFamille(stocks).map((groupe) => (
        <ul key={groupe.famille} className={styles.groupe} aria-label={NOM_DE_FAMILLE[groupe.famille]}>
          {groupe.stocks.map((stock) => {
            const quantite = ecoule === null ? Number(stock.quantite) : quantiteMontee(stock, ecoule, vitesse);
            // US-0224 : un Stock plein se signale dans la barre, par la couleur et par le mot « plein ».
            const plein = quantite >= Number(stock.limite);
            // US-0227 : avant d'être plein, le Stock prévient, d'une autre couleur.
            const presquePlein = !plein && quantite >= (Number(stock.limite) * PRESQUE_PLEIN_POURCENT) / 100;
            // US-0316 : ce que le Stock gagne par heure, Entretien payé ; US-0319 : son solde horaire, dans la barre.
            const montee = soldeHoraire(stock.parHeure, stock.entretienParHeure);
            // US-0319 : un Stock plein dont l'Entretien mange plus que la production ne perd rien : il baisse, et la barre le montre.
            const productionPerdue = plein && montee >= 0;
            const solde = soldeAffiche(montee);
            return (
            <li key={stock.id} className={styles.ressource} data-ouverte={ouverte === stock.id ? "" : undefined} data-plein={plein ? "" : undefined} data-presque-plein={presquePlein ? "" : undefined}>
              <button type="button" className={styles.boutonRessource} onClick={() => setOuverte((avant) => (avant === stock.id ? null : stock.id))}>
                <Image src={iconeDeRessource(stock.id)} alt={stock.nom} width={22} height={22} className={styles.icone} />
                {/* Une espace entre le nom et la quantité, pour qu'un lecteur d'écran dise « Pierre 42 ». */}{" "}
                <span className={styles.quantite}>{quantiteAffichee(quantite)}</span>
                {presquePlein ? <span className={styles.annonce}>, presque plein</span> : null}
                {plein ? (
                  <>
                    {" "}
                    <span className={styles.plein}>plein</span>
                  </>
                ) : null}
                {/*
                  US-0212 : la production horaire ; plus discrète quand elle est nulle. Un Stock plein n'en a plus : « PLEIN » en tient lieu (US-0225).
                  US-0319 : c'est le solde, production moins Entretien ; négatif, il prend la couleur d'alerte.
                */}
                {productionPerdue ? (
                  <span className={styles.annonce}>, production perdue</span>
                ) : (
                  <span className={styles.solde} data-nulle={solde === "0/h" ? "" : undefined} data-negatif={montee < 0 ? "" : undefined}>
                    <span aria-hidden="true">{solde}</span>
                    <span className={styles.annonce}>, {soldeEnMots(montee)}</span>
                  </span>
                )}
              </button>
              {/*
                US-0214 : le détail de la ressource, au survol, au clavier ou au toucher : son nom et son groupe,
                sa quantité exacte et d'où vient sa production. Le nom, la quantité et la production sont déjà
                dits au lecteur d'écran par le bouton : la bulle ne sert qu'aux yeux.
              */}
              <span className={styles.bulle} aria-hidden="true">
                <span className={styles.nomBulle}>{stock.nom}</span>
                <span className={styles.groupeBulle}>{NOM_DE_FAMILLE[stock.famille]}</span>
                {/* US-0223 : la quantité et la limite, avec la jauge de remplissage. */}
                <span className={styles.quantiteBulle}>
                  {quantiteDetaillee(quantite)} / {quantiteAffichee(stock.limite)}
                </span>
                <span className={styles.jauge}>
                  <span className={styles.remplissage} style={{ width: `${Math.min(100, (quantite / Number(stock.limite)) * 100)}%` }} />
                </span>
                {/* US-0319 : pour la Nourriture, la production d'un côté, l'Entretien de l'autre, puis le solde. */}
                {stock.famille === "nourriture" ? (
                  <>
                    <span className={styles.ligneBilan}>
                      <span>Production</span> <span className={styles.valeurBilan}>{soldeAffiche(Number(stock.parHeure))}</span>
                    </span>
                    <span className={styles.ligneBilan}>
                      <span>Entretien</span> <span className={styles.valeurBilan}>{soldeAffiche(-Number(stock.entretienParHeure))}</span>
                    </span>
                    <span className={`${styles.ligneBilan} ${styles.soldeBilan}`}>
                      <span>Solde</span>{" "}
                      <span className={styles.valeurBilan} data-negatif={montee < 0 ? "" : undefined}>
                        {solde}
                      </span>
                    </span>
                  </>
                ) : null}
                {productionPerdue ? (
                  <>
                    {/* US-0225 : ce que coûte l'attente, et ce qui reprendra. */}
                    <span className={styles.perdue}>Stock plein : la production de {stock.nom} est perdue.</span>
                    {Number(stock.parHeure) > 0 ? (
                      <span className={`${styles.sourceBulle} ${styles.reprise}`}>Elle reprendra à {productionAffichee(stock.parHeure)} dès qu&apos;il y aura de la place.</span>
                    ) : null}
                  </>
                ) : Number(stock.parHeure) > 0 ? (
                  <>
                    {/* US-0226 : dans combien de temps, au rythme du jeu, ce Stock sera plein ; US-0316 : s'il monte encore, Entretien payé. */}
                    {montee > 0 ? (
                      <span className={styles.sourceBulle}>plein dans {formaterDuree((Number(stock.limite) - quantite) / (montee * vitesse))}</span>
                    ) : null}
                    {stock.sources.map((source) => (
                      <span key={source.libelle} className={styles.sourceBulle}>
                        {source.libelle} : {productionAffichee(source.parHeure)}
                      </span>
                    ))}
                  </>
                ) : stock.sources.length === 0 ? (
                  <span className={styles.sourceBulle}>{productionAffichee(0)}</span>
                ) : (
                  stock.sources.map((source) => (
                    <span key={source.libelle} className={styles.sourceBulle}>
                      {source.libelle} : {productionAffichee(source.parHeure)}
                    </span>
                  ))
                )}
                {/* US-0319 : sur mobile, le détail est un panneau en bas de l'écran, qui se ferme aussi d'un bouton ; Échap et le bouton de la ressource le font au clavier. */}
                <button type="button" className={styles.fermer} tabIndex={-1} onClick={() => setOuverte(null)}>
                  Fermer
                </button>
              </span>
            </li>
            );
          })}
        </ul>
      ))}
      </div>
      {children}
    </div>
  );
}
