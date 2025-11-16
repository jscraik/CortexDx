# Security

This directory contains security scanning, validation, and compliance tools for MCP servers and CortexDx itself.

## Components

### Vulnerability Scanning

#### `dependency-scanner.ts`
Scans npm/pnpm dependencies for known vulnerabilities using multiple data sources.

**Features:**
- npm audit integration
- OSV database checking
- Severity classification
- Fix recommendations

**Usage:**
```typescript
import { scanDependencies } from './dependency-scanner.js';

const results = await scanDependencies({
  projectRoot: process.cwd(),
  includeDevDependencies: false
});
```

#### `cve-scanner.ts`
Direct CVE vulnerability scanning using NVD and OSV databases.

**Features:**
- CVE database queries
- Version range matching
- CVSS score calculation
- Exploit availability detection

### Secret Detection

#### `gitleaks-integration.ts`
Detects secrets and sensitive data in code using Gitleaks.

**Features:**
- Hardcoded credentials detection
- API key scanning
- Private key detection
- Custom pattern matching

**Configuration:**
```bash
# Optional: Path to gitleaks binary
GITLEAKS_BIN=/usr/local/bin/gitleaks
```

### SBOM Generation

#### `flict-integration.ts`
Software Bill of Materials (SBOM) generation and license compliance.

**Features:**
- CycloneDX SBOM format
- License identification
- Dependency tree analysis
- Compliance reporting

### Security Testing

#### `zap-integration.ts`
OWASP ZAP (Zed Attack Proxy) integration for web security testing.

**Features:**
- Active scanning
- Passive scanning
- Spider/crawler
- Report generation

**Configuration:**
```bash
CORTEXDX_ENABLE_ZAP=true
ZAP_API_URL=http://localhost:8080
```

### Dependency Tracking

#### `dependency-track-integration.ts`
Integration with OWASP Dependency-Track for vulnerability management.

**Features:**
- SBOM upload
- Vulnerability tracking
- Policy enforcement
- Metrics and trends

**Configuration:**
```bash
CORTEXDX_DT_API_URL=https://dependencytrack.example.com
CORTEXDX_DT_API_KEY=your-api-key
CORTEXDX_DT_PROJECT=your-project-uuid
CORTEXDX_DT_PROJECT_VERSION=1.0.0
```

### Compliance & Standards

#### `audit-compliance.ts`
Compliance checking against security frameworks.

**Supported Standards:**
- SOC 2
- ISO 27001
- PCI DSS
- HIPAA

#### `asvs-compliance.ts`
OWASP Application Security Verification Standard (ASVS) compliance checking.

**Features:**
- Level 1/2/3 verification
- Control mapping
- Gap analysis
- Remediation guidance

#### `control-mappings.ts`
Maps security controls across different frameworks.

**Frameworks:**
- NIST 800-53
- CIS Controls
- OWASP Top 10
- SANS Top 25

### Threat Modeling

#### `atlas-threat-detector.ts`
ML-based threat detection using MITRE ATLAS framework.

**Features:**
- ML-specific threat patterns
- Attack technique detection
- Adversarial ML analysis
- Mitigation recommendations

### Secure Execution

#### `secure-execution.ts`
Provides sandboxed execution environment for untrusted code.

**Features:**
- Worker thread isolation
- Resource limiting
- API whitelisting
- Timeout enforcement

#### `command-runner.ts`
Safe command execution with input validation.

**Features:**
- Command injection prevention
- Argument sanitization
- Path traversal protection
- Output sanitization

### Monitoring & Validation

#### `security-monitoring.ts`
Real-time security event monitoring and alerting.

**Features:**
- Anomaly detection
- Rate limiting violations
- Authentication failures
- Security policy breaches

#### `security-validator.ts`
Validates security configurations and policies.

**Features:**
- Configuration validation
- Policy compliance checking
- Security best practices
- Misconfiguration detection

## Usage Examples

### Complete Security Audit

```typescript
import { runSecurityAudit } from './audit-compliance.js';
import { scanDependencies } from './dependency-scanner.ts';
import { detectSecrets } from './gitleaks-integration.js';

async function performSecurityAudit() {
  // Dependency vulnerabilities
  const depScan = await scanDependencies({
    projectRoot: process.cwd()
  });

  // Secret detection
  const secrets = await detectSecrets({
    path: process.cwd(),
    recursive: true
  });

  // Compliance check
  const compliance = await runSecurityAudit({
    frameworks: ['soc2', 'iso27001'],
    projectRoot: process.cwd()
  });

  return {
    vulnerabilities: depScan.findings,
    secrets: secrets.leaks,
    compliance: compliance.gaps
  };
}
```

### Generate SBOM

```typescript
import { generateSBOM } from './flict-integration.js';
import { uploadSBOM } from './dependency-track-integration.js';

// Generate SBOM
const sbom = await generateSBOM({
  projectRoot: process.cwd(),
  format: 'cyclonedx',
  includeDevDependencies: false
});

// Upload to Dependency-Track
await uploadSBOM({
  sbom,
  projectId: process.env.CORTEXDX_DT_PROJECT,
  projectVersion: '1.0.0'
});
```

### Web Security Scan

```typescript
import { runZapScan } from './zap-integration.js';

const results = await runZapScan({
  target: 'http://localhost:5001',
  scanType: 'active',
  context: 'CortexDx API',
  maxDuration: 600000 // 10 minutes
});

console.log(`Found ${results.alerts.length} security issues`);
```

## Security Best Practices

### 1. Dependency Management
- Run `pnpm audit` regularly
- Keep dependencies up to date
- Review dependency licenses
- Use lockfiles (`pnpm-lock.yaml`)

### 2. Secret Management
- Never commit secrets to git
- Use environment variables
- Rotate credentials regularly
- Use secret management tools (1Password, HashiCorp Vault)

### 3. Input Validation
- Validate all user inputs
- Sanitize outputs
- Use parameterized queries
- Implement rate limiting

### 4. Authentication & Authorization
- Use strong authentication (OAuth, OIDC)
- Implement RBAC
- Enforce least privilege
- Log authentication events

### 5. Secure Communication
- Use HTTPS in production
- Validate TLS certificates
- Implement CORS properly
- Use secure headers

## Testing

```bash
# Security scanner tests
pnpm test tests/enhanced-security-scanner.spec.ts
pnpm test tests/plugin-security.spec.ts

# Audit and compliance
pnpm test tests/security-audit.spec.ts
pnpm test tests/security-control-mappings.spec.ts

# Dependency scanning
pnpm test tests/dependency-scanner.spec.ts
```

## Configuration

```bash
# Security Scanning
CORTEXDX_ENFORCE_SECURITY=true

# ZAP Integration
CORTEXDX_ENABLE_ZAP=true
ZAP_API_URL=http://localhost:8080

# Dependency Track
CORTEXDX_DT_API_URL=https://dependencytrack.example.com
CORTEXDX_DT_API_KEY=your-api-key
CORTEXDX_DT_PROJECT=project-uuid

# Gitleaks
SEMGREP_BIN=/usr/local/bin/semgrep
```

## Related

- [Security Architecture](../../../docs/ARCHITECTURE.md#security-architecture)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP ZAP](https://www.zaproxy.org/)
- [Dependency-Track](https://dependencytrack.org/)
- [Gitleaks](https://github.com/gitleaks/gitleaks)
