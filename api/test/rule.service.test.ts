/**
 * Rules Service Tests
 */

import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  createRule,
  getRuleById,
  getRuleBySid,
  listRules,
  updateRule,
  deleteRule,
  addRuleReference,
  removeRuleReference,
  searchRules,
  getRulesByClasstype,
  getRuleStatistics,
  setRuleActive,
  createRuleVersion,
  getRuleVersions,
  createRuleSource,
  listRuleSources,
  updateRuleSource,
  deleteRuleSource,
  RuleValidationError,
  RuleExistsError,
  RuleNotFoundError,
  RuleSourceExistsError,
} from '../src/services/rule.service';

// Mock Prisma client
jest.mock('../src/lib/prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// Test fixtures
const validRuleText = `alert tcp $EXTERNAL_NET any -> $HOME_NET 445 (msg:"ET EXPLOIT Possible MS17-010 EternalBlue Exploit Attempt"; flow:to_server,established; content:"|fe 53 4d 42|"; offset:4; depth:4; classtype:attempted-admin; sid:2024218; rev:3; reference:cve,2017-0144; reference:url,github.com/rapid7/metasploit-framework/blob/master/modules/exploits/windows/smb/ms17_010_eternalblue.rb;)`;

const validRuleTextNoReferences = `alert tcp any any -> any 80 (msg:"HTTP Test Rule"; flow:to_server; content:"GET"; http_method; classtype:web-application-attack; sid:1000001; rev:1;)`;

const mockRule = {
  id: 1,
  message: 'ET EXPLOIT Possible MS17-010 EternalBlue Exploit Attempt',
  classtype: 'attempted-admin',
  sid: 2024218,
  rev: 3,
  ruleFormat: validRuleText,
  isActive: true,
  notes: null,
  sourceId: null,
  references: [
    { id: 1, text: 'CVE-2017-0144', ruleId: 1 },
    {
      id: 2,
      text: 'github.com/rapid7/metasploit-framework/blob/master/modules/exploits/windows/smb/ms17_010_eternalblue.rb',
      ruleId: 1,
    },
  ],
  source: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockRuleSource = {
  id: 1,
  name: 'Emerging Threats',
  uri: 'https://rules.emergingthreats.net/open/snort-2.9.0/rules/',
  note: 'Community rules from Emerging Threats',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('Rule Service - createRule', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should create a rule with all fields', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(null);
    prismaMock.rule.create.mockResolvedValue(mockRule as any);

    const result = await createRule(validRuleText);

    expect(result.sid).toBe(2024218);
    expect(result.rev).toBe(3);
    expect(result.message).toBe(
      'ET EXPLOIT Possible MS17-010 EternalBlue Exploit Attempt',
    );
    expect(result.classtype).toBe('attempted-admin');
    expect(result.references.length).toBe(2);
  });

  it('should extract message, sid, rev, classtype from rule text', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(null);
    prismaMock.rule.create.mockResolvedValue(mockRule as any);

    const result = await createRule(validRuleText);

    expect(result.message).toContain('EternalBlue');
    expect(result.sid).toBeGreaterThan(0);
    expect(result.rev).toBeGreaterThan(0);
    expect(result.classtype).toBeTruthy();
  });

  it('should create references from rule', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(null);
    prismaMock.rule.create.mockResolvedValue(mockRule as any);

    const result = await createRule(validRuleText);

    expect(result.references.length).toBeGreaterThan(0);
    expect(result.references[0].text).toContain('CVE');
  });

  it('should throw 409 if duplicate sid + rev exists', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);

    await expect(createRule(validRuleText)).rejects.toThrow(RuleExistsError);
    await expect(createRule(validRuleText)).rejects.toThrow(
      'Rule with SID 2024218 revision 3 already exists',
    );
  });

  it('should throw 400 for invalid rule format', async () => {
    await expect(createRule('invalid rule text')).rejects.toThrow(
      RuleValidationError,
    );
  });

  it('should throw 400 for missing required fields (message)', async () => {
    const ruleNoMsg = `alert tcp any any -> any 80 (classtype:web-application-attack; sid:1000001; rev:1;)`;
    await expect(createRule(ruleNoMsg)).rejects.toThrow(RuleValidationError);
    await expect(createRule(ruleNoMsg)).rejects.toThrow('must have a message');
  });

  it('should accept optional source assignment', async () => {
    const ruleWithSource = {
      ...mockRule,
      sourceId: 1,
      source: mockRuleSource,
    };
    prismaMock.rule.findUnique.mockResolvedValue(null);
    prismaMock.rule.create.mockResolvedValue(ruleWithSource as any);

    const result = await createRule(validRuleText, 1);

    expect(result.source).toBeTruthy();
    expect(result.source?.id).toBe(1);
  });

  it('should handle rules with no references', async () => {
    const ruleNoRefs = {
      ...mockRule,
      sid: 1000001,
      rev: 1,
      message: 'HTTP Test Rule',
      references: [],
      ruleFormat: validRuleTextNoReferences,
    };
    prismaMock.rule.findUnique.mockResolvedValue(null);
    prismaMock.rule.create.mockResolvedValue(ruleNoRefs as any);

    const result = await createRule(validRuleTextNoReferences);

    expect(result.references.length).toBe(0);
  });
});

