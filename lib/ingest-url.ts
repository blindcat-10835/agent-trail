export function getIngestBaseUrl(): string {
  const explicitUrl = process.env.INGEST_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const port = process.env.INGEST_PORT?.trim() || '8078';
  return `http://localhost:${port}`;
}
