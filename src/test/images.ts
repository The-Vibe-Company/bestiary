/**
 * Les peintures qu'une page charge avant tout le reste (fetchpriority « high », sans attendre d'être à l'écran) : le
 * fichier de chacune sous public/illustrations, dans l'ordre de la page. Lit le HTML rendu (renderToStaticMarkup, ou
 * le innerHTML d'un rendu de Testing Library).
 */
export const peinturesPrioritaires = (html: string) =>
  [...html.matchAll(/<img\b[^>]*>/gi)]
    .map(([img]) => img)
    .filter((img) => /fetchpriority="high"/i.test(img) && !/loading="lazy"/.test(img))
    .map((img) => decodeURIComponent(img.match(/src="[^"]*url=([^&"]*)/)?.[1] ?? "").replace("/illustrations/", ""));