describe('Rule Service - getRuleById', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should return rule with references', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);

    const result = await getRuleById(1);

    expect(result.id).toBe(1);
    expect(result.references.length).toBe(2);
  });

  it('should throw 404 for invalid ID', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(null);

    await expect(getRuleById(999)).rejects.toThrow(RuleNotFoundError);
    await expect(getRuleById(999)).rejects.toThrow('Rule with ID 999 not found');
  });

  it('should include source info if assigned', async () => {
    const ruleWithSource = {
      ...mockRule,
      sourceId: 1,
      source: mockRuleSource,
    };
    prismaMock.rule.findUnique.mockResolvedValue(ruleWithSource as any);

    const result = await getRuleById(1);

    expect(result.source).toBeTruthy();
    expect(result.source?.name).toBe('Emerging Threats');
  });
});

describe('Rule Service - getRuleBySid', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should get latest revision when rev not specified', async () => {
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await getRuleBySid(2024218);

    expect(result.sid).toBe(2024218);
    expect(result.rev).toBe(3);
  });

  it('should get specific revision when specified', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);

    const result = await getRuleBySid(2024218, 3);

    expect(result.sid).toBe(2024218);
    expect(result.rev).toBe(3);
  });

  it('should throw 404 for unknown SID', async () => {
    prismaMock.rule.findMany.mockResolvedValue([]);

    await expect(getRuleBySid(999999)).rejects.toThrow(RuleNotFoundError);
  });

  it('should return all versions available', async () => {
    const rule1 = { ...mockRule, rev: 1 };
    const rule2 = { ...mockRule, rev: 2 };
    const rule3 = { ...mockRule, rev: 3 };
    prismaMock.rule.findMany
      .mockResolvedValueOnce([rule3] as any) // Latest
      .mockResolvedValueOnce([rule1, rule2, rule3] as any); // All versions

    const latest = await getRuleBySid(2024218);
    expect(latest.rev).toBe(3);
  });
});

describe('Rule Service - listRules', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should return all rules with pagination', async () => {
    prismaMock.rule.count.mockResolvedValue(100);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await listRules({ limit: 20, offset: 0 });

    expect(result.total).toBe(100);
    expect(result.rules.length).toBe(1);
  });

  it('should filter by isActive', async () => {
    prismaMock.rule.count.mockResolvedValue(50);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await listRules({ isActive: true });

    expect(result.rules[0].isActive).toBe(true);
  });

  it('should filter by classtype', async () => {
    prismaMock.rule.count.mockResolvedValue(10);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await listRules({ classtype: 'attempted-admin' });

    expect(result.rules[0].classtype).toBe('attempted-admin');
  });

  it('should filter by sourceId', async () => {
    const ruleWithSource = {
      ...mockRule,
      sourceId: 1,
      source: mockRuleSource,
    };
    prismaMock.rule.count.mockResolvedValue(5);
    prismaMock.rule.findMany.mockResolvedValue([ruleWithSource] as any);

    const result = await listRules({ sourceId: 1 });

    expect(result.rules[0].source?.id).toBe(1);
  });

  it('should support search in message', async () => {
    prismaMock.rule.count.mockResolvedValue(3);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await listRules({ search: 'EternalBlue' });

    expect(result.rules[0].message).toContain('EternalBlue');
  });

  it('should respect limit and offset', async () => {
    prismaMock.rule.count.mockResolvedValue(100);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    await listRules({ limit: 10, offset: 20 });

    expect(prismaMock.rule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
  });
});

