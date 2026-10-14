import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { Echantillon } from "@/app/jeu/carte/Echantillon";
import { IllustrationEspece } from "@/components/IllustrationEspece";
import kit from "@/components/kit.module.css";
import { PastilleRarete } from "@/components/PastilleRarete";
import { getPool } from "@/db";
import { blessesAuFoyer } from "@/monde/blesses";
import { blessesAffiches, blessesDans } from "@/monde/blesses-affiches";
import { coutDUneBeteElevee, dureeDUneBeteEleveeMinutes, maxAElever } from "@/monde/cout-d-elevage";
import { blessesParEspece, especeDuTerritoire, type Regime } from "@/monde/effectif";
import { elevageAcquis, eleveurLibre } from "@/monde/elevage";
import { placesDeLHabitat } from "@/monde/habitat";
import { caracteristiqueAffichee as nombre } from "@/monde/quantite";
import { maintenant, vitesse } from "@/temps/horloge";
import { BlocElever } from "./BlocElever";
import { Caracteristique, Effectif } from "./Explication";
import styles from "./page.module.css";

// Le titre reste celui de la Réserve : le nom d'une Espèce ne se lit pas sans la garde.
export const metadata: Metadata = { title: "Réserve" };

/** US-0805 : « 1 Place », « 1,5 Place », « 31,623 Places » : le pluriel à partir de deux. */
const places = (taille: number) => `${nombre(taille)}\u00a0${taille >= 2 ? "Places" : "Place"}`;

/**
 * US-0805 : le régime d'une Espèce, et la Nourriture de son Entretien : la Viande pour un carnivore, les Végétaux pour un
 * herbivore, l'une ou l'autre pour un omnivore (ce qu'il mange vraiment se décidera avec US-0826).
 */
const REGIMES: Record<Regime, { nom: string; nourriture: string }> = {
  carnivore: { nom: "Carnivore", nourriture: "Viande" },
  herbivore: { nom: "Herbivore", nourriture: "Végétaux" },
  omnivore: { nom: "Omnivore", nourriture: "Viande ou Végétaux" },
};

/**
 * US-0806 : la teinte de la carte qui sert de pictogramme au Biome d'Habitat : la sienne, sauf pour l'eau, que la carte
 * ne dessine que par ses formes (côte, lac, rivière, mer) : la mer, de la couleur de l'eau, la représente.
 */
const teinteDuBiome = (biome: string) => (biome === "eau" ? "mer" : biome);

/** US-0803 : un identifiant d'Espèce, tel que les données du jeu les écrivent (« souris », « peu_commune »). */
const IDENTIFIANT = /^[a-z0-9_]{1,64}$/;

/**
 * US-0803 : la fiche de l'Espèce d'un Couple de la Réserve, qu'ouvre sa carte : son illustration en grand, son nom en
 * titre et sa Rareté, sur la pastille de ses couleurs. « Fermer » ramène à la Réserve. Seulement pour une Espèce dont le
 * joueur a réuni le Couple ou, US-0810, a des Bêtes : toute autre adresse est introuvable, sans dire si un autre joueur en
 * a.
 *
 * US-0810 : elle s'ouvre aussi depuis la page Bêtes (especeDuTerritoire), et rappelle l'effectif de l'Espèce, vide quand
 * ses seules Bêtes forment le Couple. Ouverte depuis la page Bêtes (`?depuis=betes`), « Fermer » y ramène.
 *
 * US-0952 : sous l'effectif, avant les caractéristiques, chaque groupe de Blessés au Foyer de l'Espèce et le temps qui lui
 * reste avant sa guérison, comme sur la page Bêtes, en note discrète ; rien sans Blessé. US-0960 : jamais plus que ses
 * Blessés au Foyer (blessesParEspece).
 *
 * US-0804 : sous l'effectif, ses caractéristiques telles que la base les a enregistrées, les mêmes pour tous les
 * joueurs : l'attaque, la vie, la vitesse en km/h et la charge, un nom et une valeur chacune, sans phrase à vue. Toutes
 * sont toujours là : une Espèce à qui il en manque une ne se charge pas en base (src/donnees/jeux.ts). US-0805 : puis
 * sa taille en Places occupées par Bête, son régime et son Entretien par heure et par Bête, dans la Nourriture de son
 * régime. US-0806 : enfin son Biome d'Habitat, son nom précédé de son pictogramme, la Case du Biome dessinée comme sur
 * la carte et sa légende, et son Rôle, ou « Aucun Rôle ».
 *
 * US-0807 : le nom de l'effectif et de chaque caractéristique ouvre son explication d'une phrase, dessous ; un toucher
 * ailleurs, Échap ou son bouton la referment (Explication.tsx, explications.ts). Au clavier, l'ordre reste celui de la
 * lecture, « Fermer » en dernier, même sur un téléphone couché où il s'affiche en haut à droite.
 *
 * Sur le fond du jeu, un panneau orné : la peinture de l'Espèce dans son filet vert ; son nom en Bree Serif, sa Rareté
 * en puce, l'effectif en grand, puis ses caractéristiques sous un filet doux ; « Fermer », un bouton au contour vert.
 */
