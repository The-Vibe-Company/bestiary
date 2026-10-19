import posthog from "posthog-js";

/** Vrai une fois PostHog initialisé dans le navigateur (src/instrumentation-client.ts) ; sinon, rien n'est envoyé. */
export const mesureActive = () => typeof window !== "undefined" && posthog.__loaded;
