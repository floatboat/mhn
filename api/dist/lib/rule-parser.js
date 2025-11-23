"use strict";
/**
 * Snort/Suricata Rule Parser - Parses rule text into structured format
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidRuleError = void 0;
exports.parseSnortRule = parseSnortRule;
exports.renderSnortRule = renderSnortRule;
exports.getOption = getOption;
exports.setOption = setOption;
exports.isValidSnortRule = isValidSnortRule;
exports.extractReferences = extractReferences;
exports.parseReference = parseReference;
/**
 * Custom error for invalid rule format
 */
class InvalidRuleError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidRuleError';
    }
}
exports.InvalidRuleError = InvalidRuleError;
/**
 * Parse Snort rule text into structured format
 * @param ruleText - The Snort rule text to parse
 * @returns Parsed rule object with structured data
 * @throws InvalidRuleError if rule format is invalid
 */
function parseSnortRule(ruleText) {
    const trimmedRule = ruleText.trim();
    if (!trimmedRule) {
        throw new InvalidRuleError('Rule text cannot be empty');
    }
    // Find the options section (everything in parentheses)
    const optionsMatch = trimmedRule.match(/\((.+)\)$/);
    if (!optionsMatch) {
        throw new InvalidRuleError('Rule must contain options in parentheses');
    }
    const optionsText = optionsMatch[1];
    const headerText = trimmedRule.substring(0, trimmedRule.indexOf('(')).trim();
    // Parse header: action protocol src_addr src_port direction dst_addr dst_port
    const headerParts = headerText.split(/\s+/);
    if (headerParts.length < 7) {
        throw new InvalidRuleError(`Invalid rule header format. Expected at least 7 parts, got ${headerParts.length}`);
    }
    const [action, protocol, sourceAddr, sourcePort, direction, destAddr, destPort,] = headerParts;
    // Validate direction
    if (direction !== '->' && direction !== '<>') {
        throw new InvalidRuleError(`Invalid direction: ${direction}. Must be -> or <>`);
    }
    // Parse options
    const options = parseOptions(optionsText);
    // Extract commonly used options
    const message = getOptionValue(options, 'msg');
    const sidStr = getOptionValue(options, 'sid');
    const revStr = getOptionValue(options, 'rev');
    const classtype = getOptionValue(options, 'classtype');
    const references = extractReferences({ options });
    return {
        action,
        protocol,
        sourceAddr,
        sourcePort,
        direction,
        destAddr,
        destPort,
        options,
        message,
        sid: sidStr ? parseInt(sidStr, 10) : undefined,
        rev: revStr ? parseInt(revStr, 10) : undefined,
        classtype,
        references,
        rawRule: trimmedRule,
    };
}
/**
 * Parse options string into Map
 * Handles quoted strings, multiple values, and nested content
 */
function parseOptions(optionsText) {
    const options = new Map();
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    // Split by semicolon, but respect quotes
    const parts = [];
    for (let i = 0; i < optionsText.length; i++) {
        const char = optionsText[i];
        if ((char === '"' || char === "'") &&
            (i === 0 || optionsText[i - 1] !== '\\')) {
            if (!inQuotes) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            }
            else if (char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
                current += char;
            }
            else {
                current += char;
            }
        }
        else if (char === ';' && !inQuotes) {
            if (current.trim()) {
                parts.push(current.trim());
            }
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    // Process each option
    for (const part of parts) {
        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) {
            // Option without value (e.g., nocase, established)
            options.set(part.toLowerCase(), '');
            continue;
        }
        const key = part.substring(0, colonIndex).trim().toLowerCase();
        let value = part.substring(colonIndex + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
        }
        // Check if this key already exists (for multiple values like content, reference)
        const existing = options.get(key);
        if (existing !== undefined) {
            if (Array.isArray(existing)) {
                existing.push(value);
            }
            else {
                options.set(key, [existing, value]);
            }
        }
        else {
            options.set(key, value);
        }
    }
    return options;
}
/**
 * Get option value from parsed rule options
 */
function getOptionValue(options, key) {
    return options.get(key.toLowerCase());
}
/**
 * Render parsed rule back to Snort format
 * @param parsed - Parsed rule object
 * @returns Formatted Snort rule string
 */
