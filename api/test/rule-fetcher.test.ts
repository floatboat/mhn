// test/rule-fetcher.test.ts
import axios from 'axios';
import * as tar from 'tar';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import {
  downloadRuleFile,
  computeFileHash,
  RuleFetchError,
  AuthenticationError,
} from '../src/lib/rule-fetcher';

jest.mock('axios');
jest.mock('tar');
jest.mock('zlib');
jest.mock('fs');
jest.mock('unzipper');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Rule Fetcher Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeFileHash', () => {
    it('should compute SHA256 hash', () => {
      const content = 'alert tcp any any -> any 22 (msg:"Test"; sid:1000000; rev:1;)';
      const hash = computeFileHash(content);

      expect(hash).toHaveLength(64); // SHA256 hex = 64 chars
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('should produce consistent hashes', () => {
      const content = 'test content';
      const hash1 = computeFileHash(content);
      const hash2 = computeFileHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different content', () => {
      const hash1 = computeFileHash('content1');
      const hash2 = computeFileHash('content2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('downloadRuleFile', () => {
    it('should download plain text rules file', async () => {
      const ruleContent = 'alert tcp any any -> any 22 (msg:"Test"; sid:1000000; rev:1;)\n';
      const buffer = Buffer.from(ruleContent);

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
      });

      expect(result.content).toBe(ruleContent);
      expect(result.fileName).toBe('rules.txt');
      expect(result.sourceUri).toBe('https://rules.example.com/rules.txt');
      expect(result.fileHash).toBe(computeFileHash(ruleContent));
    });

    it('should use provided authentication headers', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        authentication: {
          type: 'api_key',
          credentials: 'my-api-key',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://rules.example.com/rules.txt',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'my-api-key',
          }),
        }),
      );
    });

    it('should use Bearer token auth', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        authentication: {
          type: 'bearer',
          credentials: 'my-token',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://rules.example.com/rules.txt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('should use Basic auth', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        authentication: {
          type: 'basic',
          credentials: 'dXNlcjpwYXNz',
        },
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://rules.example.com/rules.txt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Basic dXNlcjpwYXNz',
          }),
        }),
      );
    });

    it('should throw AuthenticationError on 401', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 401,
          statusText: 'Unauthorized',
        },
      });

      await expect(
        downloadRuleFile({
          uri: 'https://rules.example.com/rules.txt',
          maxRetries: 0,
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError on 403', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 403,
          statusText: 'Forbidden',
        },
      });

      await expect(
        downloadRuleFile({
          uri: 'https://rules.example.com/rules.txt',
          maxRetries: 0,
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it('should retry on 5xx errors', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 503,
          statusText: 'Service Unavailable',
        },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        maxRetries: 2,
        backoffMultiplierMs: 1,
      });

      expect(result).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        maxRetries: 2,
        backoffMultiplierMs: 1,
      });

      expect(result).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 408)', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 400,
          statusText: 'Bad Request',
        },
      });

      await expect(
        downloadRuleFile({
          uri: 'https://rules.example.com/rules.txt',
          maxRetries: 3,
          backoffMultiplierMs: 1,
        }),
      ).rejects.toThrow(RuleFetchError);

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on 408 Request Timeout', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 408,
          statusText: 'Request Timeout',
        },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        maxRetries: 2,
        backoffMultiplierMs: 1,
      });

      expect(result).toBeDefined();
    });

    it('should retry on 429 Rate Limit', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockRejectedValueOnce({
        response: {
          status: 429,
          statusText: 'Too Many Requests',
        },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        maxRetries: 2,
        backoffMultiplierMs: 1,
      });

      expect(result).toBeDefined();
    });

    it('should use exponential backoff', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 503 },
      });

      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 503 },
      });

      mockedAxios.get.mockResolvedValueOnce({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      const startTime = Date.now();

      const result = await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        maxRetries: 3,
        backoffMultiplierMs: 100,
      });

      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsed).toBeGreaterThanOrEqual(300); // At least 1ms + 2ms delays
    });

    it('should respect timeout setting', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
        timeout: 5000,
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: 5000,
        }),
      );
    });

    it('should respect maxRedirects setting', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          maxRedirects: 5,
        }),
      );
    });

    it('should fail after max retries exceeded', async () => {
      mockedAxios.get.mockRejectedValue({
        response: { status: 503 },
      });

      await expect(
        downloadRuleFile({
          uri: 'https://rules.example.com/rules.txt',
          maxRetries: 2,
          backoffMultiplierMs: 1,
        }),
      ).rejects.toThrow(RuleFetchError);

      // Should try once + maxRetries times
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should set default options', async () => {
      const buffer = Buffer.from('test');

      mockedAxios.get.mockResolvedValue({
        data: buffer,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      });

      await downloadRuleFile({
        uri: 'https://rules.example.com/rules.txt',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          timeout: 30000,
          maxRedirects: 5,
        }),
      );
    });
  });
});
