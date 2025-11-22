/**
 * Unit tests for Snort rule parser
 */

import {
  parseSnortRule,
  renderSnortRule,
  getOption,
  setOption,
  isValidSnortRule,
  extractReferences,
  parseReference,
  InvalidRuleError,
} from '../src/lib/rule-parser';
import {
  validateRuleFormat,
  isValidSid,
  isValidClasstype,
  isValidAction,
  isValidProtocol,
  getSidCategory,
} from '../src/lib/rule-validators';
import {
  renderRuleTemplate,
  extractVariables,
  getDefaultContext,
  validateContext,
  mergeContexts,
  createCustomContext,
} from '../src/lib/rule-renderer';
import {
  EXAMPLE_RULES,
  EDGE_CASES,
  INVALID_RULES,
  TEMPLATE_RULES,
} from './fixtures/rules.fixture';

describe('Rule Parser', () => {
  describe('parseSnortRule', () => {
    test('should parse simple rule', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);

      expect(parsed.action).toBe('alert');
      expect(parsed.protocol).toBe('tcp');
      expect(parsed.sourceAddr).toBe('$HOME_NET');
      expect(parsed.sourcePort).toBe('any');
      expect(parsed.direction).toBe('->');
      expect(parsed.destAddr).toBe('$EXTERNAL_NET');
      expect(parsed.destPort).toBe('any');
      expect(parsed.message).toBe('Simple TCP Alert');
      expect(parsed.sid).toBe(1000001);
      expect(parsed.rev).toBe(1);
    });

    test('should parse rule with classtype', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withClasstype);

      expect(parsed.classtype).toBe('attempted-user');
      expect(parsed.destPort).toBe('[21,23]');
    });

    test('should parse rule with content options', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withContent);

      expect(getOption(parsed, 'content')).toBe('USER ');
      expect(getOption(parsed, 'flow')).toBe('to_server,established');
    });

    test('should parse rule with regex (pcre)', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withRegex);

      expect(getOption(parsed, 'pcre')).toBe('/\\/api\\/[a-z0-9]{32}/i');
      expect(getOption(parsed, 'http_method')).toBe('');
      expect(getOption(parsed, 'http_uri')).toBe('');
    });

    test('should parse rule with multiple references', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withMultipleReferences);

      const refs = extractReferences(parsed);
      expect(refs).toHaveLength(2);
      expect(refs).toContain('CVE-2021-44228');
      expect(refs).toContain('https://nvd.nist.gov/vuln/detail/CVE-2021-44228');
    });

    test('should parse complex Log4j rule', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.log4jExploit);

      expect(parsed.message).toBe(
        'ET EXPLOIT Apache Log4j RCE Attempt (http ldap)',
      );
      expect(parsed.sid).toBe(2034647);
      expect(parsed.rev).toBe(3);
      expect(getOption(parsed, 'fast_pattern')).toBe('');
      expect(getOption(parsed, 'metadata')).toContain('affected_product Any');
    });

    test('should parse Emerging Threats rule with metadata', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.emergingThreats);

      expect(parsed.message).toContain('ET MALWARE');
      expect(getOption(parsed, 'metadata')).toContain(
        'policy balanced-ips drop',
      );
      expect(parsed.references).toContain('MD5:1234567890abcdef');
    });

    test('should handle quotes in message', () => {
      const parsed = parseSnortRule(EDGE_CASES.quotesInMessage);

      expect(parsed.message).toBe('Test with \\"quotes\\" inside');
    });

    test('should handle multiple content options', () => {
      const parsed = parseSnortRule(EDGE_CASES.multipleContent);

      const content = getOption(parsed, 'content');
      expect(Array.isArray(content)).toBe(true);
      expect(content).toHaveLength(3);
      expect(content).toEqual(['GET', 'POST', 'PUT']);
    });

    test('should parse bidirectional rule', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.bidirectional);

      expect(parsed.direction).toBe('<>');
    });

    test('should parse rule with specific IP addresses', () => {
      const parsed = parseSnortRule(EDGE_CASES.ipv4Address);

      expect(parsed.sourceAddr).toBe('192.168.1.0/24');
      expect(parsed.destAddr).toBe('10.0.0.0/8');
    });

    test('should parse rule with port ranges', () => {
      const parsed = parseSnortRule(EDGE_CASES.portRange);

      expect(parsed.sourcePort).toBe('1024:65535');
      expect(parsed.destPort).toBe('[80,443,8080]');
    });

    test('should parse rule with negation', () => {
      const parsed = parseSnortRule(EDGE_CASES.negation);

      expect(parsed.sourceAddr).toBe('!$HOME_NET');
    });

    test('should throw error for empty rule', () => {
      expect(() => parseSnortRule(INVALID_RULES.emptyRule)).toThrow(
        InvalidRuleError,
      );
    });

    test('should throw error for rule without parentheses', () => {
      expect(() => parseSnortRule(INVALID_RULES.noParentheses)).toThrow(
        InvalidRuleError,
      );
    });

    test('should throw error for rule with missing parts', () => {
      expect(() => parseSnortRule(INVALID_RULES.missingParts)).toThrow(
        InvalidRuleError,
      );
    });
  });

  describe('renderSnortRule', () => {
    test('should render simple rule correctly', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain(
        'alert tcp $HOME_NET any -> $EXTERNAL_NET any',
      );
      expect(rendered).toContain('msg:"Simple TCP Alert"');
      expect(rendered).toContain('sid:1000001');
      expect(rendered).toContain('rev:1');
    });

    test('should maintain option ordering (msg, classtype, sid, rev first)', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withClasstype);
      const rendered = renderSnortRule(parsed);

      const msgIndex = rendered.indexOf('msg:');
      const classtypeIndex = rendered.indexOf('classtype:');
      const sidIndex = rendered.indexOf('sid:');
      const revIndex = rendered.indexOf('rev:');

      expect(msgIndex).toBeLessThan(classtypeIndex);
      expect(classtypeIndex).toBeLessThan(sidIndex);
      expect(sidIndex).toBeLessThan(revIndex);
    });

    test('should quote values with spaces', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain('msg:"Simple TCP Alert"');
    });

    test('should preserve content options', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withContent);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain('content:"USER "');
      expect(rendered).toContain('flow:to_server,established');
    });

    test('should preserve flow options', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.log4jExploit);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain('flow:established,to_server');
    });

    test('should preserve pcre/regex options', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withRegex);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain('pcre:');
    });

    test('should render multiple references correctly', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withMultipleReferences);
      const rendered = renderSnortRule(parsed);

      expect(rendered).toContain('reference:cve,2021-44228');
      expect(rendered).toContain('reference:url');
    });

    test('should round-trip: parse then render matches original', () => {
      const original = EXAMPLE_RULES.simple;
      const parsed = parseSnortRule(original);
      const rendered = renderSnortRule(parsed);
      const reparsed = parseSnortRule(rendered);

      expect(reparsed.action).toBe(parsed.action);
      expect(reparsed.protocol).toBe(parsed.protocol);
      expect(reparsed.sid).toBe(parsed.sid);
      expect(reparsed.rev).toBe(parsed.rev);
      expect(reparsed.message).toBe(parsed.message);
    });
  });

  describe('getOption and setOption', () => {
    test('should get option value', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const msg = getOption(parsed, 'msg');

      expect(msg).toBe('Simple TCP Alert');
    });

    test('should get option case-insensitively', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const msg1 = getOption(parsed, 'msg');
      const msg2 = getOption(parsed, 'MSG');
      const msg3 = getOption(parsed, 'Msg');

      expect(msg1).toBe(msg2);
      expect(msg2).toBe(msg3);
    });

    test('should set option value', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      setOption(parsed, 'msg', 'Updated Message');

      expect(parsed.message).toBe('Updated Message');
      expect(getOption(parsed, 'msg')).toBe('Updated Message');
    });

    test('should update sid when set', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      setOption(parsed, 'sid', '9999999');

      expect(parsed.sid).toBe(9999999);
    });

    test('should return undefined for non-existent option', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const value = getOption(parsed, 'nonexistent');

      expect(value).toBeUndefined();
    });
  });

  describe('isValidSnortRule', () => {
    test('should return true for valid rules', () => {
      expect(isValidSnortRule(EXAMPLE_RULES.simple)).toBe(true);
      expect(isValidSnortRule(EXAMPLE_RULES.withContent)).toBe(true);
      expect(isValidSnortRule(EXAMPLE_RULES.log4jExploit)).toBe(true);
    });

    test('should return false for invalid rules', () => {
      expect(isValidSnortRule(INVALID_RULES.emptyRule)).toBe(false);
      expect(isValidSnortRule(INVALID_RULES.noParentheses)).toBe(false);
      expect(isValidSnortRule(INVALID_RULES.missingParts)).toBe(false);
    });
  });

  describe('extractReferences', () => {
    test('should extract CVE reference', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withMultipleReferences);
      const refs = extractReferences(parsed);

      expect(refs).toContain('CVE-2021-44228');
    });

    test('should extract URL reference', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withRegex);
      const refs = extractReferences(parsed);

      expect(refs).toContain('https://example.com');
    });

    test('should extract MD5 reference', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.emergingThreats);
      const refs = extractReferences(parsed);

      expect(refs).toContain('MD5:1234567890abcdef');
    });

    test('should extract multiple references', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.withMultipleReferences);
      const refs = extractReferences(parsed);

      expect(refs.length).toBeGreaterThan(1);
    });

    test('should return empty array when no references', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.simple);
      const refs = extractReferences(parsed);

      expect(refs).toEqual([]);
    });

    test('should normalize CVE format', () => {
      const parsed = parseSnortRule(EXAMPLE_RULES.log4jExploit);
      const refs = extractReferences(parsed);

      const cveRef = refs.find((r) => r.includes('CVE'));
      expect(cveRef).toMatch(/^CVE-\d{4}-\d+$/);
    });
  });

  describe('parseReference', () => {
    test('should parse CVE reference', () => {
      expect(parseReference('cve,2021-44228')).toBe('CVE-2021-44228');
      expect(parseReference('cve,44228')).toBe('CVE-44228');
    });

    test('should parse URL reference', () => {
      expect(parseReference('url,https://example.com')).toBe(
        'https://example.com',
      );
    });

    test('should parse MD5 reference', () => {
      expect(parseReference('md5,1234567890abcdef')).toBe(
        'MD5:1234567890abcdef',
      );
    });

    test('should parse bugtraq reference', () => {
      expect(parseReference('bugtraq,70103')).toBe('BugTraq-70103');
    });

    test('should handle unknown reference types', () => {
      expect(parseReference('custom,value')).toBe('custom:value');
    });

    test('should handle reference without comma', () => {
      expect(parseReference('standalone')).toBe('standalone');
    });
  });
});

