# Cloud Storage Integration for Diagnostic Reports

CortexDx supports cloud storage for diagnostic reports with presigned URL access, provenance tracking, and zero-egress-cost deployment via Cloudflare R2.

## Features

- ✅ **Multi-cloud support**: Cloudflare R2, AWS S3, Google Cloud Storage
- ✅ **Presigned URLs**: Time-limited secure access (15min default)
- ✅ **Zero egress fees**: Recommended Cloudflare R2 deployment
- ✅ **Provenance tracking**: Git SHA, version, SBOM hashes
- ✅ **Content verification**: SHA-256 hashes for all artifacts
- ✅ **Audit logging**: Hash-chained append-only logs
- ✅ **MCP tools**: `report.get_latest` and `report.get_by_run`

## Quick Start

### 1. Create Cloudflare R2 Bucket

```bash
# Via Cloudflare Dashboard:
# 1. Log in to Cloudflare Dashboard
# 2. Navigate to R2 Object Storage
# 3. Click "Create bucket"
# 4. Name: cortexdx-reports
# 5. Location: Automatic (global)

# Or via Wrangler CLI:
npx wrangler r2 bucket create cortexdx-reports
```

### 2. Generate API Tokens

1. Go to **R2** → **Manage R2 API Tokens**
2. Click **Create API token**
3. Permissions: **Object Read & Write** for `cortexdx-reports` bucket
4. Copy **Access Key ID** and **Secret Access Key**

### 3. Configure Environment

Create `.env` file:

```bash
# Cloud provider
CORTEXDX_CLOUD_PROVIDER=r2

# Cloudflare R2 configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=cortexdx-reports
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key

# Optional: Presigned URL TTL (default: 900 = 15 minutes)
CORTEXDX_REPORT_TTL_SECONDS=900
```

### 4. Use in Code

```typescript
import { ReportManager } from "@brainwav/cortexdx/storage";
import { createCloudStorageFromEnv } from "@brainwav/cortexdx/adapters";

// Initialize report manager
const manager = new ReportManager();
await manager.initialize();

// Enable cloud storage (optional)
const cloudStorage = createCloudStorageFromEnv();
if (cloudStorage) {
  manager.enableCloudStorage(cloudStorage);
}

// Store a report (uploads to both local and cloud)
const report = {
  sessionId: "run-123",
  diagnosticType: "diagnostic",
  endpoint: "http://localhost:3000",
  inspectedAt: new Date().toISOString(),
  durationMs: 1500,
  findings: [],
};

const metadata = await manager.storeReport(report);

// Access cloud URLs
console.log("HTML report:", metadata.cloudUrls?.html);
console.log("JSON report:", metadata.cloudUrls?.json);
console.log("SHA-256:", metadata.cloudUrls?.htmlSha256);
```

## MCP Tools

### `report.get_latest`

Get latest diagnostic reports with presigned URLs.

**Parameters:**
- `kind` (optional): `"diagnostic"` | `"metadata"` | `"inspector"` (default: `"diagnostic"`)
- `limit` (optional): Max reports to return (1-10, default: 5)
- `days` (optional): Days to look back (1-90, default: 7)

**Example:**

```typescript
import { handleGetLatest } from "@brainwav/cortexdx/tools";

const result = await handleGetLatest({
  kind: "diagnostic",
  limit: 5,
  days: 7,
});

console.log(result);
// {
//   ok: true,
//   items: [
//     {
//       runId: "abc123",
//       createdAt: "2025-11-15T12:00:00Z",
//       expiresAt: "2025-11-15T12:15:00Z",
//       url: "https://your-account.r2.cloudflarestorage.com/...",
//       altUrl: "https://your-account.r2.cloudflarestorage.com/...json",
//       bytes: 12345,
//       sha256: "a1b2c3...",
//       meta: {
//         app: "CortexDx",
//         version: "1.0.0",
//         git: { sha: "9f1e1a2", branch: "main" },
//         tags: ["test"]
//       }
//     }
//   ]
// }
```

### `report.get_by_run`

Get specific report by run ID (session ID).

**Parameters:**
- `runId` (required): Session ID of the report
- `includeProvenance` (optional): Include full provenance (default: true)

**Example:**

