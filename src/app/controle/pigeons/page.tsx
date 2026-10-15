import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Bloc } from "@/components/Bloc";
import { Grille } from "@/components/Grille";
import { motDePasseAccepte } from "@/controle/acces";
// Les blocs et le tableau de la simulation des Raretés, son outil frère (US-0931), comme la simulation des chances.
import styles from "../raretes/raretes.module.css";
import { simulerLesPigeons } from "./simulation";

export const metadata: Metadata = { title: "Pigeons éclaireurs", robots: { index: false, follow: false } };

const nombre = (n: number) => n.toLocaleString("fr-FR");
const decimal = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** « 3,24 % », l'unité jamais seule à la ligne. */
const pourcent = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0%`;
/** « 4 h », « 20 min », « 1 h 40 ». */
const duree = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
};

/**
 * US-0974 : la simulation des pigeons éclaireurs : sur une longue période, des Expéditions identiques, sans pigeon puis
 * avec 1 à 6 Éclaireurs, leurs Rencontres et l'écart à celles sans pigeon, et les Cases sorties du brouillard en plus ; le
 * résultat du contrôle en tête. Rien n'est lu ni écrit en base. Réservée aux développeurs, comme /controle.
 */
export default async function SimulationDesPigeonsDuControle() {
  await connection();
  // Le proxy demande déjà le mot de passe ; la page vérifie à nouveau, au cas où il serait contourné.
  if (!motDePasseAccepte((await headers()).get("authorization"))) notFound();
  const s = simulerLesPigeons();
  const echecs = s.lignes.flatMap((l) =>
    l.sousLEcart ? [`${l.eclaireurs} Éclaireur${l.eclaireurs > 1 ? "s" : ""} : ${pourcent(l.ecart)} de Rencontres en plus, sous ${nombre(s.ecartMinimal)}\u00a0%`] : [],
  );

  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>Pigeons éclaireurs</h1>
        <Link href="/controle" className={styles.retour}>
          Contrôle
        </Link>
      </header>
      <Grille>
        <Bloc titre="Plus de Rencontres avec des pigeons" largeur={6} teinte={s.reussie ? "menthe" : "rose"}>
          <p className={styles.valeur}>{s.reussie ? "Contrôle réussi" : "Contrôle échoué"}</p>
          {echecs.length > 0 ? (
            <ul className={styles.echecs}>
              {echecs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <p className={styles.note}>
            {`${nombre(s.expeditions)} Expéditions identiques sur ${nombre(s.jours)} jours · Séjour ${duree(s.sejourMinutes)} · Écart minimal : ${nombre(s.ecartMinimal)}\u00a0%`}
          </p>
        </Bloc>
        <Bloc titre="Avec et sans Éclaireurs" largeur={6}>
          <div className={styles.defilement}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>Éclaireurs</th>
                  <th>Vue en plus</th>
                  <th>Rencontres</th>
                  <th>Écart</th>
                  <th>Cases révélées</th>
                  <th>En plus</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Aucun</td>
                  <td>—</td>
                  <td>{nombre(s.sans.rencontres)}</td>
                  <td>—</td>
                  <td>{decimal(s.sans.casesRevelees)}</td>
                  <td>—</td>
                </tr>
                {s.lignes.map((l) => (
                  <tr key={l.eclaireurs}>
                    <td>{l.eclaireurs}</td>
                    <td>{duree(l.vueMinutes)}</td>
                    <td>{nombre(l.rencontres)}</td>
                    <td className={l.sousLEcart ? styles.echec : undefined}>{pourcent(l.ecart)}</td>
                    <td>{decimal(l.casesRevelees)}</td>
                    <td>{decimal(l.casesEnPlus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloc>
      </Grille>
    </main>
  );
}
