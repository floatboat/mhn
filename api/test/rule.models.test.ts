// test/rule.models.test.ts
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { prisma } from '../src/lib/prisma';
import { Rule, Reference } from '@prisma/client';

/**
 * Rule Model Tests
 *
 * Tests the Rule, Reference, and RuleSource database models
 * Verifies schema constraints, relationships, and cascade behavior
 */

describe('Rule Models', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await prisma.reference.deleteMany({});
    await prisma.rule.deleteMany({});
    await prisma.ruleSource.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.reference.deleteMany({});
    await prisma.rule.deleteMany({});
    await prisma.ruleSource.deleteMany({});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test to ensure isolation
    await prisma.reference.deleteMany({});
    await prisma.rule.deleteMany({});
    await prisma.ruleSource.deleteMany({});
  });

  describe('Rule Model Tests', () => {
    it('should create a rule with all fields', async () => {
      // Create a rule source first
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Test Source',
          uri: 'https://example.com/rules',
          note: 'Test rule source',
        },
      });

      const rule = await prisma.rule.create({
        data: {
          message: 'Test rule message',
          classtype: 'attempted-admin',
          sid: 1000001,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Test"; sid:1000001; rev:1;)',
          notes: 'This is a test rule',
          sourceId: source.id,
        },
      });

      expect(rule).toBeDefined();
      expect(rule.id).toBeGreaterThan(0);
      expect(rule.message).toBe('Test rule message');
      expect(rule.classtype).toBe('attempted-admin');
      expect(rule.sid).toBe(1000001);
      expect(rule.rev).toBe(1);
      expect(rule.isActive).toBe(true); // Default value
      expect(rule.notes).toBe('This is a test rule');
      expect(rule.sourceId).toBe(source.id);
      expect(rule.createdAt).toBeInstanceOf(Date);
      expect(rule.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a rule with minimal required fields', async () => {
      const rule = await prisma.rule.create({
        data: {
          message: 'Minimal test rule',
          classtype: 'attempted-user',
          sid: 1000002,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any 80 (msg:"HTTP"; sid:1000002; rev:1;)',
        },
      });

      expect(rule).toBeDefined();
      expect(rule.id).toBeGreaterThan(0);
      expect(rule.message).toBe('Minimal test rule');
      expect(rule.isActive).toBe(true);
      expect(rule.notes).toBeNull();
      expect(rule.sourceId).toBeNull();
    });

    it('should enforce unique constraint on sid + rev combination', async () => {
      // Create first rule with sid=1000003, rev=1
      await prisma.rule.create({
        data: {
          message: 'First rule',
          classtype: 'attempted-admin',
          sid: 1000003,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"First"; sid:1000003; rev:1;)',
        },
      });

      // Try to create another rule with same sid + rev
      await expect(
        prisma.rule.create({
          data: {
            message: 'Duplicate rule',
            classtype: 'attempted-admin',
            sid: 1000003,
            rev: 1, // Same sid + rev
            ruleFormat:
              'alert tcp any any -> any any (msg:"Duplicate"; sid:1000003; rev:1;)',
          },
        }),
      ).rejects.toThrow();
    });

    it('should allow same sid with different rev', async () => {
      // Create rule with sid=1000004, rev=1
      const rule1 = await prisma.rule.create({
        data: {
          message: 'Rule version 1',
          classtype: 'attempted-admin',
          sid: 1000004,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"V1"; sid:1000004; rev:1;)',
        },
      });

      // Create rule with sid=1000004, rev=2 (different revision)
      const rule2 = await prisma.rule.create({
        data: {
          message: 'Rule version 2',
          classtype: 'attempted-admin',
          sid: 1000004,
          rev: 2,
          ruleFormat:
            'alert tcp any any -> any any (msg:"V2"; sid:1000004; rev:2;)',
        },
      });

      expect(rule1.sid).toBe(1000004);
      expect(rule1.rev).toBe(1);
      expect(rule2.sid).toBe(1000004);
      expect(rule2.rev).toBe(2);
    });

    it('should update rule fields', async () => {
      const rule = await prisma.rule.create({
        data: {
          message: 'Original message',
          classtype: 'attempted-admin',
          sid: 1000005,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Original"; sid:1000005; rev:1;)',
        },
      });

      // Add small delay to ensure updatedAt timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedRule = await prisma.rule.update({
        where: { id: rule.id },
        data: {
          message: 'Updated message',
          notes: 'Added notes',
        },
      });

      expect(updatedRule.message).toBe('Updated message');
      expect(updatedRule.notes).toBe('Added notes');
      expect(updatedRule.updatedAt.getTime()).toBeGreaterThanOrEqual(
        rule.updatedAt.getTime(),
      );
    });

    it('should toggle isActive flag', async () => {
      const rule = await prisma.rule.create({
        data: {
          message: 'Active rule',
          classtype: 'attempted-admin',
          sid: 1000006,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Active"; sid:1000006; rev:1;)',
        },
      });

      expect(rule.isActive).toBe(true);

      const deactivated = await prisma.rule.update({
        where: { id: rule.id },
        data: { isActive: false },
      });

      expect(deactivated.isActive).toBe(false);

      const reactivated = await prisma.rule.update({
        where: { id: rule.id },
        data: { isActive: true },
      });

      expect(reactivated.isActive).toBe(true);
    });

    it('should delete rule and cascade delete references', async () => {
      // Create rule with references
      const rule = await prisma.rule.create({
        data: {
          message: 'Rule with references',
          classtype: 'attempted-admin',
          sid: 1000007,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Test"; sid:1000007; rev:1;)',
          references: {
            create: [
              { text: 'CVE-2021-1234' },
              { text: 'https://example.com/vuln' },
            ],
          },
        },
      });

      // Verify references created
      const references = await prisma.reference.findMany({
        where: { ruleId: rule.id },
      });
      expect(references).toHaveLength(2);

      // Delete rule
      await prisma.rule.delete({
        where: { id: rule.id },
      });

      // Verify references were cascade deleted
      const remainingReferences = await prisma.reference.findMany({
        where: { ruleId: rule.id },
      });
      expect(remainingReferences).toHaveLength(0);
    });

    it('should query rules by classtype', async () => {
      // Create multiple rules with different classtypes
      await prisma.rule.createMany({
        data: [
          {
            message: 'Admin rule 1',
            classtype: 'attempted-admin',
            sid: 1000008,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Admin1"; sid:1000008; rev:1;)',
          },
          {
            message: 'Admin rule 2',
            classtype: 'attempted-admin',
            sid: 1000009,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Admin2"; sid:1000009; rev:1;)',
          },
          {
            message: 'User rule',
            classtype: 'attempted-user',
            sid: 1000010,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"User"; sid:1000010; rev:1;)',
          },
        ],
      });

      const adminRules = await prisma.rule.findMany({
        where: { classtype: 'attempted-admin' },
      });

      expect(adminRules).toHaveLength(2);
      expect(
        adminRules.every((r: Rule) => r.classtype === 'attempted-admin'),
      ).toBe(true);
    });

    it('should query rules by isActive status', async () => {
      // Create active and inactive rules
      await prisma.rule.createMany({
        data: [
          {
            message: 'Active rule 1',
            classtype: 'attempted-admin',
            sid: 1000011,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Active1"; sid:1000011; rev:1;)',
            isActive: true,
          },
          {
            message: 'Active rule 2',
            classtype: 'attempted-admin',
            sid: 1000012,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Active2"; sid:1000012; rev:1;)',
            isActive: true,
          },
          {
            message: 'Inactive rule',
            classtype: 'attempted-admin',
            sid: 1000013,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Inactive"; sid:1000013; rev:1;)',
            isActive: false,
          },
        ],
      });

      const activeRules = await prisma.rule.findMany({
        where: { isActive: true },
      });

      const inactiveRules = await prisma.rule.findMany({
        where: { isActive: false },
      });

      expect(activeRules).toHaveLength(2);
      expect(inactiveRules).toHaveLength(1);
      expect(activeRules.every((r: Rule) => r.isActive === true)).toBe(true);
      expect(inactiveRules.every((r: Rule) => r.isActive === false)).toBe(true);
    });
  });

  describe('Reference Model Tests', () => {
    it('should create reference with rule relation', async () => {
      // Create rule first
      const rule = await prisma.rule.create({
        data: {
          message: 'Rule for reference test',
          classtype: 'attempted-admin',
          sid: 1000014,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Test"; sid:1000014; rev:1;)',
        },
      });

      // Create reference
      const reference = await prisma.reference.create({
        data: {
          text: 'CVE-2021-5678',
          ruleId: rule.id,
        },
      });

      expect(reference).toBeDefined();
      expect(reference.id).toBeGreaterThan(0);
      expect(reference.text).toBe('CVE-2021-5678');
      expect(reference.ruleId).toBe(rule.id);
    });

    it('should cascade delete references when rule is deleted', async () => {
      // Create rule with multiple references
      const rule = await prisma.rule.create({
        data: {
          message: 'Rule with references',
          classtype: 'attempted-admin',
          sid: 1000015,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Test"; sid:1000015; rev:1;)',
          references: {
            create: [
              { text: 'CVE-2021-1111' },
              { text: 'CVE-2021-2222' },
              { text: 'https://example.com/advisory' },
            ],
          },
        },
      });

      // Verify references exist
      let references = await prisma.reference.findMany({
        where: { ruleId: rule.id },
      });
      expect(references).toHaveLength(3);

      // Delete rule
      await prisma.rule.delete({
        where: { id: rule.id },
      });

      // Verify all references were deleted
      references = await prisma.reference.findMany({
        where: { ruleId: rule.id },
      });
      expect(references).toHaveLength(0);
    });

    it('should query references by ruleId', async () => {
      // Create two rules with references
      const rule1 = await prisma.rule.create({
        data: {
          message: 'Rule 1',
          classtype: 'attempted-admin',
          sid: 1000016,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Rule1"; sid:1000016; rev:1;)',
          references: {
            create: [{ text: 'CVE-2021-AAAA' }, { text: 'CVE-2021-BBBB' }],
          },
        },
      });

      const rule2 = await prisma.rule.create({
        data: {
          message: 'Rule 2',
          classtype: 'attempted-admin',
          sid: 1000017,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Rule2"; sid:1000017; rev:1;)',
          references: {
            create: [{ text: 'CVE-2021-CCCC' }],
          },
        },
      });

      // Query references for rule1
      const rule1Refs = await prisma.reference.findMany({
        where: { ruleId: rule1.id },
      });

      // Query references for rule2
      const rule2Refs = await prisma.reference.findMany({
        where: { ruleId: rule2.id },
      });

      expect(rule1Refs).toHaveLength(2);
      expect(rule2Refs).toHaveLength(1);
      expect(rule1Refs.every((r: Reference) => r.ruleId === rule1.id)).toBe(
        true,
      );
      expect(rule2Refs.every((r: Reference) => r.ruleId === rule2.id)).toBe(
        true,
      );
    });

    it('should reject reference without valid rule', async () => {
      // Try to create reference with non-existent ruleId
      await expect(
        prisma.reference.create({
          data: {
            text: 'CVE-2021-9999',
            ruleId: 999999, // Non-existent rule
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('RuleSource Model Tests', () => {
    it('should create rule source', async () => {
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Snort Community Rules',
          uri: 'https://www.snort.org/downloads/community/community-rules.tar.gz',
          note: 'Official Snort community rules',
        },
      });

      expect(source).toBeDefined();
      expect(source.id).toBeGreaterThan(0);
      expect(source.name).toBe('Snort Community Rules');
      expect(source.uri).toBe(
        'https://www.snort.org/downloads/community/community-rules.tar.gz',
      );
      expect(source.note).toBe('Official Snort community rules');
      expect(source.createdAt).toBeInstanceOf(Date);
      expect(source.updatedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique constraint on name', async () => {
      // Create first rule source
      await prisma.ruleSource.create({
        data: {
          name: 'Emerging Threats',
          uri: 'https://rules.emergingthreats.net/open/snort-2.9.0/',
        },
      });

      // Try to create another with same name
      await expect(
        prisma.ruleSource.create({
          data: {
            name: 'Emerging Threats', // Duplicate name
            uri: 'https://different-url.com/rules',
          },
        }),
      ).rejects.toThrow();
    });

    it('should update rule source', async () => {
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Test Source',
          uri: 'https://example.com/rules',
        },
      });

      // Add small delay to ensure updatedAt timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await prisma.ruleSource.update({
        where: { id: source.id },
        data: {
          uri: 'https://updated-example.com/rules',
          note: 'Updated note',
        },
      });

      expect(updated.uri).toBe('https://updated-example.com/rules');
      expect(updated.note).toBe('Updated note');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        source.updatedAt.getTime(),
      );
    });

    it('should delete rule source and set rules sourceId to null', async () => {
      // Create rule source
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Deletable Source',
          uri: 'https://example.com/rules',
        },
      });

      // Create rule linked to source
      const rule = await prisma.rule.create({
        data: {
          message: 'Rule with source',
          classtype: 'attempted-admin',
          sid: 1000018,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Test"; sid:1000018; rev:1;)',
          sourceId: source.id,
        },
      });

      expect(rule.sourceId).toBe(source.id);

      // Delete rule source
      await prisma.ruleSource.delete({
        where: { id: source.id },
      });

      // Verify rule still exists but sourceId is null
      const orphanedRule = await prisma.rule.findUnique({
        where: { id: rule.id },
      });

      expect(orphanedRule).toBeDefined();
      expect(orphanedRule?.sourceId).toBeNull();
    });

    it('should query rule source by name', async () => {
      // Create multiple rule sources
      await prisma.ruleSource.createMany({
        data: [
          {
            name: 'Source A',
            uri: 'https://a.example.com/rules',
          },
          {
            name: 'Source B',
            uri: 'https://b.example.com/rules',
          },
        ],
      });

      const sourceA = await prisma.ruleSource.findUnique({
        where: { name: 'Source A' },
      });

      expect(sourceA).toBeDefined();
      expect(sourceA?.name).toBe('Source A');
      expect(sourceA?.uri).toBe('https://a.example.com/rules');
    });

    it('should include rules in source query', async () => {
      // Create source
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Source with Rules',
          uri: 'https://example.com/rules',
        },
      });

      // Create rules for this source
      await prisma.rule.createMany({
        data: [
          {
            message: 'Rule 1',
            classtype: 'attempted-admin',
            sid: 1000019,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Rule1"; sid:1000019; rev:1;)',
            sourceId: source.id,
          },
          {
            message: 'Rule 2',
            classtype: 'attempted-admin',
            sid: 1000020,
            rev: 1,
            ruleFormat:
              'alert tcp any any -> any any (msg:"Rule2"; sid:1000020; rev:1;)',
            sourceId: source.id,
          },
        ],
      });

      // Query source with rules
      const sourceWithRules = await prisma.ruleSource.findUnique({
        where: { id: source.id },
        include: {
          rules: true,
        },
      });

      expect(sourceWithRules?.rules).toHaveLength(2);
      expect(
        sourceWithRules?.rules.every((r: Rule) => r.sourceId === source.id),
      ).toBe(true);
    });
  });

  describe('Complex Relationship Tests', () => {
    it('should query rule with all relations', async () => {
      // Create source
      const source = await prisma.ruleSource.create({
        data: {
          name: 'Complete Test Source',
          uri: 'https://example.com/rules',
        },
      });

      // Create rule with references
      const rule = await prisma.rule.create({
        data: {
          message: 'Complete rule',
          classtype: 'attempted-admin',
          sid: 1000021,
          rev: 1,
          ruleFormat:
            'alert tcp any any -> any any (msg:"Complete"; sid:1000021; rev:1;)',
          sourceId: source.id,
          references: {
            create: [
              { text: 'CVE-2021-XXXX' },
              { text: 'https://example.com/advisory' },
            ],
          },
        },
      });

      // Query with all relations
      const completeRule = await prisma.rule.findUnique({
        where: { id: rule.id },
        include: {
          references: true,
          source: true,
        },
      });

      expect(completeRule).toBeDefined();
      expect(completeRule?.references).toHaveLength(2);
      expect(completeRule?.source).toBeDefined();
      expect(completeRule?.source?.name).toBe('Complete Test Source');
    });
  });
});
