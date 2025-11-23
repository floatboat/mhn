/**
 * Rule File Fetcher - Download and decompress rule files from external sources
 * Supports .tar.gz and .zip formats with retry logic and authentication
 */

import axios, { AxiosError } from 'axios';
import * as tar from 'tar';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import crypto from 'crypto';
import Extract from 'unzipper';

/**
 * Configuration for downloading rules from a source
 */
export interface RuleSourceConfig {
  uri: string;
  authentication?: {
    type: 'none' | 'api_key' | 'basic' | 'bearer';
    credentials?: string; // API key, base64-encoded user:pass, or token
  };
  headers?: Record<string, string>;
  timeout?: number; // milliseconds
  maxRetries?: number;
  backoffMultiplierMs?: number;
}

/**
 * Represents a downloaded and extracted rule file
 */
export interface FetchedRuleFile {
  sourceUri: string;
  fileName: string;
  content: string; // Decompressed rule file content
  downloadedAt: Date;
  fileHash: string; // SHA256 for change detection
}

/**
 * Custom error for rule fetching failures
 */
export class RuleFetchError extends Error {
  statusCode = 500;
  retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'RuleFetchError';
    this.retryable = retryable;
  }
}

/**
 * Custom error for authentication failures
 */
export class AuthenticationError extends Error {
  statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Compute SHA256 hash of file content
 */
export function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Download a rule file with retry logic and decompression
 */
export async function downloadRuleFile(
  config: RuleSourceConfig,
  attemptNumber = 1,
): Promise<FetchedRuleFile> {
  const maxRetries = config.maxRetries ?? 3;
  const timeout = config.timeout ?? 30000;
  const backoffMs = config.backoffMultiplierMs ?? 1000;

  try {
    const headers = buildHeaders(config);

    // Download file
    const response = await axios.get(config.uri, {
      responseType: 'arraybuffer',
      timeout,
      headers,
      maxRedirects: 5,
    });

    const buffer = Buffer.from(response.data);

    // Determine file type and extract
    let content: string;
    if (config.uri.endsWith('.tar.gz') || config.uri.endsWith('.tgz')) {
      content = await extractTarGz(buffer, config.uri);
    } else if (config.uri.endsWith('.zip')) {
      content = await extractZip(buffer, config.uri);
    } else {
      // Assume plain text rules file
      content = buffer.toString('utf-8');
    }

    const fileHash = computeFileHash(content);

    return {
      sourceUri: config.uri,
      fileName: path.basename(config.uri),
      content,
      downloadedAt: new Date(),
      fileHash,
    };
  } catch (error) {
    const isRetryable = isRetryableError(error);

    if (isRetryable && attemptNumber < maxRetries) {
      const delayMs = backoffMs * Math.pow(2, attemptNumber - 1);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return downloadRuleFile(config, attemptNumber + 1);
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof RuleFetchError) {
      throw error;
    }

    if (error instanceof AxiosError) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new AuthenticationError(
          `Authentication failed: ${error.response?.status} ${error.response?.statusText}`,
        );
      }
      throw new RuleFetchError(
        `Failed to download rules after ${attemptNumber} attempts: ${error.message}`,
        isRetryable,
      );
    }

    throw new RuleFetchError(`Unexpected error downloading rules: ${String(error)}`, false);
  }
}

/**
 * Build headers for HTTP request based on authentication config
 */
function buildHeaders(config: RuleSourceConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'MHN-RuleFetcher/1.0',
    ...config.headers,
  };

  if (config.authentication) {
    switch (config.authentication.type) {
      case 'api_key':
        headers['X-API-Key'] = config.authentication.credentials || '';
        break;
      case 'bearer':
        headers['Authorization'] = `Bearer ${config.authentication.credentials || ''}`;
        break;
      case 'basic':
        headers['Authorization'] = `Basic ${config.authentication.credentials || ''}`;
        break;
      case 'none':
      default:
        // No auth headers needed
        break;
    }
  }

  return headers;
}

/**
 * Extract and concatenate all .rules files from a .tar.gz archive
 */
