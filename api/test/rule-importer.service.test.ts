// test/rule-importer.service.test.ts
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

jest.mock('../src/lib/prisma', () => {
  const { mockDeep } = jest.requireActual('jest-mock-extended');
  return {
    prisma: mockDeep(),
  };
});

jest.mock('../src/lib/rule-parser');

import { prisma } from '../src/lib/prisma';
import {
  parseRulesFromFile,
  importRulesFromText,
  deduplicateRules,
  getImportStatistics,
  RuleImportError,
} from '../src/services/rule-importer.service';
import { parseSnortRule, extractReferences } from '../src/lib/rule-parser';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

describe('Rule Importer Service', () => {
  const prismaMock = prisma as DeepMockProxy<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseRulesFromFile', () => {
    it('should parse rules from text content', () => {
      const content = `# Comment line
alert tcp any any -> any 22 (msg:"SSH Rule"; sid:1000000; rev:1;)
alert tcp any any -> any 23 (msg:"Telnet Rule"; sid:1000001; rev:1;)
# Another comment

alert tcp any any -> any 80 (msg:"HTTP Rule"; sid:1000002; rev:1;)`;

      const rules = parseRulesFromFile(content);

      expect(rules).toHaveLength(3);
      expect(rules[0].rawRule).toContain('SSH Rule');
      expect(rules[1].rawRule).toContain('Telnet Rule');
      expect(rules[2].rawRule).toContain('HTTP Rule');
    });

    it('should skip empty lines and comments', () => {
      const content = `# Comment

alert tcp any any -> any 22 (msg:"Rule"; sid:1000000; rev:1;)

# Another comment
`;

      const rules = parseRulesFromFile(content);

      expect(rules).toHaveLength(1);
    });

    it('should trim whitespace from rules', () => {
      const content = `  alert tcp any any -> any 22 (msg:"Rule"; sid:1000000; rev:1;)  `;

      const rules = parseRulesFromFile(content);

      expect(rules[0].rawRule).not.toMatch(/^\s/);
      expect(rules[0].rawRule).not.toMatch(/\s$/);
    });

    it('should track line numbers correctly', () => {
      const content = `alert tcp any any -> any 22 (msg:"Rule1"; sid:1000000; rev:1;)
alert tcp any any -> any 23 (msg:"Rule2"; sid:1000001; rev:1;)
alert tcp any any -> any 80 (msg:"Rule3"; sid:1000002; rev:1;)`;

      const rules = parseRulesFromFile(content);

      expect(rules[0].lineNumber).toBe(1);
      expect(rules[1].lineNumber).toBe(2);
      expect(rules[2].lineNumber).toBe(3);
    });

    it('should handle empty file', () => {
      const rules = parseRulesFromFile('');

      expect(rules).toHaveLength(0);
    });

    it('should handle file with only comments', () => {
      const content = `# Comment 1
# Comment 2
# Comment 3`;

      const rules = parseRulesFromFile(content);

      expect(rules).toHaveLength(0);
    });
  });

  describe('deduplicateRules', () => {
    it('should remove duplicate rules', () => {
      const rules = [
        { rawRule: 'alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)', lineNumber: 1 },
        { rawRule: 'alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)', lineNumber: 2 },
        {
          rawRule: 'alert tcp any any -> any 23 (msg:"Telnet"; sid:1000001; rev:1;)',
          lineNumber: 3,
        },
      ];

      const deduped = deduplicateRules(rules);

      expect(deduped).toHaveLength(2);
      expect(deduped[0].lineNumber).toBe(1);
      expect(deduped[1].lineNumber).toBe(3);
    });

    it('should include hash in output', () => {
      const rules = [
        { rawRule: 'alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)', lineNumber: 1 },
      ];

      const deduped = deduplicateRules(rules);

      expect(deduped[0]).toHaveProperty('hash');
      expect(deduped[0].hash).toHaveLength(32); // MD5 = 32 hex chars
    });

    it('should preserve first occurrence', () => {
      const rules = [
        { rawRule: 'rule1', lineNumber: 5 },
        { rawRule: 'rule1', lineNumber: 10 },
      ];

      const deduped = deduplicateRules(rules);

      expect(deduped).toHaveLength(1);
      expect(deduped[0].lineNumber).toBe(5);
    });
  });

  describe('importRulesFromText', () => {
    it('should import rules successfully', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      (extractReferences as jest.Mock).mockReturnValue([]);

      prismaMock.rule.findFirst.mockResolvedValue(null);
      prismaMock.rule.create.mockResolvedValue({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: ruleText,
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await importRulesFromText(ruleText, {
        sourceId: 1,
      });

      expect(result.imported).toBe(1);
      expect(result.failed).toHaveLength(0);
    });

    it('should skip rules that already exist', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      prismaMock.rule.findFirst.mockResolvedValue({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: ruleText,
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await importRulesFromText(ruleText, {
        sourceId: 1,
      });

      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('should handle version updates', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:2;)`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: 'SSH',
        sid: 1000000,
        rev: 2,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      (extractReferences as jest.Mock).mockReturnValue([]);

      // First call: no existing rule with same rev
      prismaMock.rule.findFirst.mockResolvedValueOnce(null);
      // Second call: no newer version
      prismaMock.rule.findFirst.mockResolvedValueOnce(null);
      // Third call: old version exists
      prismaMock.rule.findFirst.mockResolvedValueOnce({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: 'old rule',
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prismaMock.rule.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.rule.create.mockResolvedValue({
        id: 2,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 2,
        ruleFormat: ruleText,
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await importRulesFromText(ruleText, {
        sourceId: 1,
      });

      expect(result.updated).toBe(1);
      expect(prismaMock.rule.updateMany).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const ruleText = `invalid rule format`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: null, // Missing required message
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      const result = await importRulesFromText(ruleText, {
        sourceId: 1,
      });

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('message');
    });

    it('should rollback on error if requested', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)
invalid rule`;

      (parseSnortRule as jest.Mock).mockReturnValueOnce({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: 'valid',
      });

      (parseSnortRule as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid rule format');
      });

      await expect(
        importRulesFromText(ruleText, {
          sourceId: 1,
          rollbackOnError: true,
        }),
      ).rejects.toThrow(RuleImportError);
    });

    it('should not rollback on error by default', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)
invalid rule`;

      (parseSnortRule as jest.Mock).mockReturnValueOnce({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: 'valid',
      });

      (parseSnortRule as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid rule format');
      });

      (extractReferences as jest.Mock).mockReturnValue([]);

      prismaMock.rule.findFirst.mockResolvedValue(null);
      prismaMock.rule.create.mockResolvedValue({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: 'valid',
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await importRulesFromText(ruleText, {
        sourceId: 1,
        rollbackOnError: false,
      });

      expect(result.imported).toBe(1);
      expect(result.failed).toHaveLength(1);
    });

    it('should auto-activate rules when requested', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      (extractReferences as jest.Mock).mockReturnValue([]);

      prismaMock.rule.findFirst.mockResolvedValue(null);
      prismaMock.rule.create.mockResolvedValue({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: ruleText,
        isActive: true,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await importRulesFromText(ruleText, {
        sourceId: 1,
        autoActivate: true,
      });

      expect(prismaMock.rule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('should not auto-activate when disabled', async () => {
      const ruleText = `alert tcp any any -> any 22 (msg:"SSH"; sid:1000000; rev:1;)`;

      (parseSnortRule as jest.Mock).mockReturnValue({
        message: 'SSH',
        sid: 1000000,
        rev: 1,
        classtype: 'attempted-admin',
        rawRule: ruleText,
      });

      (extractReferences as jest.Mock).mockReturnValue([]);

      prismaMock.rule.findFirst.mockResolvedValue(null);
      prismaMock.rule.create.mockResolvedValue({
        id: 1,
        message: 'SSH',
        classtype: 'attempted-admin',
        sid: 1000000,
        rev: 1,
        ruleFormat: ruleText,
        isActive: false,
        notes: null,
        sourceId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await importRulesFromText(ruleText, {
        sourceId: 1,
        autoActivate: false,
      });

      expect(prismaMock.rule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
          }),
        }),
      );
    });
  });

  describe('getImportStatistics', () => {
    it('should return import statistics', async () => {
      prismaMock.rule.count.mockResolvedValueOnce(1000);
      prismaMock.rule.count.mockResolvedValueOnce(850);

      const stats = await getImportStatistics();

      expect(stats.totalRules).toBe(1000);
      expect(stats.activeRules).toBe(850);
      expect(stats.totalImportJobs).toBe(0);
      expect(stats.successfulJobs).toBe(0);
    });

    it('should handle count errors', async () => {
      prismaMock.rule.count.mockRejectedValue(new Error('Database error'));

      await expect(getImportStatistics()).rejects.toThrow();
    });
  });
});
