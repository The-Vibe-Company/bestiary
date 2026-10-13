import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { suiteSure } from "@/comptes/suite";
import { PageEntree } from "@/components/PageEntree";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Se connecter" };

/**
 * La connexion (US-0115) : l'adresse et le mot de passe. « suite » dit où emmener le joueur une
 * fois connecté (US-0121) ; un joueur déjà connecté y va tout de suite, par le proxy (US-0122).
 * Fermée en production tant que l'entrée du jeu l'est.
 */
export default async function Connexion({ searchParams }: { searchParams: Promise<{ suite?: string | string[]; expiree?: string | string[] }> }) {
  if (!entreeDuJeuOuverte()) notFound();
  const { suite, expiree } = await searchParams;
  const cheminSur = suiteSure(typeof suite === "string" ? suite : null);
  return (
    <PageEntree
      titre="Se connecter"
      illustration={{ chemin: "entree/connexion.webp", alt: "Une hutte au toit de chaume, éclairée au crépuscule, au bout d'un chemin fleuri", cadrage: "50% 30%" }}
    >
      <FormulaireConnexion suite={cheminSur} sessionExpiree={expiree === "1"} />
    </PageEntree>
  );
}
