import { describe, expect, it } from "vitest";
import { pertesDuCombat } from "./combat";
import { combatsRejoues } from "./recit-du-combat";

/** Une escorte de 10 Poules de force 1 000 et de 20 Souris grises de force 100 : 12 000 en tout. */
const ESCORTE = [
  { especeId: "poule", force: 1_000, nombre: 10 },
  { especeId: "souris", force: 100, nombre: 20 },
];
const le = (minute: number) => new Date(Date.UTC(2026, 9, 9, 12, minute));

describe("les combats d'une Expédition, rejoués pour son récit (US-0947)", () => {
  it("pour chacun, dans l'ordre reçu : l'instant, la Bête et sa force, et la force de l'escorte d'alors, sans les Bêtes que les combats précédents lui ont prises", () => {
    const combats = combatsRejoues(ESCORTE, [
      { rencontreId: 7, le: le(5), nom: "Pigeon biset", force: 15_000 },
      { rencontreId: 9, le: le(40), nom: "Poule", force: 20_000 },
    ]);
    const premieres = pertesDuCombat(15_000, ESCORTE);
    expect(premieres.length).toBeGreaterThan(0);
    const survivantes = ESCORTE.map((e) => ({ ...e, nombre: e.nombre - (premieres.find((p) => p.especeId === e.especeId)?.nombre ?? 0) }));
    expect(combats).toEqual([
      { rencontreId: 7, le: le(5), bete: { nom: "Pigeon biset", force: 15_000 }, escorte: 12_000, sansEscorte: false },
      // Le second combat ne compte que les survivantes du premier.
      { rencontreId: 9, le: le(40), bete: { nom: "Poule", force: 20_000 }, escorte: survivantes.reduce((n, e) => n + e.force * e.nombre, 0), sansEscorte: false },
    ]);
    expect(combats[1].escorte).toBeLessThan(12_000);
  });

  it("une escorte perdue tout entière : le combat suivant se livre sans escorte ; sans escorte dès le départ, de même", () => {
    const [, second] = combatsRejoues(ESCORTE, [
      { rencontreId: 1, le: le(5), nom: "Pigeon biset", force: 1_000_000 },
      { rencontreId: 2, le: le(6), nom: "Poule", force: 50_000 },
    ]);
    expect(second).toEqual({ rencontreId: 2, le: le(6), bete: { nom: "Poule", force: 50_000 }, escorte: 0, sansEscorte: true });
    expect(combatsRejoues([], [{ rencontreId: 3, le: le(7), nom: "Pigeon biset", force: 15_000 }])).toEqual([
      { rencontreId: 3, le: le(7), bete: { nom: "Pigeon biset", force: 15_000 }, escorte: 0, sansEscorte: true },
    ]);
  });

  it("une escorte de Bêtes sans arme, de force nulle, reste une escorte", () => {
    const [combat] = combatsRejoues([{ especeId: "poule", force: 0, nombre: 3 }], [{ rencontreId: 4, le: le(8), nom: "Pigeon biset", force: 15_000 }]);
    expect(combat).toMatchObject({ escorte: 0, sansEscorte: false });
  });

  it("aucun sans attaque", () => {
    expect(combatsRejoues(ESCORTE, [])).toEqual([]);
  });
});