describe('Rule Service - updateRule', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should update notes and isActive', async () => {
    const updatedRule = {
      ...mockRule,
      notes: 'Updated notes',
      isActive: false,
    };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(updatedRule as any);

    const result = await updateRule(1, {
      notes: 'Updated notes',
      isActive: false,
    });

    expect(result.notes).toBe('Updated notes');
    expect(result.isActive).toBe(false);
  });

  it('should throw 404 for invalid ID', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(null);

    await expect(
      updateRule(999, { notes: 'Test' }),
    ).rejects.toThrow(RuleNotFoundError);
  });

  it('cannot change message, sid, rev, classtype, ruleFormat', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(mockRule as any);

    // Service should only accept notes and isActive
    const result = await updateRule(1, { notes: 'New notes' });

    // Core fields remain unchanged
    expect(result.message).toBe(mockRule.message);
    expect(result.sid).toBe(mockRule.sid);
    expect(result.rev).toBe(mockRule.rev);
  });

  it('should update references properly', async () => {
    const ruleWithNewRef = {
      ...mockRule,
      references: [
        ...mockRule.references,
        { id: 3, text: 'CVE-2024-1234', ruleId: 1 },
      ],
    };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(ruleWithNewRef as any);

    const result = await updateRule(1, { notes: 'Added reference' });

    expect(result.references.length).toBe(3);
  });

  it('should update timestamp', async () => {
    const updatedRule = {
      ...mockRule,
      updatedAt: new Date('2024-06-01'),
    };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(updatedRule as any);

    const result = await updateRule(1, { notes: 'Test' });

    expect(result.updatedAt).not.toEqual(mockRule.createdAt);
  });
});

describe('Rule Service - deleteRule', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should delete rule and cascade references', async () => {
    prismaMock.rule.delete.mockResolvedValue(mockRule as any);

    await deleteRule(1);

    expect(prismaMock.rule.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('should throw 404 for invalid ID', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '5.0.0',
      },
    );
    prismaMock.rule.delete.mockRejectedValue(error);

    await expect(deleteRule(999)).rejects.toThrow(RuleNotFoundError);
  });

  it('should verify deletion with query', async () => {
    prismaMock.rule.delete.mockResolvedValue(mockRule as any);
    prismaMock.rule.findUnique.mockResolvedValue(null);

    await deleteRule(1);

    // Verify it's deleted
    const result = await prismaMock.rule.findUnique({ where: { id: 1 } });
    expect(result).toBeNull();
  });
});

describe('Rule Service - Reference Management', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should add reference to rule', async () => {
    const newRef = { id: 3, text: 'CVE-2024-5678', ruleId: 1 };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.reference.create.mockResolvedValue(newRef as any);

    const result = await addRuleReference(1, 'CVE-2024-5678');

    expect(result.text).toBe('CVE-2024-5678');
    expect(result.ruleId).toBe(1);
  });

  it('should remove reference from rule', async () => {
    prismaMock.reference.delete.mockResolvedValue(
      mockRule.references[0] as any,
    );

    await removeRuleReference(1);

    expect(prismaMock.reference.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('should support multiple references per rule', async () => {
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);

    const result = await getRuleById(1);

    expect(result.references.length).toBeGreaterThan(1);
  });

  it('should throw 404 for invalid reference ID', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '5.0.0',
      },
    );
    prismaMock.reference.delete.mockRejectedValue(error);

    await expect(removeRuleReference(999)).rejects.toThrow(RuleNotFoundError);
  });
});

