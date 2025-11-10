/**
 * Plugin Template Generator
 * Generates boilerplate code for new plugins
 * Requirements: 8.2, 10.1
 */

import type { PluginMetadata } from "./plugin-sdk.js";

export interface TemplateOptions {
    metadata: PluginMetadata;
    includeTests?: boolean;
    includeDocumentation?: boolean;
    language?: "typescript" | "javascript";
}

export interface GeneratedTemplate {
    pluginFile: {
        path: string;
        content: string;
    };
    testFile?: {
        path: string;
        content: string;
    };
    documentationFile?: {
        path: string;
        content: string;
    };
}

export function generatePluginTemplate(
    options: TemplateOptions,
): GeneratedTemplate {
    const { metadata, includeTests, includeDocumentation, language } = options;
    const isTypeScript = language !== "javascript";
    const ext = isTypeScript ? "ts" : "js";

    const pluginContent = generatePluginCode(metadata, isTypeScript);
    const testContent = includeTests
        ? generateTestCode(metadata, isTypeScript)
        : undefined;
    const docContent = includeDocumentation
        ? generateDocumentation(metadata)
        : undefined;

    return {
        pluginFile: {
            path: `src/plugins/${metadata.id}.${ext}`,
            content: pluginContent,
        },
        testFile: testContent
            ? {
                path: `tests/${metadata.id}.spec.${ext}`,
                content: testContent,
            }
            : undefined,
        documentationFile: docContent
            ? {
                path: `docs/${metadata.id}.md`,
                content: docContent,
            }
            : undefined,
    };
}

function generatePluginCode(
    metadata: PluginMetadata,
    isTypeScript: boolean,
): string {
    const typeAnnotations = isTypeScript
        ? `: ${metadata.category === "development" ? "DevelopmentPlugin" : "DiagnosticPlugin"}`
        : "";
    const typeImports = isTypeScript
        ? `import type {
  ${metadata.category === "development" ? "DevelopmentContext,\n  DevelopmentPlugin" : "DiagnosticContext,\n  DiagnosticPlugin"},
  Finding,
} from "../types.js";`
        : "";

    return `/**
 * ${metadata.title}
 * ${metadata.description}
 * 
 * @version ${metadata.version}
 * @author ${metadata.author}
 * @category ${metadata.category}
 */

${typeImports}

export const ${toPascalCase(metadata.id)}Plugin${typeAnnotations} = {
  id: "${metadata.id}",
  title: "${metadata.title}",
  ${metadata.category !== "diagnostic" ? `category: "${metadata.category}",\n  ` : ""}${metadata.order ? `order: ${metadata.order},\n  ` : ""}${metadata.requiresLlm ? "requiresLlm: true,\n  " : ""}${metadata.supportedLanguages ? `supportedLanguages: ${JSON.stringify(metadata.supportedLanguages)},\n  ` : ""}
  async run(ctx${isTypeScript ? `: ${metadata.category === "development" ? "DevelopmentContext" : "DiagnosticContext"}` : ""})${isTypeScript ? ": Promise<Finding[]>" : ""} {
    const findings${isTypeScript ? ": Finding[]" : ""} = [];

    try {
      // TODO: Implement your plugin logic here
      
      // Example: Add a finding
      findings.push({
        id: "${metadata.id}.example",
        area: "${metadata.category}",
        severity: "info",
        title: "Example finding from ${metadata.title}",
        description: "This is a placeholder finding. Replace with actual implementation.",
        evidence: [{ type: "log", ref: "${metadata.id}" }],
        tags: ${JSON.stringify(metadata.tags || [])},
      });

    } catch (error) {
      // Handle errors gracefully
      findings.push({
        id: "${metadata.id}.error",
        area: "${metadata.category}",
        severity: "minor",
        title: "Plugin execution error",
        description: \`Error during ${metadata.title} execution: \${(error${isTypeScript ? " as Error" : ""}).message}\`,
        evidence: [{ type: "log", ref: "${metadata.id}-error" }],
      });
    }

    return findings;
  },
};
`;
}

