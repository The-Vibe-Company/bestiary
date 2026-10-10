import { describe, expect, it } from "vitest";
import { resumeDUnRetour } from "./resume-du-retour";

describe("le résumé en tête du récit de retour, fait par fait (US-0941)", () => {
  const apprivoisee = { issue: "apprivoisee" as const, nouvelleEspece: false };
  const nouvelle = { issue: "restee" as const, nouvelleEspece: true };

  it("dit toujours les Bêtes ramenées, « Aucune » quand l'Expédition rentre bredouille", () => {
    expect(resumeDUnRetour([], 0)).toEqual(["Aucune Bête ramenée"]);
    expect(resumeDUnRetour([apprivoisee], 0)).toEqual(["1 Bête ramenée"]);
    expect(resumeDUnRetour([apprivoisee, apprivoisee, { issue: "repartie", nouvelleEspece: false }], 0)).toEqual(["2 Bêtes ramenées"]);
  });

  it("puis les nouvelles Espèces au Bestiaire, s'il y en a, qu'elles aient suivi l'Expédition ou non", () => {
    expect(resumeDUnRetour([nouvelle], 0)).toEqual(["Aucune Bête ramenée", "1 nouvelle Espèce au Bestiaire"]);
    expect(resumeDUnRetour([{ ...apprivoisee, nouvelleEspece: true }, nouvelle], 0)).toEqual(["1 Bête ramenée", "2 nouvelles Espèces au Bestiaire"]);
  });

  it("puis les pertes, s'il y en a", () => {
    expect(resumeDUnRetour([apprivoisee], 1)).toEqual(["1 Bête ramenée", "1 Bête perdue"]);
    expect(resumeDUnRetour([nouvelle], 3)).toEqual(["Aucune Bête ramenée", "1 nouvelle Espèce au Bestiaire", "3 Bêtes perdues"]);
  });
});