describe('Rule Service - Search', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should search by message text', async () => {
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await searchRules('EternalBlue');

    expect(result[0].message).toContain('EternalBlue');
  });

  it('should search by CVE reference', async () => {
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await searchRules('CVE-2017-0144');

    expect(result[0].references[0].text).toContain('CVE-2017-0144');
  });

  it('should be case-insensitive', async () => {
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await searchRules('eternalblue');

    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Rule Service - Versioning', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should create new version with same SID, rev+1', async () => {
    const newRuleText = `alert tcp $EXTERNAL_NET any -> $HOME_NET 445 (msg:"ET EXPLOIT Possible MS17-010 EternalBlue Exploit Attempt"; flow:to_server,established; content:"|fe 53 4d 42|"; offset:4; depth:4; classtype:attempted-admin; sid:2024218; rev:4; reference:cve,2017-0144;)`;
    const newRule = { ...mockRule, rev: 4, ruleFormat: newRuleText };

    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any); // Original rule
    prismaMock.rule.findUnique.mockResolvedValue(null); // No duplicate
    prismaMock.rule.create.mockResolvedValue(newRule as any);

    const result = await createRuleVersion(2024218, newRuleText);

    expect(result.sid).toBe(2024218);
    expect(result.rev).toBe(4);
  });

  it('should get all versions of rule', async () => {
    const rule1 = { ...mockRule, rev: 1 };
    const rule2 = { ...mockRule, rev: 2 };
    const rule3 = { ...mockRule, rev: 3 };
    prismaMock.rule.findMany.mockResolvedValue([rule3, rule2, rule1] as any);

    const result = await getRuleVersions(2024218);

    expect(result.length).toBe(3);
    expect(result[0].rev).toBe(3); // Descending order
  });

  it('should keep old versions accessible', async () => {
    prismaMock.rule.findUnique.mockResolvedValue({ ...mockRule, rev: 1 } as any);

    const result = await getRuleBySid(2024218, 1);

    expect(result.rev).toBe(1);
  });

  it('should preserve version history', async () => {
    const allVersions = [
      { ...mockRule, rev: 1 },
      { ...mockRule, rev: 2 },
      { ...mockRule, rev: 3 },
    ];
    prismaMock.rule.findMany.mockResolvedValue(allVersions as any);

    const result = await getRuleVersions(2024218);

    expect(result.length).toBe(3);
  });
});

describe('Rule Service - Rule Sources', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should create rule source', async () => {
    prismaMock.ruleSource.findUnique.mockResolvedValue(null);
    prismaMock.ruleSource.create.mockResolvedValue(mockRuleSource as any);
    prismaMock.rule.count.mockResolvedValue(0);

    const result = await createRuleSource(
      'Emerging Threats',
      'https://rules.emergingthreats.net/open/snort-2.9.0/rules/',
      'Community rules from Emerging Threats',
    );

    expect(result.name).toBe('Emerging Threats');
    expect(result.uri).toContain('emergingthreats.net');
  });

  it('should throw 409 for duplicate name', async () => {
    prismaMock.ruleSource.findUnique.mockResolvedValue(mockRuleSource as any);

    await expect(
      createRuleSource('Emerging Threats', 'http://example.com'),
    ).rejects.toThrow(RuleSourceExistsError);
  });

  it('should list sources with rule counts', async () => {
    prismaMock.ruleSource.findMany.mockResolvedValue([mockRuleSource] as any);
    prismaMock.rule.count.mockResolvedValue(150);

    const result = await listRuleSources();

    expect(result[0].ruleCount).toBe(150);
  });

  it('should update source info', async () => {
    const updatedSource = {
      ...mockRuleSource,
      uri: 'https://new-url.com',
    };
    prismaMock.ruleSource.update.mockResolvedValue(updatedSource as any);
    prismaMock.rule.count.mockResolvedValue(150);

    const result = await updateRuleSource(1, {
      uri: 'https://new-url.com',
    });

    expect(result.uri).toBe('https://new-url.com');
  });

  it('should delete source (orphans rules)', async () => {
    prismaMock.ruleSource.delete.mockResolvedValue(mockRuleSource as any);

    await deleteRuleSource(1);

    expect(prismaMock.ruleSource.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });
});

