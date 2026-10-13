import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Vite lit NODE_ENV après ce fichier pour décider du mode production : sous NODE_ENV=production (un build Vercel), il
// réduirait un module Node importé dans un test jsdom à un module vide et sans nom (« No such built-in module: node: »).
// Les tests tournent toujours en mode test (voir `env` plus bas).
Object.assign(process.env, { NODE_ENV: "test" });

export default defineConfig({
  resolve: {
    // Le même raccourci que tsconfig.json : « @/… » désigne src/.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Les tests tournent côté serveur : la garde « server-only » n'a rien à y empêcher.
      "server-only": fileURLToPath(new URL("./src/test/vide.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    // Met la base de test à jour avant les tests sur base (*.db.test.ts).
    globalSetup: ["./src/test/preparer-base.ts"],
    // Chaque fichier de test démarre sans VERCEL_ENV (voir src/test/environnement.ts).
    setupFiles: ["./src/test/environnement.ts"],
    testTimeout: 20_000,
    // La préparation de la base de test passe un fichier à la fois (src/test/base.ts) : sous charge,
    // l'attente dépasse les 10 s par défaut d'un beforeAll.
    hookTimeout: 30_000,
    // Les tests tournent toujours en mode test, même quand Vercel construit avec NODE_ENV=production :
    // sinon React charge sa version de production, sans l'outil act des tests de formulaires.
    env: { NODE_ENV: "test" },
  },
});