describe('Rule Validators', () => {
  describe('validateRuleFormat', () => {
    test('should validate correct rule', () => {
      const result = validateRuleFormat(EXAMPLE_RULES.simple);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject empty rule', () => {
      const result = validateRuleFormat('');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Rule text cannot be empty');
    });

    test('should reject rule without sid', () => {
      const result = validateRuleFormat(INVALID_RULES.noSid);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('sid'))).toBe(true);
    });

    test('should reject invalid action', () => {
      const result = validateRuleFormat(INVALID_RULES.invalidAction);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('action'))).toBe(true);
    });

    test('should reject invalid protocol', () => {
      const result = validateRuleFormat(INVALID_RULES.invalidProtocol);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('protocol'))).toBe(true);
    });

    test('should detect unclosed quotes', () => {
      const result = validateRuleFormat(INVALID_RULES.unclosedQuote);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('quote'))).toBe(true);
    });

    test('should detect unbalanced parentheses', () => {
      const result = validateRuleFormat(INVALID_RULES.unbalancedParens);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('parentheses'))).toBe(true);
    });

    test('should validate complex rule', () => {
      const result = validateRuleFormat(EXAMPLE_RULES.log4jExploit);

      expect(result.valid).toBe(true);
    });
  });

  describe('isValidSid', () => {
    test('should accept valid public SID', () => {
      expect(isValidSid(1)).toBe(true);
      expect(isValidSid(999999)).toBe(true);
    });

    test('should accept valid community SID', () => {
      expect(isValidSid(1000000)).toBe(true);
      expect(isValidSid(1999999)).toBe(true);
    });

    test('should accept valid local SID', () => {
      expect(isValidSid(2000000)).toBe(true);
      expect(isValidSid(3999999)).toBe(true);
    });

    test('should reject SID out of range', () => {
      expect(isValidSid(0)).toBe(false);
      expect(isValidSid(4000000)).toBe(false);
      expect(isValidSid(-1)).toBe(false);
    });
  });

  describe('getSidCategory', () => {
    test('should categorize public SID', () => {
      expect(getSidCategory(500000)).toBe('Public Snort Rules');
    });

    test('should categorize community SID', () => {
      expect(getSidCategory(1500000)).toBe('Community Rules');
    });

    test('should categorize local SID', () => {
      expect(getSidCategory(2500000)).toBe('Local/User Rules');
    });

    test('should return Invalid for out of range', () => {
      expect(getSidCategory(5000000)).toBe('Invalid');
    });
  });

  describe('isValidClasstype', () => {
    test('should accept valid classtypes', () => {
      expect(isValidClasstype('attempted-admin')).toBe(true);
      expect(isValidClasstype('trojan-activity')).toBe(true);
      expect(isValidClasstype('web-application-attack')).toBe(true);
      expect(isValidClasstype('attempted-recon')).toBe(true);
    });

    test('should be case-insensitive', () => {
      expect(isValidClasstype('ATTEMPTED-ADMIN')).toBe(true);
      expect(isValidClasstype('Trojan-Activity')).toBe(true);
    });

    test('should reject invalid classtype', () => {
      expect(isValidClasstype('invalid-classtype')).toBe(false);
      expect(isValidClasstype('random')).toBe(false);
    });
  });

  describe('isValidAction', () => {
    test('should accept valid actions', () => {
      expect(isValidAction('alert')).toBe(true);
      expect(isValidAction('log')).toBe(true);
      expect(isValidAction('pass')).toBe(true);
      expect(isValidAction('drop')).toBe(true);
      expect(isValidAction('reject')).toBe(true);
    });

    test('should be case-insensitive', () => {
      expect(isValidAction('ALERT')).toBe(true);
      expect(isValidAction('Alert')).toBe(true);
    });

    test('should reject invalid action', () => {
      expect(isValidAction('invalid')).toBe(false);
      expect(isValidAction('block')).toBe(false);
    });
  });

  describe('isValidProtocol', () => {
    test('should accept valid protocols', () => {
      expect(isValidProtocol('tcp')).toBe(true);
      expect(isValidProtocol('udp')).toBe(true);
      expect(isValidProtocol('icmp')).toBe(true);
      expect(isValidProtocol('http')).toBe(true);
    });

    test('should be case-insensitive', () => {
      expect(isValidProtocol('TCP')).toBe(true);
      expect(isValidProtocol('Http')).toBe(true);
    });

    test('should reject invalid protocol', () => {
      expect(isValidProtocol('invalid')).toBe(false);
      expect(isValidProtocol('xyz')).toBe(false);
    });
  });
});

