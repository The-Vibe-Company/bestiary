import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { exigerCompte } from "@/comptes/garde";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { getPool } from "@/db";
import { biomesEnBase } from "@/donnees/en-base";
import { betesReperees } from "@/expeditions/betes-reperees";
import { choixDeDestination, versLaCarte } from "@/expeditions/choix-de-destination";
import { expeditionsEnCours } from "@/expeditions/en-cours";
import { carteDuJoueur } from "@/monde/carte";
import { couleur } from "@/monde/couleurs-de-la-carte";
import { maintenant, vitesse } from "@/temps/horloge";
import { Attente } from "./Attente";
import { CarteDuJeu } from "./CarteDuJeu";
import { Legende } from "./Legende";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Carte" };

/**
 * La carte du Monde (US-0417), ouverte depuis la navigation : le Monde du joueur dans toute la place sous la barre
 * du haut, son Foyer au milieu, sans un mot de plus. US-0437 : les Cases que le joueur n'a pas découvertes sous le
 * brouillard. US-0418 : chaque Biome, et chaque eau, de sa couleur sur la page de contrôle du Monde. US-0432 : sa
 * légende, les Biomes de terre puis les eaux de leur nom en base. US-0434 : son attente, jusqu'à ce qu'elle soit
 * dessinée ; si sa lecture échoue, error.tsx. Sans session, la garde mène à la connexion, qui ramène ici. US-0907 :
 * ouverte depuis l'écran d'Expédition pour en choisir la destination (« ?choix=destination »), elle le dit à la carte,
 * avec son adresse, qui garde les autres choix de l'écran ; la connexion y ramène de même. US-0913 : les Expéditions en
 * cours du joueur, les siennes seulement, lues pour son Territoire à l'heure du jeu, avec cette heure et le rythme du jeu :
 * la carte les suit en direct. US-0948 : les Bêtes que ses Expéditions rentrées ont vues sans qu'elles les suivent, encore
 * sur leur Case à cette heure, à lui seul aussi.
 */
export default async function Carte({ searchParams }: PageProps<"/jeu/carte">) {
  await connection();
  if (!entreeDuJeuOuverte()) notFound();
  const destination = choixDeDestination(await searchParams);
  const { territoireId } = await exigerCompte(destination === null ? "/jeu/carte" : versLaCarte(destination));
  const instant = maintenant();
  const [carte, biomes, expeditions, betes] =
    territoireId === null
      ? [null, [], [], []]
      : await Promise.all([
          carteDuJoueur(getPool(), territoireId),
          biomesEnBase(getPool()),
          expeditionsEnCours(getPool(), territoireId, instant),
          betesReperees(getPool(), territoireId, instant),
        ]);
  return (
    <main className={styles.page}>
      <h1 className={styles.annonce}>Carte</h1>
      {carte ? (
        <CarteDuJeu
          carte={carte}
          fonds={carte.teintes.map(couleur)}
          destination={destination}
          expeditions={expeditions}
          betes={betes}
          maintenant={instant}
          vitesse={vitesse()}
        />
      ) : null}
      {carte ? <Attente /> : null}
      {carte ? (
        <Legende
          terre={biomes.filter((b) => b.variantes.length === 0).map((b) => ({ teinte: b.id, nom: b.nom }))}
          eaux={biomes.flatMap((b) => b.variantes).map((v) => ({ teinte: v.id, nom: v.nom }))}
        />
      ) : null}
    </main>
  );
}
