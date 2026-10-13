import { describe, expect, it } from "vitest";
import { blessesAffiches, blessesDans } from "./blesses-affiches";

describe("les Blessés au Foyer tels que les pages les montrent (US-0952)", () => {
  const instant = new Date("2026-10-09T07:42:13.250Z");
  const dans = (minutes: number) => new Date(instant.getTime() + minutes * 60_000);

  it("compte le temps avant guérison à la minute supérieure", () => {
    expect(blessesAffiches([{ nombre: 2, gueriLe: dans(300) }, { nombre: 1, gueriLe: dans(300.2) }], instant, 10)).toEqual([
      { nombre: 2, dansMinutes: 300 },
      { nombre: 1, dansMinutes: 301 },
    ]);
  });

  it("n'en montre jamais plus que le plafond, les derniers à guérir retranchés les premiers, sans groupe vide", () => {
    const groupes = [
      { nombre: 2, gueriLe: dans(60) },
      { nombre: 2, gueriLe: dans(120) },
      { nombre: 1, gueriLe: dans(180) },
    ];
    expect(blessesAffiches(groupes, instant, 3)).toEqual([
      { nombre: 2, dansMinutes: 60 },
      { nombre: 1, dansMinutes: 120 },
    ]);
    expect(blessesAffiches(groupes, instant, 0)).toEqual([]);
  });

  it("dit « 3 Blessés, guéris dans 5 h », « 1 Blessé, guéri dans 45 min »", () => {
    expect([blessesDans({ nombre: 3, dansMinutes: 300 }), blessesDans({ nombre: 1, dansMinutes: 45 })]).toEqual([
      "3 Blessés, guéris dans 5 h",
      "1 Blessé, guéri dans 45 min",
    ]);
  });
});