function generateTestCode(
    metadata: PluginMetadata,
    isTypeScript: boolean,
): string {
    const typeImports = isTypeScript
        ? `import type { ${metadata.category === "development" ? "DevelopmentContext" : "DiagnosticContext"} } from "../src/types.js";`
        : "";

    return `/**
 * Tests for ${metadata.title}
 */

import { describe, it, expect } from "vitest";
import { ${toPascalCase(metadata.id)}Plugin } from "../src/plugins/${metadata.id}.js";
${typeImports}

describe("${metadata.title}", () => {
  it("should have correct metadata", () => {
    expect(${toPascalCase(metadata.id)}Plugin.id).toBe("${metadata.id}");
    expect(${toPascalCase(metadata.id)}Plugin.title).toBe("${metadata.title}");
  });

  it("should execute without errors", async () => {
    const mockContext${isTypeScript ? `: ${metadata.category === "development" ? "DevelopmentContext" : "DiagnosticContext"}` : ""} = {
      endpoint: "http://localhost:3000",
      headers: {},
      logger: (...args${isTypeScript ? ": unknown[]" : ""}) => {},
      request: async (input${isTypeScript ? ": RequestInfo" : ""}, init${isTypeScript ? "?: RequestInit" : ""}) => ({}),
      jsonrpc: async (method${isTypeScript ? ": string" : ""}, params${isTypeScript ? "?: unknown" : ""}) => ({}),
      sseProbe: async (url${isTypeScript ? ": string" : ""}, opts${isTypeScript ? "?: unknown" : ""}) => ({ ok: true }),
      evidence: (ev${isTypeScript ? ": any" : ""}) => {},
      deterministic: false,
    }${isTypeScript ? " as any" : ""};

    const findings = await ${toPascalCase(metadata.id)}Plugin.run(mockContext);
    
    expect(Array.isArray(findings)).toBe(true);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("should return valid findings", async () => {
    const mockContext${isTypeScript ? `: ${metadata.category === "development" ? "DevelopmentContext" : "DiagnosticContext"}` : ""} = {
      endpoint: "http://localhost:3000",
      headers: {},
      logger: (...args${isTypeScript ? ": unknown[]" : ""}) => {},
      request: async (input${isTypeScript ? ": RequestInfo" : ""}, init${isTypeScript ? "?: RequestInit" : ""}) => ({}),
      jsonrpc: async (method${isTypeScript ? ": string" : ""}, params${isTypeScript ? "?: unknown" : ""}) => ({}),
      sseProbe: async (url${isTypeScript ? ": string" : ""}, opts${isTypeScript ? "?: unknown" : ""}) => ({ ok: true }),
      evidence: (ev${isTypeScript ? ": any" : ""}) => {},
      deterministic: false,
    }${isTypeScript ? " as any" : ""};

    const findings = await ${toPascalCase(metadata.id)}Plugin.run(mockContext);
    
    for (const finding of findings) {
      expect(finding).toHaveProperty("id");
      expect(finding).toHaveProperty("area");
      expect(finding).toHaveProperty("severity");
      expect(finding).toHaveProperty("title");
      expect(finding).toHaveProperty("description");
      expect(finding).toHaveProperty("evidence");
      expect(Array.isArray(finding.evidence)).toBe(true);
      expect(finding.evidence.length).toBeGreaterThan(0);
    }
  });

  // TODO: Add more specific tests for your plugin functionality
});
`;
}

function generateDocumentation(metadata: PluginMetadata): string {
    return `# ${metadata.title}

${metadata.description}

## Metadata

- **ID**: \`${metadata.id}\`
- **Version**: ${metadata.version}
- **Author**: ${metadata.author}
- **Category**: ${metadata.category}
${metadata.requiresLlm ? "- **Requires LLM**: Yes\n" : ""}${metadata.supportedLanguages ? `- **Supported Languages**: ${metadata.supportedLanguages.join(", ")}\n` : ""}${metadata.tags ? `- **Tags**: ${metadata.tags.join(", ")}\n` : ""}

## Usage

\`\`\`typescript
import { ${toPascalCase(metadata.id)}Plugin } from "./plugins/${metadata.id}.js";

// The plugin is automatically registered and will run during diagnostics
\`\`\`

## Configuration

TODO: Document any configuration options for this plugin.

## Findings

This plugin can produce the following types of findings:

- TODO: Document the findings this plugin generates

## Examples

TODO: Add examples of how this plugin works in practice.

## Development

### Running Tests

\`\`\`bash
pnpm test tests/${metadata.id}.spec.ts
\`\`\`

### Building

\`\`\`bash
pnpm build
\`\`\`

## License

TODO: Add license information
`;
}

function toPascalCase(str: string): string {
    return str
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

export interface PluginScaffolder {
    scaffold: (options: TemplateOptions) => Promise<void>;
    listTemplates: () => string[];
    getTemplate: (name: string) => TemplateOptions | null;
}

export function createPluginScaffolder(): PluginScaffolder {
    const templates = new Map<string, TemplateOptions>();

    // Register built-in templates
    templates.set("diagnostic-basic", {
        metadata: {
            id: "my-diagnostic",
            title: "My Diagnostic Plugin",
            description: "A basic diagnostic plugin template",
            version: "1.0.0",
            author: "Your Name",
            category: "diagnostic",
        },
        includeTests: true,
        includeDocumentation: true,
        language: "typescript",
    });

    templates.set("development-basic", {
        metadata: {
            id: "my-development",
            title: "My Development Plugin",
            description: "A basic development plugin template",
            version: "1.0.0",
            author: "Your Name",
            category: "development",
            requiresLlm: true,
        },
        includeTests: true,
        includeDocumentation: true,
        language: "typescript",
    });

    return {
        async scaffold(options: TemplateOptions): Promise<void> {
            const template = generatePluginTemplate(options);

            // In a real implementation, this would write files to disk
            console.log("Generated plugin template:");
            console.log(`- ${template.pluginFile.path}`);
            if (template.testFile) {
                console.log(`- ${template.testFile.path}`);
            }
            if (template.documentationFile) {
                console.log(`- ${template.documentationFile.path}`);
            }
        },

        listTemplates(): string[] {
            return Array.from(templates.keys());
        },

        getTemplate(name: string): TemplateOptions | null {
            return templates.get(name) || null;
        },
    };
}
