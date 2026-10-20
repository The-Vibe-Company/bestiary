import type { ReactNode } from "react";

// Les pages du contrôle restent sur le papier clair d'avant : la page est sombre partout ailleurs (globals.css).
export default function ControleLayout({ children }: { children: ReactNode }) {
  return <div data-controle="">{children}</div>;
}
