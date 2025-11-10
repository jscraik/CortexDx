# Dependency & Supply-Chain Scanner Plugin

## Overview

The Dependency & Supply-Chain Scanner Plugin provides comprehensive dependency analysis, Software Bill of Materials (SBOM) generation, vulnerability scanning, and license compatibility checking for MCP implementations.

## Features

### SBOM Generation (Requirement 21.1)

- Analyzes package manifests (package.json, requirements.txt, pom.xml)
- Generates CycloneDX-format SBOMs
- Supports SPDX format
- Includes component metadata, licenses, and hashes

### OWASP Dependency Track Integration (Requirement 21.2)

- Uploads SBOMs to Dependency Track for continuous monitoring
- Queries vulnerability data from Dependency Track
- Provides real-time vulnerability alerts
- Tracks project metrics and trends

### CVE Scanning (Requirement 21.3)

- Integrates with CVE databases (NVD, OSV)
- Matches vulnerabilities against dependencies
- Provides severity ratings and CVSS scores
- Generates remediation recommendations

### License Compatibility Checking (Requirement 21.4)

- Uses flict for license compatibility analysis
- Detects license conflicts
- Suggests outbound licenses
- Ensures legal compliance

### Dependency Recommendations (Requirement 21.5)

- Recommends security updates
- Analyzes security impact of updates
- Detects breaking changes
- Generates dependency update reports (<90s)

## Usage

The plugin runs automatically as part of the diagnostic suite:

```bash
npx cortexdx diagnose http://localhost:3000
```

Or run specifically:

```bash
npx cortexdx diagnose http://localhost:3000 --suite dependency-scanner
```

## Configuration

Configure the plugin through environment variables or configuration files:

```json
{
  "dependencyScanner": {
    "sbomFormat": "cyclonedx",
    "dependencyTrack": {
      "enabled": true,
      "apiUrl": "http://localhost:8081",
      "apiKey": "YOUR_API_KEY"
    },
    "cveDatabase": "nvd",
    "licenseChecker": "flict",
    "updateRecommendations": true
  }
}
```

## Output

The plugin generates findings in the following categories:

- **SBOM Generation**: Component inventory and metadata
- **Vulnerabilities**: CVEs with severity ratings and remediation
- **License Issues**: Compatibility conflicts and compliance risks
- **Update Recommendations**: Security updates and breaking changes

## Performance

- Target execution time: <90 seconds (Requirement 21.5)
- Parallel scanning for improved performance
- Caching for repeated scans

## Integration

The plugin integrates with:

- **CycloneDX**: SBOM generation library
- **OWASP Dependency Track**: Vulnerability monitoring platform
- **NVD/OSV**: CVE databases
- **flict**: License compatibility checker

## Requirements

- Node.js 20.11.1+
- CycloneDX libraries
- Optional: OWASP Dependency Track instance
- Optional: flict binary

## License

Apache 2.0
