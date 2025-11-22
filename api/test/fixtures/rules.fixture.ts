/**
 * Test fixtures with real Snort rules
 */

export const EXAMPLE_RULES = {
  simple: `alert tcp $HOME_NET any -> $EXTERNAL_NET any (msg:"Simple TCP Alert"; sid:1000001; rev:1;)`,

  withClasstype: `alert tcp $HOME_NET any -> $EXTERNAL_NET [21,23] (msg:"FTP/Telnet Connection"; classtype:attempted-user; sid:1000002; rev:1;)`,

  withContent: `alert tcp $HOME_NET any -> $EXTERNAL_NET [21,23] (msg:"FTP/Telnet Connection"; content:"USER "; flow:to_server,established; sid:1000002; rev:2; classtype:attempted-user;)`,

  withRegex: `alert tcp any any -> any 443 (msg:"Possible Malware C2 Communication"; content:"POST"; http_method; content:"/api/"; http_uri; pcre:"/\\/api\\/[a-z0-9]{32}/i"; sid:1000003; rev:1; classtype:trojan-activity; reference:url,https://example.com;)`,

  withMultipleReferences: `alert tcp $EXTERNAL_NET any -> $HOME_NET any (msg:"CVE-2021-44228 Exploitation Attempt"; content:"jndi:"; nocase; sid:1000004; rev:2; classtype:attempted-admin; reference:cve,2021-44228; reference:url,https://nvd.nist.gov/vuln/detail/CVE-2021-44228;)`,

  log4jExploit: `alert tcp $EXTERNAL_NET any -> $HOME_NET any (msg:"ET EXPLOIT Apache Log4j RCE Attempt (http ldap)"; flow:established,to_server; content:"\${jndi:ldap://"; fast_pattern; nocase; content:"\${"; content:"}"; within:513; sid:2034647; rev:3; metadata:affected_product Any, attack_target Server, deployment Perimeter, signature_severity Major, created_at 2021_12_10, performance_impact Low, updated_at 2021_12_15; classtype:attempted-admin; reference:cve,2021-44228; reference:url,www.lunasec.io/docs/blog/log4j-zero-day/;)`,

  emergingThreats: `alert tcp $HOME_NET any -> $EXTERNAL_NET any (msg:"ET MALWARE Possible Heodo Variant CnC Beacon"; flow:established,to_server; content:"POST"; http_method; content:"/index.php"; http_uri; content:"id="; http_client_body; pcre:"/id=\\d{1,20}(&|$)/i"; sid:2028506; rev:3; metadata:policy balanced-ips drop, policy security-ips alert; classtype:trojan-activity; reference:md5,1234567890abcdef;)`,

  sqlInjection: `alert tcp $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (msg:"SQL Injection Attempt"; flow:to_server,established; content:"UNION"; nocase; content:"SELECT"; nocase; distance:0; sid:2000001; rev:1; classtype:web-application-attack;)`,

  portScan: `alert tcp $EXTERNAL_NET any -> $HOME_NET any (msg:"Possible Port Scan"; flags:S; threshold:type both, track by_src, count 20, seconds 60; sid:2000002; rev:1; classtype:attempted-recon;)`,

  icmpFlood: `alert icmp $EXTERNAL_NET any -> $HOME_NET any (msg:"ICMP Flood Detected"; threshold:type both, track by_src, count 100, seconds 10; sid:2000003; rev:1; classtype:attempted-dos;)`,

  sshBruteforce: `alert tcp $EXTERNAL_NET any -> $SSH_SERVERS 22 (msg:"Multiple SSH Connection Attempts"; flow:to_server; threshold:type both, track by_src, count 5, seconds 60; sid:2000004; rev:1; classtype:attempted-admin; reference:url,attack.mitre.org/techniques/T1110;)`,

  dnsExfiltration: `alert udp $HOME_NET any -> $EXTERNAL_NET 53 (msg:"Possible DNS Exfiltration"; content:"|01 00 00 01|"; offset:2; depth:4; content:"|00 00 01 00 01|"; distance:0; pcre:"/[a-f0-9]{32,}/i"; sid:2000005; rev:1; classtype:policy-violation;)`,

  bidirectional: `alert tcp any any <> any any (msg:"Bidirectional Traffic Monitor"; sid:2000006; rev:1; classtype:misc-activity;)`,

  withMetadata: `alert http $HOME_NET any -> $EXTERNAL_NET any (msg:"Suspicious User-Agent String"; flow:established,to_server; content:"User-Agent|3a 20|"; http_header; content:"sqlmap"; nocase; http_header; sid:2000007; rev:1; metadata:created_at 2023_01_15, updated_at 2023_01_20; classtype:web-application-attack; reference:url,sqlmap.org;)`,

  noOptions: `alert tcp any any -> any any (nocase; sid:2000008; rev:1;)`,

  complexContent: `alert tcp $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (msg:"Shellshock Attack Attempt"; flow:to_server,established; content:"() {"; http_header; content:":;"; within:100; distance:0; pcre:"/\\(\\)\\s*\\{.*:;.*\\}/smi"; sid:2000009; rev:2; classtype:web-application-attack; reference:cve,2014-6271; reference:bugtraq,70103;)`,
};

