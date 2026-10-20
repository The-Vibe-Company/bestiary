// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeur = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => routeur }));

import { useRelireLaPageA } from "./heure-du-jeu";

/** L'heure du jeu à l'affichage de la page. */
const MAINTENANT = new Date("2026-10-15T10:00:00Z");
const MINUTE = 60_000;

describe("relire la page à un instant du jeu (US-0818)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    routeur.refresh.mockReset();
  });

  it("relit la page une seconde réelle après l'instant, au rythme du jeu, une fois", () => {
    vi.useFakeTimers();
    // Dans dix minutes de jeu, au rythme de soixante : dix secondes réelles, plus la seconde laissée au serveur.
    renderHook(() => useRelireLaPageA(new Date(MAINTENANT.getTime() + 10 * MINUTE), MAINTENANT, 60));
    vi.advanceTimersByTime(10_999);
    expect(routeur.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(routeur.refresh).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(60 * MINUTE);
    expect(routeur.refresh).toHaveBeenCalledOnce();
  });

  it("ne relit rien sans instant, pour un instant déjà passé à l'affichage, ni au-delà de ce qu'un minuteur sait attendre", () => {
    vi.useFakeTimers();
    renderHook(() => useRelireLaPageA(null, MAINTENANT));
    renderHook(() => useRelireLaPageA(MAINTENANT, MAINTENANT));
    renderHook(() => useRelireLaPageA(new Date(MAINTENANT.getTime() + 30 * 24 * 60 * MINUTE), MAINTENANT));
    vi.advanceTimersByTime(30 * 24 * 60 * MINUTE);
    expect(routeur.refresh).not.toHaveBeenCalled();
  });

  it("oublie l'instant attendu quand la page est relue plus tôt, ou quitte l'écran", () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ quand, maintenant }) => useRelireLaPageA(quand, maintenant), {
      initialProps: { quand: new Date(MAINTENANT.getTime() + MINUTE), maintenant: MAINTENANT },
    });
    // Relue trente secondes plus tard : la même naissance, attendue trente secondes plus tard.
    vi.advanceTimersByTime(30_000);
    rerender({ quand: new Date(MAINTENANT.getTime() + MINUTE), maintenant: new Date(MAINTENANT.getTime() + 30_000) });
    vi.advanceTimersByTime(30_999);
    expect(routeur.refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(routeur.refresh).toHaveBeenCalledOnce();
    rerender({ quand: new Date(MAINTENANT.getTime() + 2 * MINUTE), maintenant: new Date(MAINTENANT.getTime() + MINUTE) });
    unmount();
    vi.advanceTimersByTime(10 * MINUTE);
    expect(routeur.refresh).toHaveBeenCalledOnce();
  });
});