```typescript
import { handleGetByRun } from "@brainwav/cortexdx/tools";

const result = await handleGetByRun({
  runId: "unique-session-123",
  includeProvenance: true,
});

console.log(result);
// {
//   ok: true,
//   item: {
//     runId: "unique-session-123",
//     createdAt: "2025-11-15T12:00:00Z",
//     expiresAt: "2025-11-15T12:15:00Z",
//     url: "https://...",
//     altUrl: "https://...json",
//     bytes: 12345,
//     sha256: "a1b2c3...",
//     meta: { ... }
//   }
// }
```

## Cloud Providers

### Cloudflare R2 (Recommended)

**Why R2?**
- ✅ **Zero egress fees**: Free bandwidth for presigned URL downloads
- ✅ **S3-compatible**: Use existing AWS SDK
- ✅ **Global edge**: Worldwide CDN distribution
- ✅ **Cheaper storage**: ~40% less than S3 ($0.015/GB vs $0.023/GB)

**Configuration:**

```bash
CORTEXDX_CLOUD_PROVIDER=r2
CLOUDFLARE_ACCOUNT_ID=your-account-id
R2_BUCKET_NAME=cortexdx-reports
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
```

**Cost example** (10,000 reports/month, 500KB avg, 50,000 downloads):
- Storage (5GB): $0.08/month
- Egress (25GB): **FREE** (R2) vs $2.25/month (S3)
- **Total: $0.08/month** vs $2.42/month (S3)

### AWS S3

**Configuration:**

```bash
CORTEXDX_CLOUD_PROVIDER=s3
AWS_REGION=us-east-1
CORTEXDX_CLOUD_BUCKET=my-reports
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/...
```

