"use strict";
/**
 * Rule File Fetcher - Download and decompress rule files from external sources
 * Supports .tar.gz and .zip formats with retry logic and authentication
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationError = exports.RuleFetchError = void 0;
exports.computeFileHash = computeFileHash;
exports.downloadRuleFile = downloadRuleFile;
const axios_1 = __importStar(require("axios"));
const tar = __importStar(require("tar"));
const zlib = __importStar(require("zlib"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const promises_1 = require("stream/promises");
const fs_1 = require("fs");
const crypto_1 = __importDefault(require("crypto"));
const unzipper_1 = __importDefault(require("unzipper"));
/**
 * Custom error for rule fetching failures
 */
class RuleFetchError extends Error {
    constructor(message, retryable = true) {
        super(message);
        this.statusCode = 500;
        this.name = 'RuleFetchError';
        this.retryable = retryable;
    }
}
exports.RuleFetchError = RuleFetchError;
/**
 * Custom error for authentication failures
 */
class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 401;
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Compute SHA256 hash of file content
 */
function computeFileHash(content) {
    return crypto_1.default.createHash('sha256').update(content).digest('hex');
}
/**
 * Download a rule file with retry logic and decompression
 */
async function downloadRuleFile(config, attemptNumber = 1) {
    const maxRetries = config.maxRetries ?? 3;
    const timeout = config.timeout ?? 30000;
    const backoffMs = config.backoffMultiplierMs ?? 1000;
    try {
        const headers = buildHeaders(config);
        // Download file
        const response = await axios_1.default.get(config.uri, {
            responseType: 'arraybuffer',
            timeout,
            headers,
            maxRedirects: 5,
        });
        const buffer = Buffer.from(response.data);
        // Determine file type and extract
        let content;
        if (config.uri.endsWith('.tar.gz') || config.uri.endsWith('.tgz')) {
            content = await extractTarGz(buffer, config.uri);
        }
        else if (config.uri.endsWith('.zip')) {
            content = await extractZip(buffer, config.uri);
        }
        else {
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
    }
    catch (error) {
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
        if (error instanceof axios_1.AxiosError) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                throw new AuthenticationError(`Authentication failed: ${error.response?.status} ${error.response?.statusText}`);
            }
            throw new RuleFetchError(`Failed to download rules after ${attemptNumber} attempts: ${error.message}`, isRetryable);
        }
        throw new RuleFetchError(`Unexpected error downloading rules: ${String(error)}`, false);
    }
}
/**
 * Build headers for HTTP request based on authentication config
 */
function buildHeaders(config) {
    const headers = {
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
async function extractTarGz(buffer, sourceUri) {
    const ruleFiles = [];
    let hasRulesFile = false;
    try {
        // Use tar to parse and extract
        await new Promise((resolve, reject) => {
            const gzipStream = zlib.createGunzip();
            const tarParser = new tar.Parser();
            tarParser.on('entry', (entry) => {
                // Only process .rules files
                if (entry.path.endsWith('.rules')) {
                    hasRulesFile = true;
                    let content = '';
                    entry.on('data', (chunk) => {
                        content += chunk.toString('utf-8');
                    });
                    entry.on('end', () => {
                        ruleFiles.push(content);
                    });
                    entry.on('error', (err) => {
                        reject(new RuleFetchError(`Error reading entry ${entry.path}: ${err.message}`));
                    });
                }
                else {
                    entry.resume(); // Skip non-rules files
                }
            });
            tarParser.on('error', (err) => {
                reject(new RuleFetchError(`TAR parsing error: ${err.message}`));
            });
            tarParser.on('end', () => {
                resolve();
            });
            gzipStream.on('error', (err) => {
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
    }
    catch (error) {
        if (error instanceof RuleFetchError) {
            throw error;
        }
        throw new RuleFetchError(`Failed to extract TAR.GZ archive: ${String(error)}`);
    }
}
/**
 * Extract and concatenate all .rules files from a .zip archive
 */
async function extractZip(buffer, sourceUri) {
    const ruleFiles = [];
    let hasRulesFile = false;
    try {
        // Create temporary file for unzipper
        const tmpDir = '/tmp';
        const tmpFile = path.join(tmpDir, `rules_${Date.now()}.zip`);
        await (0, promises_1.pipeline)(async function* () {
            yield buffer;
        }, (0, fs_1.createWriteStream)(tmpFile));
        // Extract using unzipper
        await new Promise((resolve, reject) => {
            (0, fs_1.createReadStream)(tmpFile)
                .pipe(unzipper_1.default.Parse())
                .on('entry', (entry) => {
                if (entry.path.endsWith('.rules')) {
                    hasRulesFile = true;
                    let content = '';
                    entry.on('data', (chunk) => {
                        content += chunk.toString('utf-8');
                    });
                    entry.on('end', () => {
                        ruleFiles.push(content);
                    });
                    entry.on('error', (err) => {
                        reject(new RuleFetchError(`Error reading ZIP entry ${entry.path}: ${err.message}`));
                    });
                }
                else {
                    entry.autodrain();
                }
            })
                .on('error', (err) => {
                reject(new RuleFetchError(`ZIP extraction error: ${err.message}`));
                fs.unlink(tmpFile, () => { }); // Clean up
            })
                .on('finish', () => {
                fs.unlink(tmpFile, () => { }); // Clean up
                resolve();
            });
        });
        if (!hasRulesFile) {
            throw new RuleFetchError(`No .rules files found in archive: ${sourceUri}`);
        }
        return ruleFiles.join('\n');
    }
    catch (error) {
        if (error instanceof RuleFetchError) {
            throw error;
        }
        throw new RuleFetchError(`Failed to extract ZIP archive: ${String(error)}`);
    }
}
/**
 * Determine if an error is retryable (network/timeout) vs permanent (auth/validation)
 */
function isRetryableError(error) {
    if (error instanceof AuthenticationError) {
        return false;
    }
    if (error instanceof axios_1.AxiosError) {
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
