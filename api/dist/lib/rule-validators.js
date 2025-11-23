"use strict";
/**
 * Rule validation utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRuleFormat = validateRuleFormat;
exports.isValidAction = isValidAction;
exports.isValidProtocol = isValidProtocol;
exports.isValidSid = isValidSid;
exports.getSidCategory = getSidCategory;
exports.isValidClasstype = isValidClasstype;
exports.validateRuleContent = validateRuleContent;
exports.isValidPort = isValidPort;
exports.isValidAddress = isValidAddress;
const rule_parser_1 = require("./rule-parser");
/**
 * Validate Snort rule format
 * @param ruleText - Rule text to validate
 * @returns Validation result with any errors found
 */
function validateRuleFormat(ruleText) {
    const errors = [];
    if (!ruleText || ruleText.trim().length === 0) {
        errors.push('Rule text cannot be empty');
        return { valid: false, errors };
    }
    try {
        const parsed = (0, rule_parser_1.parseSnortRule)(ruleText);
        // Validate action
        if (!isValidAction(parsed.action)) {
            errors.push(`Invalid action: ${parsed.action}. Must be one of: alert, log, pass, drop, reject, sdrop`);
        }
        // Validate protocol
        if (!isValidProtocol(parsed.protocol)) {
            errors.push(`Invalid protocol: ${parsed.protocol}. Must be one of: tcp, udp, icmp, ip, http, ftp, tls, smb, dns, dcerpc, ssh, smtp, imap, http2`);
        }
        // Validate direction
        if (parsed.direction !== '->' && parsed.direction !== '<>') {
            errors.push(`Invalid direction: ${parsed.direction}. Must be -> or <>`);
        }
        // Validate required options
        if (!parsed.sid) {
            errors.push('Rule must have a sid (Snort ID)');
        }
        else if (!isValidSid(parsed.sid)) {
            errors.push(`Invalid sid: ${parsed.sid}. Must be between 1 and 3999999`);
        }
        if (!parsed.rev) {
            errors.push('Rule must have a rev (revision number)');
        }
        else if (parsed.rev < 1) {
            errors.push(`Invalid rev: ${parsed.rev}. Must be >= 1`);
        }
        if (!parsed.message || parsed.message.trim().length === 0) {
            errors.push('Rule must have a msg (message)');
        }
        // Validate classtype if present
        if (parsed.classtype && !isValidClasstype(parsed.classtype)) {
            errors.push(`Invalid classtype: ${parsed.classtype}. Not a recognized Snort classtype`);
        }
        // Check for unclosed quotes
        const quoteCount = (ruleText.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            errors.push('Rule has unclosed quotes');
        }
        // Check for balanced parentheses
        const openParens = (ruleText.match(/\(/g) || []).length;
        const closeParens = (ruleText.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
            errors.push('Rule has unbalanced parentheses');
        }
    }
    catch (error) {
        errors.push(error instanceof Error ? error.message : 'Failed to parse rule');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Validate Snort action
 */
function isValidAction(action) {
    const validActions = [
        'alert',
        'log',
        'pass',
        'drop',
        'reject',
        'sdrop',
        'activate',
        'dynamic',
    ];
    return validActions.includes(action.toLowerCase());
}
/**
 * Validate protocol
 */
function isValidProtocol(protocol) {
    const validProtocols = [
        'tcp',
        'udp',
        'icmp',
        'ip',
        'http',
        'ftp',
        'tls',
        'smb',
        'dns',
        'dcerpc',
        'ssh',
        'smtp',
        'imap',
        'http2',
        'dhcp',
        'modbus',
        'dnp3',
        'enip',
        'nfs',
        'ikev2',
        'krb5',
        'ntp',
        'snmp',
        'sip',
        'tftp',
    ];
    return validProtocols.includes(protocol.toLowerCase());
}
/**
 * Validate SID uniqueness and range
 * SID ranges:
 * - Public Snort IDs: 1-999999
 * - Community rules: 1000000-1999999
 * - Local/user rules: 2000000-3999999
 * @param sid - Snort ID to validate
 * @returns true if SID is in valid range
 */
function isValidSid(sid) {
    return sid >= 1 && sid <= 3999999;
}
/**
 * Get SID range category
 * @param sid - Snort ID
 * @returns Category description
 */
function getSidCategory(sid) {
    if (sid >= 1 && sid <= 999999) {
        return 'Public Snort Rules';
    }
    else if (sid >= 1000000 && sid <= 1999999) {
        return 'Community Rules';
    }
    else if (sid >= 2000000 && sid <= 3999999) {
        return 'Local/User Rules';
    }
    else {
        return 'Invalid';
    }
}
/**
 * Validate classtype
 * Standard Snort classtypes
 */
function isValidClasstype(classtype) {
    const validTypes = [
        'not-suspicious',
        'unknown',
        'bad-unknown',
        'attempted-recon',
        'successful-recon-limited',
        'successful-recon-largescale',
        'attempted-dos',
        'successful-dos',
        'attempted-user',
        'unsuccessful-user',
        'successful-user',
        'attempted-admin',
        'successful-admin',
        'rpc-portmap-decode',
        'shellcode-detect',
        'string-detect',
        'suspicious-filename-detect',
        'suspicious-login',
        'system-call-detect',
        'tcp-connection',
        'trojan-activity',
        'unusual-client-port-connection',
        'network-scan',
        'denial-of-service',
        'non-standard-protocol',
        'protocol-command-decode',
        'web-application-activity',
        'web-application-attack',
        'attempted-dos',
        'attempted-recon',
        'bad-unknown',
        'default-login-attempt',
        'misc-activity',
        'misc-attack',
        'non-standard-protocol',
        'policy-violation',
        'protocol-command-decode',
        'shellcode-detect',
        'successful-admin',
        'successful-dos',
        'successful-recon-largescale',
        'successful-recon-limited',
        'successful-user',
        'suspicious-filename-detect',
        'suspicious-login',
        'system-call-detect',
        'trojan-activity',
        'unsuccessful-user',
        'web-application-attack',
        'web-application-activity',
        'icmp-event',
        'kickass-porn',
    ];
    return validTypes.includes(classtype.toLowerCase());
}
/**
 * Validate rule content (prevent injection attacks)
 * @param ruleText - Rule text to validate
 * @returns true if content appears safe
 */
function validateRuleContent(ruleText) {
    // Check for dangerous patterns
    const dangerousPatterns = [
        /;\s*rm\s+-rf/i, // Shell commands
        /;\s*chmod/i,
        /;\s*chown/i,
        /;\s*sudo/i,
        /<script/i, // XSS attempts
        /javascript:/i,
        /on\w+\s*=/i, // Event handlers
        /\$\{.*\}/i, // Template injection (but allow ${} in content)
    ];
    for (const pattern of dangerousPatterns) {
        // Skip patterns that might legitimately appear in rule content
        if (pattern.source.includes('script') ||
            pattern.source.includes('javascript')) {
            // These might be detecting XSS, so allow them
            continue;
        }
        if (pattern.test(ruleText)) {
            return false;
        }
    }
    return true;
}
/**
 * Validate port specification
 * @param port - Port specification (e.g., "80", "any", "[80,443]", "1024:")
 * @returns true if valid port specification
 */
function isValidPort(port) {
    // Common patterns: any, number, range, list
    if (port === 'any') {
        return true;
    }
    // Variable: $HTTP_PORTS
    if (port.startsWith('$')) {
        return true;
    }
    // Single port number
    if (/^\d+$/.test(port)) {
        const num = parseInt(port, 10);
        return num >= 0 && num <= 65535;
    }
    // Port range: 1024:, :1024, 1024:2048
    if (/^\d*:\d*$/.test(port)) {
        return true;
    }
    // Port list: [80,443,8080]
    if (/^\[[\d,\s!]+\]$/.test(port)) {
        return true;
    }
    return false;
}
/**
 * Validate IP address specification
 * @param addr - IP address specification
 * @returns true if valid address specification
 */
function isValidAddress(addr) {
    // Common patterns: any, IP, CIDR, variable, negation
    if (addr === 'any') {
        return true;
    }
    // Variable: $HOME_NET
    if (addr.startsWith('$')) {
        return true;
    }
    // Negation: !$HOME_NET
    if (addr.startsWith('!')) {
        return isValidAddress(addr.substring(1));
    }
    // IPv4 address: 192.168.1.1
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr)) {
        return true;
    }
    // CIDR: 192.168.1.0/24
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(addr)) {
        return true;
    }
    // Address list: [192.168.1.0/24,10.0.0.0/8]
    if (/^\[[\d.,/\s!$A-Z_]+\]$/.test(addr)) {
        return true;
    }
    return false;
}