**IAM Policy (Minimal Permissions):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::my-reports/reports/*"
    }
  ]
}
```

**Note:** No `s3:ListBucket` permission prevents bucket enumeration.

### Google Cloud Storage

**Configuration:**

```bash
CORTEXDX_CLOUD_PROVIDER=gcs
CORTEXDX_CLOUD_ENDPOINT=https://storage.googleapis.com
CORTEXDX_CLOUD_BUCKET=my-reports
# Use HMAC keys for S3-compatible access
AWS_ACCESS_KEY_ID=GOOG1...
AWS_SECRET_ACCESS_KEY=...
```

## Security

### Presigned URLs

- **Default TTL**: 15 minutes
- **Configurable**: Set `CORTEXDX_REPORT_TTL_SECONDS`
- **Read-only**: URLs grant GET access only
- **Time-limited**: Automatically expire

### IAM/Permissions

**Recommended permissions:**
- ✅ `PutObject`: Upload reports
- ✅ `GetObject`: Generate presigned URLs
- ✅ `HeadObject`: Check object metadata
- ❌ `ListBucket`: **NOT needed** (prevents enumeration)
- ❌ `DeleteObject`: **NOT needed** (prevents deletion)

### Content Verification

All artifacts include SHA-256 hashes:

```json
{
  "cloudUrls": {
    "html": "https://...",
    "htmlSha256": "a1b2c3d4e5f6...",
    "json": "https://...",
    "jsonSha256": "f6e5d4c3b2a1...",
    "sbom": "https://...",
    "sbomSha256": "..."
  }
}
```

Verify downloads:

```bash
# Download report
curl -o report.html "https://presigned-url..."

# Verify hash
echo "expected-sha256  report.html" | shasum -a 256 -c
```

### Audit Logging

Hash-chained append-only logs track all uploads:

```
0000...000 | GENESIS | ts=2025-11-15T12:00:00Z
a1b2c3...  | UPLOAD  | report.html sha256=... bytes=12345
f6e5d4...  | UPLOAD  | report.json sha256=... bytes=6789
9a8b7c...  | UPLOAD  | sbom.cdx.json sha256=... bytes=4567
c3d4e5...  | CLOSE   | all artifacts sealed
```

Each entry includes hash of previous entry → tamper-evident chain.

## Provenance Tracking

Every report includes full provenance metadata:

```json
{
  "meta": {
    "app": "CortexDx",
    "version": "1.0.0",
    "git": {
      "sha": "9f1e1a2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
      "branch": "main"
    },
    "sbom": {
      "cyclonedxSha256": "..."
    },
    "model": {
      "name": "mlx:llama3.2:instruct",
      "promptDigest": "sha256-..."
    },
    "tags": ["production", "release-v1.0"]
  }
}
```

## Storage Structure

```
your-bucket/
├── reports/
│   ├── run-abc123/
│   │   ├── report.html          # Human-readable report
│   │   ├── report.json          # Machine-readable data
│   │   ├── sbom.cdx.json        # CycloneDX SBOM
│   │   ├── meta.json            # Provenance metadata
│   │   ├── chain.log            # Hash-chained audit log
│   │   └── evidence/            # (Future: traces, logs, diffs)
│   ├── run-def456/
│   │   └── ...
│   └── run-ghi789/
│       └── ...
```

## Testing

Run cloud storage tests:

```bash
# Unit tests (mocked S3)
pnpm test tests/cloud-storage.spec.ts

# MCP tool tests
pnpm test tests/report-mcp-tools.spec.ts

# All report tests
pnpm test:reports
```

**Integration test with real R2:**

```bash
# Set environment variables
export CORTEXDX_CLOUD_PROVIDER=r2
export CLOUDFLARE_ACCOUNT_ID=your-account
export R2_BUCKET_NAME=cortexdx-reports-test
export R2_ACCESS_KEY_ID=your-key
export R2_SECRET_ACCESS_KEY=your-secret

# Run integration tests
CORTEXDX_RUN_INTEGRATION=1 pnpm test:integration
```

## Troubleshooting

### "accountId required for Cloudflare R2"

**Cause**: Missing `CLOUDFLARE_ACCOUNT_ID` environment variable.

**Fix**:
```bash
export CLOUDFLARE_ACCOUNT_ID=your-account-id
# Find it in: Cloudflare Dashboard → R2 → Overview
```

### "Cloud storage upload failed"

**Cause**: Invalid credentials or network error.

**Fix**:
1. Verify credentials are correct
2. Check bucket name matches
3. Ensure bucket exists and is accessible
4. Check network connectivity

**Debug**:
```typescript
// Enable verbose logging
const cloudStorage = new CloudStorageAdapter(config);
console.log("Provider:", cloudStorage.getProvider());
console.log("Bucket:", cloudStorage.getBucket());
```

### Presigned URLs not working

**Cause**: URL expired or incorrect signature.

**Fix**:
- URLs expire after 15 minutes (default)
- Regenerate URL by calling `report.get_by_run` again
- Check system clock is synchronized (for signature generation)

### Reports not uploading to cloud

**Cause**: Cloud storage not enabled or failed silently.

**Check**:
```typescript
const metadata = await manager.storeReport(report);
console.log("Cloud URLs:", metadata.cloudUrls);
// Should show { html: "https://...", json: "https://..." }
// If undefined, cloud storage is disabled or failed
```

## Cost Optimization

### Cloudflare R2
- **Free tier**: 10GB storage, unlimited egress
- **Paid**: $0.015/GB storage, $0 egress
- **Class A ops** (PUT): $4.50 per million
- **Class B ops** (GET): $0.36 per million

**Tip**: Use R2 public domain to avoid presigned URLs and reduce API calls.

### AWS S3
- **Storage**: $0.023/GB (Standard)
- **Egress**: $0.09/GB
- **Requests**: $0.005 per 1,000 PUT, $0.0004 per 1,000 GET

**Tip**: Use S3 Intelligent-Tiering for infrequently accessed reports.

## Advanced Configuration

### Custom Public Domain (R2)

```bash
# 1. Add custom domain in R2 dashboard
# 2. Add CNAME record to DNS:
#    reports.yourdomain.com → bucket-name.r2.cloudflarestorage.com

# 3. Configure in .env:
R2_PUBLIC_DOMAIN=reports.yourdomain.com

# Now URLs are:
# https://reports.yourdomain.com/reports/run-123/report.html
```

**Benefits**:
- Cleaner URLs (no presigned query params)
- Cloudflare CDN caching at edge
- No API calls for URL generation

### Content-Addressed Storage

Enable deduplication by using content hash as key:

```typescript
const bundleSha256 = createHash("sha256")
  .update(htmlContent + jsonContent + sbom)
  .digest("hex");

const key = `reports/${runId}/bundle-${bundleSha256}.tar.zst`;
// If object exists, skip upload (idempotent)
```

## Roadmap

- [ ] Azure Blob Storage support
- [ ] Multi-region replication
- [ ] Lifecycle policies (auto-delete old reports)
- [ ] Evidence artifacts (traces, logs, code diffs)
- [ ] SBOM vulnerability scanning integration
- [ ] Report analytics dashboard

## References

- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [AWS S3 Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [CycloneDX SBOM Specification](https://cyclonedx.org/)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)

## Support

- **GitHub Issues**: [jscraik/CortexDx/issues](https://github.com/jscraik/CortexDx/issues)
- **Documentation**: [docs.cortexdx.dev](https://docs.cortexdx.dev)