async function extractTarGz(buffer: Buffer, sourceUri: string): Promise<string> {
  const ruleFiles: string[] = [];
  let hasRulesFile = false;

  try {
    // Use tar to parse and extract
    await new Promise<void>((resolve, reject) => {
      const gzipStream = zlib.createGunzip();
      const tarParser = new tar.Parser();

      tarParser.on('entry', (entry: any) => {
        // Only process .rules files
        if (entry.path.endsWith('.rules')) {
          hasRulesFile = true;
          let content = '';

          entry.on('data', (chunk: Buffer) => {
            content += chunk.toString('utf-8');
          });

          entry.on('end', () => {
            ruleFiles.push(content);
          });

          entry.on('error', (err: Error) => {
            reject(new RuleFetchError(`Error reading entry ${entry.path}: ${err.message}`));
          });
        } else {
          entry.resume(); // Skip non-rules files
        }
      });

      tarParser.on('error', (err: Error) => {
        reject(new RuleFetchError(`TAR parsing error: ${err.message}`));
      });

      tarParser.on('end', () => {
        resolve();
      });

      gzipStream.on('error', (err: Error) => {
        reject(new RuleFetchError(`Gzip decompression error: ${err.message}`));
      });

      gzipStream.pipe(tarParser);
      gzipStream.write(buffer);
      gzipStream.end();
    });

    if (!hasRulesFile) {
      throw new RuleFetchError(`No .rules files found in archive: ${sourceUri}`);
    }

    return ruleFiles.join('\n');
  } catch (error) {
    if (error instanceof RuleFetchError) {
      throw error;
    }
    throw new RuleFetchError(`Failed to extract TAR.GZ archive: ${String(error)}`);
  }
}

/**
 * Extract and concatenate all .rules files from a .zip archive
 */
async function extractZip(buffer: Buffer, sourceUri: string): Promise<string> {
  const ruleFiles: string[] = [];
  let hasRulesFile = false;

  try {
    // Create temporary file for unzipper
    const tmpDir = '/tmp';
    const tmpFile = path.join(tmpDir, `rules_${Date.now()}.zip`);

    await pipeline(
      async function* () {
        yield buffer;
      },
      createWriteStream(tmpFile),
    );

    // Extract using unzipper
    await new Promise<void>((resolve, reject) => {
      createReadStream(tmpFile)
        .pipe(Extract.Parse())
        .on('entry', (entry: any) => {
          if (entry.path.endsWith('.rules')) {
            hasRulesFile = true;
            let content = '';

            entry.on('data', (chunk: Buffer) => {
              content += chunk.toString('utf-8');
            });

            entry.on('end', () => {
              ruleFiles.push(content);
            });

            entry.on('error', (err: Error) => {
              reject(new RuleFetchError(`Error reading ZIP entry ${entry.path}: ${err.message}`));
            });
          } else {
            entry.autodrain();
          }
        })
        .on('error', (err: Error) => {
          reject(new RuleFetchError(`ZIP extraction error: ${err.message}`));
          fs.unlink(tmpFile, () => {}); // Clean up
        })
        .on('finish', () => {
          fs.unlink(tmpFile, () => {}); // Clean up
          resolve();
        });
    });

    if (!hasRulesFile) {
      throw new RuleFetchError(`No .rules files found in archive: ${sourceUri}`);
    }

    return ruleFiles.join('\n');
  } catch (error) {
    if (error instanceof RuleFetchError) {
      throw error;
    }
    throw new RuleFetchError(`Failed to extract ZIP archive: ${String(error)}`);
  }
}

/**
 * Determine if an error is retryable (network/timeout) vs permanent (auth/validation)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AuthenticationError) {
    return false;
  }

  if (error instanceof AxiosError) {
    // Retry on network errors, timeouts, and 5xx errors
    if (!error.response) {
      return true; // Network error
    }

    const status = error.response.status;
    if (status === 401 || status === 403) {
      return false; // Don't retry auth errors
    }
    if (status >= 500) {
      return true; // Retry server errors
    }
    if (status === 429) {
      return true; // Retry rate limits
    }
    if (status === 408) {
      return true; // Retry request timeouts
    }

    return false; // Don't retry 4xx errors
  }

  // Assume other errors might be retryable
  return true;
}
