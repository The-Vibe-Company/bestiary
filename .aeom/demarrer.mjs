// Démarre Bestia pour AEOM, en local : `next build`, puis `next start` sur un port interne (PORT + 1000), et devant lui,
// sur PORT, un relais qui retire image/avif des demandes d'images. Le mode production local se comporte comme le dev
// pour le jeu (tout ce qui change en ligne dépend de VERCEL_ENV, absent ici), mais ses pages arrivent au repos : en dev,
// les réponses des actions serveur restaient ouvertes. Et sharp ne termine jamais certaines conversions AVIF de petites
// icônes (viande, végétaux, pierre en 32 px) : le relais demande du WebP à la place. Ne sert qu'aux runs AEOM ; le jeu
// et sa configuration n'en savent rien. Le relais n'écoute qu'une fois le jeu prêt.
//   PORT=3171 node .aeom/demarrer.mjs
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import net from "node:net";

const port = Number(process.env.PORT ?? 3171);
const interne = port + 1000;
const env = { ...process.env, PORT: String(interne) };

const build = spawnSync("node_modules/.bin/next", ["build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);
const jeu = spawn("node_modules/.bin/next", ["start", "-p", String(interne)], { stdio: "inherit", env });
jeu.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => jeu.kill(signal));

const relais = http.createServer((demande, reponse) => {
  const entetes = { ...demande.headers };
  if (demande.url?.startsWith("/_next/image") && entetes.accept) entetes.accept = entetes.accept.replace(/image\/avif,?/g, "");
  const envoi = http.request({ host: "127.0.0.1", port: interne, path: demande.url, method: demande.method, headers: entetes }, (r) => {
    reponse.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(reponse);
  });
  envoi.on("error", () => {
    if (!reponse.headersSent) reponse.writeHead(502);
    reponse.end();
  });
  demande.pipe(envoi);
});
relais.on("upgrade", (demande, socket, tete) => {
  const amont = net.connect(interne, "127.0.0.1", () => {
    const lignes = [`${demande.method} ${demande.url} HTTP/${demande.httpVersion}`];
    for (let i = 0; i < demande.rawHeaders.length; i += 2) lignes.push(`${demande.rawHeaders[i]}: ${demande.rawHeaders[i + 1]}`);
    amont.write(lignes.join("\r\n") + "\r\n\r\n");
    if (tete?.length) amont.write(tete);
    amont.pipe(socket);
    socket.pipe(amont);
  });
  amont.on("error", () => socket.destroy());
  socket.on("error", () => amont.destroy());
});

/** Attend que le jeu réponde sur son port interne, puis ouvre le relais. */
function ouvrirQuandPret() {
  const essai = http.get({ host: "127.0.0.1", port: interne, path: "/connexion" }, (r) => {
    r.resume();
    relais.listen(port);
  });
  essai.on("error", () => setTimeout(ouvrirQuandPret, 300));
}
ouvrirQuandPret();