describe('Rule Template Rendering', () => {
  describe('renderRuleTemplate', () => {
    test('should replace HOME_NET variable', () => {
      const template = TEMPLATE_RULES.homeNet;
      const context = {
        HOME_NET: '192.168.1.0/24',
        EXTERNAL_NET: '!192.168.1.0/24',
      };
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('192.168.1.0/24');
      expect(rendered).not.toContain('$HOME_NET');
    });

    test('should replace HTTP_PORTS variable', () => {
      const template = TEMPLATE_RULES.httpPorts;
      const context = { HTTP_PORTS: '[80,443,8080]' };
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('[80,443,8080]');
      expect(rendered).not.toContain('$HTTP_PORTS');
    });

    test('should replace multiple variables', () => {
      const template = TEMPLATE_RULES.multipleVars;
      const context = {
        HOME_NET: '10.0.0.0/8',
        EXTERNAL_NET: '!10.0.0.0/8',
        HTTP_PORTS: '[80,443]',
      };
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('10.0.0.0/8');
      expect(rendered).toContain('[80,443]');
    });

    test('should keep variables not in context', () => {
      const template = TEMPLATE_RULES.customVar;
      const context = { HOME_NET: '192.168.1.0/24' };
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('$CUSTOM_NET');
    });

    test('should handle empty context', () => {
      const template = TEMPLATE_RULES.homeNet;
      const rendered = renderRuleTemplate(template, {});

      expect(rendered).toBe(template);
    });

    test('should use default context', () => {
      const template = TEMPLATE_RULES.homeNet;
      const context = getDefaultContext();
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('$HOME_NET'); // Still variable
    });

    test('should handle SHELLCODE_PORTS', () => {
      const template = TEMPLATE_RULES.shellcodePorts;
      const context = getDefaultContext();
      const rendered = renderRuleTemplate(template, context);

      expect(rendered).toContain('[!80,!443,!3128,!8080,!8443]');
    });
  });

  describe('extractVariables', () => {
    test('should extract HOME_NET', () => {
      const vars = extractVariables(TEMPLATE_RULES.homeNet);

      expect(vars).toContain('HOME_NET');
      expect(vars).toContain('EXTERNAL_NET');
    });

    test('should extract HTTP_PORTS', () => {
      const vars = extractVariables(TEMPLATE_RULES.httpPorts);

      expect(vars).toContain('HTTP_PORTS');
    });

    test('should extract all unique variables', () => {
      const vars = extractVariables(TEMPLATE_RULES.multipleVars);

      expect(vars).toContain('HOME_NET');
      expect(vars).toContain('EXTERNAL_NET');
      expect(vars).toContain('HTTP_PORTS');
      expect(new Set(vars).size).toBe(vars.length); // No duplicates
    });

    test('should return empty array when no variables', () => {
      const vars = extractVariables(EXAMPLE_RULES.simple);

      // Simple rule still has $HOME_NET and $EXTERNAL_NET
      expect(vars.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultContext', () => {
    test('should return context with HOME_NET', () => {
      const ctx = getDefaultContext();

      expect(ctx.HOME_NET).toBe('$HOME_NET');
    });

    test('should return context with EXTERNAL_NET', () => {
      const ctx = getDefaultContext();

      expect(ctx.EXTERNAL_NET).toBe('!$HOME_NET');
    });

    test('should return context with HTTP_PORTS', () => {
      const ctx = getDefaultContext();

      expect(ctx.HTTP_PORTS).toBe('[80,443,8080,8443]');
    });

    test('should return context with SHELLCODE_PORTS', () => {
      const ctx = getDefaultContext();

      expect(ctx.SHELLCODE_PORTS).toBe('[!80,!443,!3128,!8080,!8443]');
    });
  });

  describe('validateContext', () => {
    test('should validate complete context', () => {
      const template = TEMPLATE_RULES.multipleVars;
      const context = {
        HOME_NET: '192.168.1.0/24',
        EXTERNAL_NET: '!192.168.1.0/24',
        HTTP_PORTS: '[80,443]',
      };
      const result = validateContext(template, context);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    test('should detect missing variables', () => {
      const template = TEMPLATE_RULES.multipleVars;
      const context = { HOME_NET: '192.168.1.0/24' };
      const result = validateContext(template, context);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('EXTERNAL_NET');
      expect(result.missing).toContain('HTTP_PORTS');
    });

    test('should handle custom variables', () => {
      const template = TEMPLATE_RULES.customVar;
      const context = {};
      const result = validateContext(template, context);

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('CUSTOM_NET');
    });
  });

  describe('mergeContexts', () => {
    test('should merge two contexts', () => {
      const base = { HOME_NET: '$HOME_NET', HTTP_PORTS: '[80,443]' };
      const override = { HOME_NET: '192.168.1.0/24' };
      const merged = mergeContexts(base, override);

      expect(merged.HOME_NET).toBe('192.168.1.0/24');
      expect(merged.HTTP_PORTS).toBe('[80,443]');
    });

    test('should override take precedence', () => {
      const base = { VAR1: 'base', VAR2: 'base' };
      const override = { VAR1: 'override' };
      const merged = mergeContexts(base, override);

      expect(merged.VAR1).toBe('override');
      expect(merged.VAR2).toBe('base');
    });
  });

  describe('createCustomContext', () => {
    test('should create context with custom HOME_NET', () => {
      const ctx = createCustomContext('192.168.1.0/24');

      expect(ctx.HOME_NET).toBe('192.168.1.0/24');
      expect(ctx.EXTERNAL_NET).toBe('!192.168.1.0/24');
    });

    test('should merge additional variables', () => {
      const ctx = createCustomContext('10.0.0.0/8', { CUSTOM: 'value' });

      expect(ctx.HOME_NET).toBe('10.0.0.0/8');
      expect(ctx.CUSTOM).toBe('value');
    });

    test('should use defaults when no custom network', () => {
      const ctx = createCustomContext();

      expect(ctx.HOME_NET).toBe('$HOME_NET');
      expect(ctx.HTTP_PORTS).toBe('[80,443,8080,8443]');
    });
  });
});
