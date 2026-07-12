import pg from 'pg';

// Aiven injects DATABASE_URL (with ?sslmode=...) and PROJECT_CA_CERT (raw PEM).
// node-postgres ignores the `ssl` option when sslmode is in the URL, so we strip
// sslmode and pass ssl explicitly with the Aiven CA cert.
export function buildPgConfig(env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const url = new URL(env.DATABASE_URL);
  url.searchParams.delete('sslmode');
  const ssl = env.PROJECT_CA_CERT
    ? { ca: env.PROJECT_CA_CERT, rejectUnauthorized: true }
    : { rejectUnauthorized: false };
  return { connectionString: url.toString(), ssl };
}

export function makePool(env) {
  return new pg.Pool(buildPgConfig(env));
}
