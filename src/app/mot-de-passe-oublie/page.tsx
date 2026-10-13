import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { entreeDuJeuOuverte } from "@/comptes/ouverture";
import { PageEntree } from "@/components/PageEntree";
import { FormulaireOubli } from "./FormulaireOubli";

export const metadata: Metadata = { title: "Mot de passe oublié" };

/** Demander un lien pour changer de mot de passe (US-0126). Fermée en production tant que l'entrée du jeu l'est. */
export default function MotDePasseOublie() {
  if (!entreeDuJeuOuverte()) notFound();
  return (
    <PageEntree
      titre="Mot de passe oublié"
      illustration={{ chemin: "entree/connexion.webp", alt: "Une hutte au toit de chaume, éclairée au crépuscule, au bout d'un chemin fleuri", cadrage: "50% 30%" }}
    >
      <FormulaireOubli />
    </PageEntree>
  );
}
