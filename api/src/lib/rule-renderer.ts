/**
 * Rule Template Rendering - Renders rules with variable substitution
 */

/**
 * Context for template rendering
 */
export interface RuleContext {
  HOME_NET?: string; // Internal network (default: $HOME_NET)
  EXTERNAL_NET?: string; // External network (default: $EXTERNAL_NET)
  HTTP_PORTS?: string; // HTTP ports (default: $HTTP_PORTS)
  SHELLCODE_PORTS?: string; // Common backdoor ports
  [key: string]: string | undefined;
}

/**
 * Render rule template with context variables
 * Replaces all $VARIABLE references with values from context
 * @param ruleTemplate - Rule template with $VARIABLE placeholders
 * @param context - Variables to substitute
 * @returns Rendered rule with variables replaced
 */
export function renderRuleTemplate(
  ruleTemplate: string,
  context: RuleContext = {},
): string {
  let rendered = ruleTemplate;

  // Find all $VARIABLE references in the rule
  const variables = extractVariables(ruleTemplate);

  // Replace each variable with its context value
  for (const varName of variables) {
    const value = context[varName];

    if (value !== undefined) {
      // Replace all occurrences of $VARNAME with the value
      const regex = new RegExp(`\\$${varName}\\b`, 'g');
      rendered = rendered.replace(regex, value);
    }
    // If variable not in context, leave as-is (keep $VAR)
  }

  return rendered;
}

/**
 * Extract variables from rule
 * Finds all $VARIABLE references
 * @param ruleText - Rule text to analyze
 * @returns Array of variable names (without $ prefix)
 */
export function extractVariables(ruleText: string): string[] {
  const variables = new Set<string>();

  // Match $VARIABLE_NAME (letters, numbers, underscores)
  const regex = /\$([A-Z_][A-Z0-9_]*)\b/g;
  let match;

  while ((match = regex.exec(ruleText)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * Get default context for deployment
 * These are standard Snort variables
 * @returns Default rule context with common variables
 */
export function getDefaultContext(): RuleContext {
  return {
    HOME_NET: '$HOME_NET', // Network admin sets this in snort.conf
    EXTERNAL_NET: '!$HOME_NET', // Everything except internal
    HTTP_PORTS: '[80,443,8080,8443]',
    SHELLCODE_PORTS: '[!80,!443,!3128,!8080,!8443]',
    HTTP_SERVERS: '$HOME_NET',
    SMTP_SERVERS: '$HOME_NET',
    SQL_SERVERS: '$HOME_NET',
    DNS_SERVERS: '$HOME_NET',
    TELNET_SERVERS: '$HOME_NET',
    SSH_SERVERS: '$HOME_NET',
    FTP_SERVERS: '$HOME_NET',
    SIP_SERVERS: '$HOME_NET',
    SIP_PORTS: '[5060,5061]',
    FILE_DATA_PORTS: '[$HTTP_PORTS,110,143]',
    AIM_SERVERS:
      '[64.12.24.0/23,64.12.28.0/23,64.12.161.0/24,64.12.163.0/24,64.12.200.0/24,205.188.3.0/24,205.188.5.0/24,205.188.7.0/24,205.188.9.0/24,205.188.153.0/24,205.188.179.0/24,205.188.248.0/24]',
  };
}

/**
 * Validate all variables in rule are available in context
 * @param ruleText - Rule text to validate
 * @param context - Available variables
 * @returns Validation result with missing variables
 */
export function validateContext(
  ruleText: string,
  context: RuleContext,
): { valid: boolean; missing: string[] } {
  const variables = extractVariables(ruleText);
  const missing: string[] = [];

  for (const varName of variables) {
    if (context[varName] === undefined) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Merge contexts, with override taking precedence
 * @param base - Base context
 * @param override - Override context (takes precedence)
 * @returns Merged context
 */
export function mergeContexts(
  base: RuleContext,
  override: RuleContext,
): RuleContext {
  return {
    ...base,
    ...override,
  };
}

/**
 * Create custom context for specific deployment
 * @param homeNetwork - Custom HOME_NET value (e.g., "192.168.1.0/24")
 * @param additional - Additional custom variables
 * @returns Custom rule context
 */
export function createCustomContext(
  homeNetwork?: string,
  additional: RuleContext = {},
): RuleContext {
  const defaultCtx = getDefaultContext();

  if (homeNetwork) {
    defaultCtx.HOME_NET = homeNetwork;
    defaultCtx.EXTERNAL_NET = `!${homeNetwork}`;
  }

  return mergeContexts(defaultCtx, additional);
}
