import { createHash } from 'crypto';
import { readFile } from 'fs/promises';

/**
 * Computes SHA-256 hash of a file.
 * @param filePath Path to the file to hash.
 * @returns Hex-encoded SHA-256 hash.
 */
export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Computes SHA-256 hash of a buffer.
 * @param content Buffer to hash.
 * @returns Hex-encoded SHA-256 hash.
 */
export function hashBuffer(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