/**
 * Test cases for parser edge cases
 */
export const EDGE_CASES = {
  quotesInMessage: `alert tcp any any -> any any (msg:"Test with \\"quotes\\" inside"; sid:3000001; rev:1;)`,

  multipleContent: `alert tcp any any -> any 80 (msg:"Multiple Content Matches"; content:"GET"; content:"POST"; content:"PUT"; sid:3000002; rev:1;)`,

  emptyOptions: `alert tcp any any -> any any (sid:3000003; rev:1;)`,

  spacesInValues: `alert tcp any any -> any any (msg:"Message with    spaces"; sid:3000004; rev:1;)`,

  specialChars: `alert tcp any any -> any any (msg:"Special chars: !@#$%^&*()"; sid:3000005; rev:1;)`,

  longRule: `alert tcp $EXTERNAL_NET any -> $HTTP_SERVERS $HTTP_PORTS (msg:"Very Long Rule With Many Options"; flow:to_server,established; content:"GET"; http_method; content:"/admin"; http_uri; content:"User-Agent|3a 20|"; http_header; content:"Mozilla"; http_header; pcre:"/admin\\/(login|panel|dashboard)/i"; threshold:type limit, track by_src, count 1, seconds 60; sid:3000006; rev:5; metadata:created_at 2023_01_01, updated_at 2023_06_15, severity high; classtype:web-application-attack; reference:cve,2023-12345; reference:url,example.com/advisory; reference:md5,abcdef1234567890;)`,

  ipv4Address: `alert tcp 192.168.1.0/24 any -> 10.0.0.0/8 any (msg:"Specific Networks"; sid:3000007; rev:1;)`,

  portRange: `alert tcp any 1024:65535 -> any [80,443,8080] (msg:"High Ports to HTTP"; sid:3000008; rev:1;)`,

  negation: `alert tcp !$HOME_NET any -> $HOME_NET any (msg:"External to Internal"; sid:3000009; rev:1;)`,
};

/**
 * Invalid rules for testing error handling
 */
export const INVALID_RULES = {
  noParentheses: `alert tcp any any -> any any msg:"Missing parentheses"; sid:4000001; rev:1;`,

  unclosedQuote: `alert tcp any any -> any any (msg:"Unclosed quote; sid:4000002; rev:1;)`,

  noSid: `alert tcp any any -> any any (msg:"Missing SID"; rev:1;)`,

  invalidAction: `invalid tcp any any -> any any (msg:"Invalid Action"; sid:4000003; rev:1;)`,

  invalidProtocol: `alert invalid any any -> any any (msg:"Invalid Protocol"; sid:4000004; rev:1;)`,

  invalidDirection: `alert tcp any any => any any (msg:"Invalid Direction"; sid:4000005; rev:1;)`,

  missingParts: `alert tcp any -> any (msg:"Missing Parts"; sid:4000006; rev:1;)`,

  unbalancedParens: `alert tcp any any -> any any (msg:"Unbalanced"; sid:4000007; rev:1;))`,

  emptyRule: ``,

  whitespaceOnly: `    `,
};

/**
 * Rules with variables for template rendering tests
 */
export const TEMPLATE_RULES = {
  homeNet: `alert tcp $HOME_NET any -> $EXTERNAL_NET any (msg:"Using HOME_NET"; sid:5000001; rev:1;)`,

  httpPorts: `alert tcp any any -> any $HTTP_PORTS (msg:"Using HTTP_PORTS"; sid:5000002; rev:1;)`,

  multipleVars: `alert tcp $HOME_NET any -> $EXTERNAL_NET $HTTP_PORTS (msg:"Multiple Variables"; sid:5000003; rev:1;)`,

  shellcodePorts: `alert tcp $EXTERNAL_NET any -> $HOME_NET $SHELLCODE_PORTS (msg:"Shellcode Detection"; sid:5000004; rev:1;)`,

  customVar: `alert tcp $CUSTOM_NET any -> any any (msg:"Custom Variable"; sid:5000005; rev:1;)`,
};

/**
 * Get all valid rule examples
 */
export function getAllValidRules(): string[] {
  return Object.values(EXAMPLE_RULES);
}

/**
 * Get all invalid rule examples
 */
export function getAllInvalidRules(): string[] {
  return Object.values(INVALID_RULES);
}

/**
 * Get rules by category
 */
export function getRulesByCategory(
  category: 'simple' | 'complex' | 'edge' | 'template' | 'invalid',
): string[] {
  switch (category) {
    case 'simple':
      return [EXAMPLE_RULES.simple, EXAMPLE_RULES.withClasstype];
    case 'complex':
      return [
        EXAMPLE_RULES.log4jExploit,
        EXAMPLE_RULES.emergingThreats,
        EDGE_CASES.longRule,
      ];
    case 'edge':
      return Object.values(EDGE_CASES);
    case 'template':
      return Object.values(TEMPLATE_RULES);
    case 'invalid':
      return Object.values(INVALID_RULES);
    default:
      return [];
  }
}
