import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { env } from "../env";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = createPool(env("DATABASE_URL"));
  }
  return pool;
}

export function createPool(connectionString: string, reglages: Omit<PoolConfig, "connectionString"> = {}): Pool {
  // Échouer vite plutôt que d'attendre sans fin une base qui ne répond pas.
  return new Pool({ connectionString: withStrictSsl(connectionString), connectionTimeoutMillis: 5_000, ...reglages });
}

// Neon fournit sslmode=require, dont le sens va s'affaiblir dans pg 9 : on exige
// dès maintenant la vérification complète du certificat, ce que pg fait déjà.
export function withStrictSsl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function getDb() {
  return drizzle(getPool());
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export class DatabaseUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

const PG_CODES: Record<string, string> = {
  "28P01": "identifiant ou mot de passe refusé",
  "3D000": "cette base n'existe pas",
  "28000": "accès refusé",
};

const NETWORK_CODES: Record<string, string> = {
  ECONNREFUSED: "le serveur refuse la connexion",
  ENOTFOUND: "l'adresse du serveur est introuvable",
  ETIMEDOUT: "le serveur ne répond pas",
  ECONNRESET: "la connexion a été coupée",
};

/** Vrai quand l'erreur vient de la connexion elle-même, et non d'une requête. */
export function isConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  return Boolean(code && (code in PG_CODES || code in NETWORK_CODES)) || /timeout/i.test(message);
}

/** La raison d'un échec de connexion, en une phrase écrite ici : jamais le texte du pilote. */
export function connectionFailureReason(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  return (
    (code && (PG_CODES[code] ?? NETWORK_CODES[code])) ||
    (/timeout/i.test(message) ? "le serveur ne répond pas" : `erreur inattendue${code ? ` (${code})` : ""}`)
  );
}

/** Traduit une erreur du pilote en message lisible, sans jamais y recopier l'adresse de la base. */
export function explainDatabaseError(error: unknown): DatabaseUnavailableError {
  if (error instanceof DatabaseUnavailableError) return error;
  return new DatabaseUnavailableError(
    `Connexion à la base impossible : ${connectionFailureReason(error)}. Vérifiez DATABASE_URL dans .env.local.`,
    { cause: error },
  );
}