export default async function FicheDeLEspece({
  params,
  searchParams,
}: {
  params: Promise<{ espece: string }>;
  searchParams: Promise<{ depuis?: string | string[] }>;
}) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const { espece } = await params;
  if (!IDENTIFIANT.test(espece)) notFound();
  const { territoireId } = await exigerCompte(`/jeu/reserve/${espece}`);
  // US-0810 : l'Espèce de la fiche, dont le joueur a réuni le Couple ou a des Bêtes, avec son effectif.
  const fiche = territoireId === null ? null : await especeDuTerritoire(getPool(), territoireId, espece);
  if (!fiche) notFound();
  const retour = (await searchParams).depuis === "betes" ? "/jeu/betes" : "/jeu/reserve";
  const instant = maintenant();
  const groupes = fiche.effectif > 0 && territoireId !== null ? ((await blessesAuFoyer(getPool(), territoireId, instant)).get(fiche.especeId) ?? []) : [];
  // US-0960 : jamais plus que ses Blessés au Foyer, sexe par sexe (un Blessé parti en Réserve avec son Couple n'y est plus).
  const plafond = groupes.length > 0 && territoireId !== null ? ((await blessesParEspece(getPool(), territoireId, instant)).get(fiche.especeId) ?? 0) : 0;
  const blesses = blessesAffiches(groupes, instant, plafond);
  return (
    <main className={styles.page}>
      <article className={`${kit.panneau} ${styles.fiche}`}>
        <IllustrationEspece espece={fiche} format="grand" className={`${kit.vignette} ${styles.illustration}`} />
        <div className={styles.entete}>
          <h1 className={styles.nom}>{fiche.nom}</h1>
          <PastilleRarete rarete={fiche.rarete} />
          <Effectif nombre={fiche.effectif} />
          {blesses.map((groupe, i) => (
            <p key={i} className={`${kit.note} ${styles.blesses}`}>
              {`dont ${blessesDans(groupe)}`}
            </p>
          ))}
          <dl className={styles.caracteristiques}>
            <Caracteristique nom="Attaque">{nombre(fiche.attaque)}</Caracteristique>
            <Caracteristique nom="Vie">{nombre(fiche.vie)}</Caracteristique>
            <Caracteristique nom="Vitesse">{nombre(fiche.vitesse)}&nbsp;km/h</Caracteristique>
            <Caracteristique nom="Charge">{nombre(fiche.charge)}</Caracteristique>
            <Caracteristique nom="Taille">{places(fiche.taille)}</Caracteristique>
            <Caracteristique nom="Régime">{REGIMES[fiche.regime].nom}</Caracteristique>
            <Caracteristique nom="Entretien">
              {nombre(fiche.entretienParHeure)}&nbsp;{REGIMES[fiche.regime].nourriture}&nbsp;/&nbsp;h
            </Caracteristique>
            <Caracteristique nom="Habitat" className={styles.habitat}>
              <Echantillon teinte={teinteDuBiome(fiche.biome.id)} />
              {fiche.biome.nom}
            </Caracteristique>
            <Caracteristique nom="Rôle">{fiche.role ? fiche.role.nom : "Aucun Rôle"}</Caracteristique>
          </dl>
        </div>
        <Link href={retour} className={`${kit.bouton} ${kit.secondaire} ${styles.fermer}`}>
          Fermer
        </Link>
      </article>
      {territoireId !== null && (await elevageAcquis(getPool(), territoireId, espece)) ? <BlocElever especeId={espece} places={await placesDeLHabitat(getPool(), territoireId)} max={await maxAElever(getPool(), territoireId, espece)} eleveur={(await eleveurLibre(getPool(), territoireId))?.prenom ?? null} elevage={{ cout: coutDUneBeteElevee(fiche.entretienParHeure), nourriture: REGIMES[fiche.regime].nourriture, dureeMinutes: dureeDUneBeteEleveeMinutes(fiche.taille) }} maintenant={instant} vitesse={vitesse()} /> : null}
    </main>
  );
}
