import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Bloc } from "@/components/Bloc";
import { Grille } from "@/components/Grille";
import { motDePasseAccepte } from "@/controle/acces";
// Les blocs, le champ, le tableau et ses échecs de la simulation des Raretés, son outil frère (US-0931).
import styles from "../raretes/raretes.module.css";
import { lireDesForces, type SimulationDesChances, simulerLesChances } from "./simulation";

export const metadata: Metadata = { title: "Chances des Rencontres", robots: { index: false, follow: false } };

/** US-0968 : les contrôles toujours simulés : deux escortes de forces 1 et 3, puis trois de forces 1, 2 et 3. */
const CONTROLES = [
  [1, 3],
  [1, 2, 3],
];

/** Les escortes d'une simulation, par lettre, dans l'ordre de leurs forces. */
const LETTRES = "ABCDEFGH";

const nombre = (n: number) => n.toLocaleString("fr-FR");
const part = (pourcent: number) => `${pourcent.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
/** « Forces 1 et 3 », « Forces 1, 2 et 3 ». */
const titre = (forces: number[]) => `Forces ${forces.slice(0, -1).join(", ")} et ${forces.at(-1)}`;

/**
 * US-0968 : la simulation des chances des Rencontres disputées : un grand nombre de Rencontres entre des Expéditions de
 * forces différentes, jugées par le vrai tirage du jeu (US-0963), la part des victoires de chaque escorte à côté de sa part
 * attendue, et le résultat du contrôle en tête : d'emblée deux escortes de forces 1 et 3, puis trois de forces 1, 2 et 3,
 * et en plus les forces saisies. Rien n'est lu ni écrit en base. Réservée aux développeurs, comme /controle.
 */
export default async function SimulationDesChancesDuControle({ searchParams }: PageProps<"/controle/chances">) {
  await connection();
  // Le proxy demande déjà le mot de passe ; la page vérifie à nouveau, au cas où il serait contourné.
  if (!motDePasseAccepte((await headers()).get("authorization"))) notFound();
  const { forces: texte } = await searchParams;
  const saisie = typeof texte === "string" ? texte.trim() : "";
  let saisies: number[] | null = null;
  let erreur: string | null = null;
  if (saisie) {
    try {
      saisies = lireDesForces(saisie);
    } catch (e) {
      erreur = e instanceof Error ? e.message : String(e);
    }
  }
  const simulations: SimulationDesChances[] = [...CONTROLES, ...(saisies ? [saisies] : [])].map((forces) => simulerLesChances({ forces }));
  const reussie = simulations.every((s) => s.reussie);
  const echecs = simulations.flatMap((s) =>
    s.parts.flatMap((p, i) => (p.horsTolerance ? [`${titre(s.forces)} · ${LETTRES[i]} (force ${p.force}) : ${part(p.obtenue)} au lieu de ${part(p.attendue)}`] : [])),
  );
  const { rencontres, tolerance } = simulations[0];

  return (
    <main className={styles.page}>
      <header className={styles.entete}>
        <h1 className={styles.titre}>Chances des Rencontres</h1>
        <Link href="/controle" className={styles.retour}>
          Contrôle
        </Link>
      </header>
      <Grille>
        <Bloc titre="Forces des escortes" largeur={6}>
          <form className={styles.graine} action="/controle/chances">
            <input
              id="forces"
              name="forces"
              autoComplete="off"
              defaultValue={saisie}
              aria-label="Forces des escortes"
              aria-invalid={erreur ? true : undefined}
              aria-describedby={erreur ? "forces-erreur" : undefined}
              className={styles.champ}
              required
            />
            <button type="submit" className={styles.bouton}>
              Simuler
            </button>
            {erreur ? (
              <p id="forces-erreur" className={styles.erreur} role="alert">
                {erreur}
              </p>
            ) : null}
          </form>
        </Bloc>
        <Bloc titre="Tirage proportionnel à la force" largeur={6} teinte={reussie ? "menthe" : "rose"}>
          <p className={styles.valeur}>{reussie ? "Contrôle réussi" : "Contrôle échoué"}</p>
          {echecs.length > 0 ? (
            <ul className={styles.echecs}>
              {echecs.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <p className={styles.note}>{`${nombre(rencontres)} Rencontres par simulation · Tolérance : ${nombre(tolerance)} point${tolerance > 1 ? "s" : ""}`}</p>
        </Bloc>
        {simulations.map((s, k) => (
          <Bloc key={`${k} ${s.forces.join(",")}`} titre={titre(s.forces)} largeur={6}>
            <div className={styles.defilement}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>Escorte</th>
                    <th>Force</th>
                    <th>Victoires</th>
                    <th>Obtenue</th>
                    <th>Attendue</th>
                  </tr>
                </thead>
                <tbody>
                  {s.parts.map((p, i) => (
                    <tr key={i}>
                      <td>{LETTRES[i]}</td>
                      <td>{p.force}</td>
                      <td>{nombre(p.victoires)}</td>
                      <td className={p.horsTolerance ? styles.echec : undefined}>{part(p.obtenue)}</td>
                      <td>{part(p.attendue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bloc>
        ))}
      </Grille>
    </main>
  );
}