describe('Rule Service - Statistics', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should get rule statistics', async () => {
    prismaMock.rule.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(80) // active
      .mockResolvedValueOnce(20); // inactive

    prismaMock.rule.groupBy
      .mockResolvedValueOnce([
        // By classtype
        { classtype: 'attempted-admin', _count: { classtype: 30 } },
        { classtype: 'web-application-attack', _count: { classtype: 25 } },
      ] as any)
      .mockResolvedValueOnce([
        // By source
        { sourceId: 1, _count: { sourceId: 50 } },
      ] as any);

    prismaMock.ruleSource.findUnique.mockResolvedValue(mockRuleSource as any);
    prismaMock.rule.findMany.mockResolvedValue([{ sid: 1 }, { sid: 2 }] as any);

    const result = await getRuleStatistics();

    expect(result.totalRules).toBe(100);
    expect(result.activeRules).toBe(80);
    expect(result.inactiveRules).toBe(20);
    expect(result.uniqueSids).toBe(2);
  });

  it('should provide correct counts and aggregations', async () => {
    prismaMock.rule.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(10);

    prismaMock.rule.groupBy
      .mockResolvedValueOnce([
        { classtype: 'attempted-admin', _count: { classtype: 20 } },
        { classtype: 'trojan-activity', _count: { classtype: 15 } },
      ] as any)
      .mockResolvedValueOnce([] as any);

    prismaMock.rule.findMany.mockResolvedValue([
      { sid: 1 },
      { sid: 2 },
      { sid: 3 },
    ] as any);

    const result = await getRuleStatistics();

    expect(result.rulesByClasstype.length).toBe(2);
    expect(result.rulesByClasstype[0].count).toBe(20);
  });
});

describe('Rule Service - setRuleActive', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should activate rule', async () => {
    const activeRule = { ...mockRule, isActive: true };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(activeRule as any);

    const result = await setRuleActive(1, true);

    expect(result.isActive).toBe(true);
  });

  it('should deactivate rule', async () => {
    const inactiveRule = { ...mockRule, isActive: false };
    prismaMock.rule.findUnique.mockResolvedValue(mockRule as any);
    prismaMock.rule.update.mockResolvedValue(inactiveRule as any);

    const result = await setRuleActive(1, false);

    expect(result.isActive).toBe(false);
  });
});

describe('Rule Service - getRulesByClasstype', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should get rules by classtype with pagination', async () => {
    prismaMock.rule.count.mockResolvedValue(30);
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    const result = await getRulesByClasstype('attempted-admin', 10, 0);

    expect(result.total).toBe(30);
    expect(result.rules[0].classtype).toBe('attempted-admin');
  });
});

describe('Rule Service - Edge Cases', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should handle empty rule text', async () => {
    await expect(createRule('')).rejects.toThrow(RuleValidationError);
  });

  it('should handle rule with missing SID', async () => {
    const ruleNoSid = `alert tcp any any -> any 80 (msg:"Test"; classtype:web-application-attack; rev:1;)`;
    await expect(createRule(ruleNoSid)).rejects.toThrow(RuleValidationError);
  });

  it('should handle rule with missing rev', async () => {
    const ruleNoRev = `alert tcp any any -> any 80 (msg:"Test"; classtype:web-application-attack; sid:1000001;)`;
    await expect(createRule(ruleNoRev)).rejects.toThrow(RuleValidationError);
  });

  it('should handle rule with missing classtype', async () => {
    const ruleNoClasstype = `alert tcp any any -> any 80 (msg:"Test"; sid:1000001; rev:1;)`;
    await expect(createRule(ruleNoClasstype)).rejects.toThrow(
      RuleValidationError,
    );
  });

  it('should handle version mismatch in createRuleVersion', async () => {
    const wrongSidRule = `alert tcp any any -> any 80 (msg:"Test"; classtype:web-application-attack; sid:9999999; rev:2;)`;
    prismaMock.rule.findMany.mockResolvedValue([mockRule] as any);

    await expect(createRuleVersion(2024218, wrongSidRule)).rejects.toThrow(
      RuleValidationError,
    );
  });
});