function renderSnortRule(parsed) {
    const header = `${parsed.action} ${parsed.protocol} ${parsed.sourceAddr} ${parsed.sourcePort} ${parsed.direction} ${parsed.destAddr} ${parsed.destPort}`;
    // Order options: msg, classtype, sid, rev, references, then others
    const orderedOptions = [];
    const processedKeys = new Set();
    // Add msg first
    if (parsed.options.has('msg')) {
        orderedOptions.push(formatOption('msg', parsed.options.get('msg')));
        processedKeys.add('msg');
    }
    // Add classtype
    if (parsed.options.has('classtype')) {
        orderedOptions.push(formatOption('classtype', parsed.options.get('classtype')));
        processedKeys.add('classtype');
    }
    // Add sid
    if (parsed.options.has('sid')) {
        orderedOptions.push(formatOption('sid', parsed.options.get('sid')));
        processedKeys.add('sid');
    }
    // Add rev
    if (parsed.options.has('rev')) {
        orderedOptions.push(formatOption('rev', parsed.options.get('rev')));
        processedKeys.add('rev');
    }
    // Add references
    if (parsed.options.has('reference')) {
        const refs = parsed.options.get('reference');
        if (Array.isArray(refs)) {
            refs.forEach((ref) => orderedOptions.push(formatOption('reference', ref)));
        }
        else {
            orderedOptions.push(formatOption('reference', refs));
        }
        processedKeys.add('reference');
    }
    // Add metadata
    if (parsed.options.has('metadata')) {
        orderedOptions.push(formatOption('metadata', parsed.options.get('metadata')));
        processedKeys.add('metadata');
    }
    // Add all other options
    for (const [key, value] of parsed.options) {
        if (!processedKeys.has(key)) {
            if (Array.isArray(value)) {
                value.forEach((v) => orderedOptions.push(formatOption(key, v)));
            }
            else {
                orderedOptions.push(formatOption(key, value));
            }
        }
    }
    return `${header} (${orderedOptions.join('; ')};)`;
}
/**
 * Format a single option for rendering
 */
function formatOption(key, value) {
    if (Array.isArray(value)) {
        // This shouldn't happen as we handle arrays in renderSnortRule
        return value.map((v) => formatOption(key, v)).join('; ');
    }
    if (value === '') {
        // Option without value
        return key;
    }
    // Check if value needs quotes (contains spaces, but not commas which are common in flow, metadata, etc.)
    // Only quote if the value has spaces that aren't part of comma-separated lists
    const needsQuotes = /\s/.test(value) && !/^[a-zA-Z0-9_,\-.:\/]+$/.test(value);
    const quotedValue = needsQuotes ? `"${value}"` : value;
    return `${key}:${quotedValue}`;
}
/**
 * Extract specific option from parsed rule
 * @param parsed - Parsed rule object
 * @param key - Option key to retrieve
 * @returns Option value or undefined if not found
 */
function getOption(parsed, key) {
    return parsed.options.get(key.toLowerCase());
}
/**
 * Set specific option in parsed rule
 * @param parsed - Parsed rule object
 * @param key - Option key to set
 * @param value - Option value to set
 */
function setOption(parsed, key, value) {
    parsed.options.set(key.toLowerCase(), value);
    // Update convenience fields if applicable
    if (key.toLowerCase() === 'msg') {
        parsed.message = Array.isArray(value) ? value[0] : value;
    }
    else if (key.toLowerCase() === 'sid') {
        parsed.sid = parseInt(Array.isArray(value) ? value[0] : value, 10);
    }
    else if (key.toLowerCase() === 'rev') {
        parsed.rev = parseInt(Array.isArray(value) ? value[0] : value, 10);
    }
    else if (key.toLowerCase() === 'classtype') {
        parsed.classtype = Array.isArray(value) ? value[0] : value;
    }
}
/**
 * Validate rule format (basic checks)
 * @param ruleText - Rule text to validate
 * @returns true if rule appears valid
 */
function isValidSnortRule(ruleText) {
    try {
        parseSnortRule(ruleText);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Extract references (CVE, URLs, etc.) from rule options
 * @param parsed - Parsed rule object
 * @returns Array of reference strings
 */
function extractReferences(parsed) {
    const refs = parsed.options.get('reference');
    if (!refs) {
        return [];
    }
    const refArray = Array.isArray(refs) ? refs : [refs];
    return refArray.map(parseReference);
}
/**
 * Parse reference value (e.g., "cve,2021-12345" → "CVE-2021-12345")
 * @param ref - Reference string to parse
 * @returns Normalized reference string
 */
function parseReference(ref) {
    const parts = ref.split(',');
    if (parts.length < 2) {
        return ref;
    }
    const type = parts[0].toLowerCase().trim();
    const value = parts.slice(1).join(',').trim();
    switch (type) {
        case 'cve':
            // Normalize CVE format
            if (value.toUpperCase().startsWith('CVE-')) {
                return value.toUpperCase();
            }
            return `CVE-${value}`;
        case 'url':
            return value;
        case 'md5':
            return `MD5:${value}`;
        case 'bugtraq':
            return `BugTraq-${value}`;
        case 'nessus':
            return `Nessus-${value}`;
        default:
            return `${type}:${value}`;
    }
}
