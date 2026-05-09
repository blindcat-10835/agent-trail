/**
 * Environment variable validation helpers.
 *
 * Safely retrieve required environment variables at runtime.
 * Call inside functions (not at module top level) so imports don't crash during build/test.
 */

/**
 * Safely retrieve a required environment variable at runtime.
 * Throws a descriptive error if the variable is missing or empty.
 *
 * @param key - The environment variable name
 * @returns The validated environment variable value
 * @throws Error if the environment variable is missing or empty
 *
 * @example
 * ```ts
 * const port = requireEnv('INGEST_PORT')
 * ```
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Retrieve an optional environment variable with a default value.
 *
 * @param key - The environment variable name
 * @param defaultValue - The default value if the variable is missing
 * @returns The environment variable value or the default
 *
 * @example
 * ```ts
 * const port = optionalEnv('PORT', '3000')
 * ```
 */
export function optionalEnv(key: string, defaultValue: string): string {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    return defaultValue
  }
  return value
}
