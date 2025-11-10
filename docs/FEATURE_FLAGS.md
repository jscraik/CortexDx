# Feature Flags

The Cortex Dx CLI honours a small set of environment flags to enable integrations that require
explicit consent or external resources. All flags are optional and default to the safest behaviour.

## Dependency manifest ingestion

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `CORTEXDX_MANIFESTS_JSON` | JSON string | _unset_ | Supplies dependency manifests to the dependency scanner when the MCP target cannot expose its filesystem. The value must be a JSON array of objects shaped as `{ "name": "package.json", "encoding": "utf-8", "content": "{...}" }`. Accepted encodings are `utf-8` and `base64`. |
| `INSULA_MANIFESTS_JSON` | JSON string | _unset_ | **Deprecated.** Legacy alias recognised for backward compatibility. |

Usage example:

```bash
export CORTEXDX_MANIFESTS_JSON='[
  {"name":"package.json","encoding":"utf-8","content":"{\"name\":\"demo\"}"},
  {"name":"requirements.txt","encoding":"base64","content":"cmVxdWVzdHM9Mi4zLjE=\n"}
]'
```

When provided, the dependency scanner will ingest the manifests without touching the remote file system and generate SBOM/CVE findings accordingly.

> ℹ️ **Backward compatibility:** Cortex Dx still recognises the legacy `INSULA_*` variables but emits a warning. Update automations to the `CORTEXDX_*` equivalents as part of the rebrand.

## OWASP ZAP integration

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `CORTEXDX_ENABLE_ZAP` | `"1"`/`"0"` | `0` | Enables live calls to a locally running OWASP ZAP daemon. Leave unset to keep ZAP disabled. |
| `INSULA_ENABLE_ZAP` | `"1"`/`"0"` | `0` | **Deprecated.** Legacy alias recognised for backward compatibility. |
| `ZAP_API_URL` | URL | `http://localhost:8080` | Override the default ZAP API endpoint. Alternatively use the programmatic `apiUrl` config. |
| `ZAP_API_KEY` | string | _unset_ | Injects the API key for secured ZAP instances. |

Once enabled, the security scanner will query ZAP for alerts (`/JSON/core/view/alerts/`) and surface
normalized findings. Keep the flag disabled in deterministic CI runs or when ZAP is unavailable.

> ⚠️ Remember to scrub manifests and ZAP logs of secrets before sharing them outside your environment.
