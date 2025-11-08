/**
 * Field-Level Error Reporting
 * 
 * Provides detailed error reporting with field paths, validation suggestions,
 * and documentation links for MCP protocol violations.
 * 
 * Requirements: 23.4 - Enhance field-level error reporting
 */

import type { FieldViolation } from "./protovalidate.js";

/**
 * Detailed Error with field-level information
 */
export interface DetailedError {
    field: string;
    fieldPath: string;
    violation: FieldViolation;
    suggestion: string;
    documentation: string;
    severity: 'error' | 'warning' | 'info';
    category: ErrorCategory;
}

/**
 * Error categories for classification
 */
export type ErrorCategory =
    | 'protocol-version'
    | 'capabilities'
    | 'tool-definition'
    | 'resource-definition'
    | 'server-info'
    | 'json-rpc'
    | 'handshake'
    | 'authentication'
    | 'general';

const MCP_DOCS_BASE = 'https://modelcontextprotocol.io/docs';
const MCP_SPEC_BASE = 'https://spec.modelcontextprotocol.io';

function generateDetailedErrors(violations: FieldViolation[]): DetailedError[] {
    return violations.map(createDetailedError);
}

function createDetailedError(violation: FieldViolation): DetailedError {
    const category = categorizeError(violation.fieldPath);
    const suggestion = generateSuggestion(violation, category);
    const documentation = getDocumentationLink(category);
    const severity = determineSeverity(violation, category);

    return {
        field: extractFieldName(violation.fieldPath),
        fieldPath: violation.fieldPath,
        violation,
        suggestion,
        documentation,
        severity,
        category,
    };
}

function categorizeError(fieldPath: string): ErrorCategory {
    if (fieldPath.includes('protocolVersion')) {
        return 'protocol-version';
    }
    if (fieldPath.includes('capabilities')) {
        return 'capabilities';
    }
    if (fieldPath.includes('tool')) {
        return 'tool-definition';
    }
    if (fieldPath.includes('resource')) {
        return 'resource-definition';
    }
    if (fieldPath.includes('serverInfo')) {
        return 'server-info';
    }
    if (fieldPath.includes('jsonrpc') || fieldPath.includes('method') || fieldPath.includes('id')) {
        return 'json-rpc';
    }
    if (fieldPath.includes('initialize') || fieldPath.includes('handshake')) {
        return 'handshake';
    }
    if (fieldPath.includes('auth') || fieldPath.includes('token')) {
        return 'authentication';
    }
    return 'general';
}

function generateSuggestion(violation: FieldViolation, category: ErrorCategory): string {
    const suggestions: Record<ErrorCategory | 'general', (v: FieldViolation) => string> = {
        'protocol-version': (v) => {
            if (v.constraintId.includes('matches')) {
                return 'Update the protocolVersion field to use the YYYY-MM-DD format, e.g., "2024-11-05"';
            }
            if (v.constraintId.includes('startsWith')) {
                return 'Ensure you are using the latest 2024 MCP protocol specification';
            }
            return 'Check the MCP specification for the correct protocol version format';
        },

        'capabilities': (v) => {
            if (v.constraintId.includes('has')) {
                return 'Add at least one capability (tools, resources, or prompts) to the capabilities object';
            }
            if (v.constraintId.includes('size')) {
                return 'Ensure the capabilities object contains at least one tool, resource, or prompt definition';
            }
            return 'Review your server capabilities and ensure they are properly declared';
        },

        'tool-definition': (v) => {
            if (v.fieldPath.includes('name')) {
                return 'Provide a descriptive tool name between 1 and 100 characters';
            }
            if (v.fieldPath.includes('inputSchema')) {
                return 'Define a valid JSON Schema object for the tool input schema with a "type": "object" field';
            }
            if (v.fieldPath.includes('description')) {
                return 'Add a clear description (10-1000 characters) explaining what the tool does';
            }
            return 'Review the tool definition structure in the MCP specification';
        },

        'resource-definition': (v) => {
            if (v.fieldPath.includes('uri')) {
                return 'Use a valid URI scheme (file://, http://, or https://) for the resource URI';
            }
            if (v.fieldPath.includes('name')) {
                return 'Provide a resource name between 1 and 200 characters';
            }
            if (v.fieldPath.includes('mimeType')) {
                return 'Specify a valid MIME type (e.g., "text/plain", "application/json")';
            }
            return 'Check the resource definition requirements in the MCP specification';
        },

        'server-info': (v) => {
            if (v.fieldPath.includes('name')) {
                return 'Provide a server name between 3 and 100 characters';
            }
            if (v.fieldPath.includes('version')) {
                return 'Use semantic versioning for the server version (e.g., "1.0.0" or "1.0")';
            }
            return 'Ensure server info contains both name and version fields';
        },

        'json-rpc': (v) => {
            if (v.fieldPath.includes('jsonrpc')) {
                return 'Set the jsonrpc field to "2.0" to comply with JSON-RPC 2.0 specification';
            }
            if (v.fieldPath.includes('method')) {
                return 'Provide a non-empty method name for the JSON-RPC request';
            }
            if (v.fieldPath.includes('id')) {
                return 'Include a request ID for non-notification JSON-RPC requests';
            }
            return 'Review JSON-RPC 2.0 message structure requirements';
        },

        'handshake': () => 'Ensure the initialize request/response follows the MCP handshake protocol',

        'authentication': () => 'Check authentication configuration and ensure proper credentials are provided',

        'general': (v) => `Fix the ${v.fieldPath} field to satisfy the constraint: ${v.expectedConstraint}`,
    };

    const suggestionFn = suggestions[category] || suggestions.general;
    return suggestionFn(violation);
}

function getDocumentationLink(category: ErrorCategory): string {
    const links: Record<ErrorCategory, string> = {
        'protocol-version': `${MCP_SPEC_BASE}/protocol/version`,
        'capabilities': `${MCP_DOCS_BASE}/concepts/capabilities`,
        'tool-definition': `${MCP_DOCS_BASE}/concepts/tools`,
        'resource-definition': `${MCP_DOCS_BASE}/concepts/resources`,
        'server-info': `${MCP_DOCS_BASE}/concepts/server-info`,
        'json-rpc': `${MCP_SPEC_BASE}/protocol/json-rpc`,
        'handshake': `${MCP_DOCS_BASE}/concepts/lifecycle#initialization`,
        'authentication': `${MCP_DOCS_BASE}/concepts/authentication`,
        'general': `${MCP_DOCS_BASE}/specification`,
    };

    return links[category] || links.general;
}

function determineSeverity(
    violation: FieldViolation,
    category: ErrorCategory,
): 'error' | 'warning' | 'info' {
    const criticalCategories: ErrorCategory[] = ['protocol-version', 'json-rpc', 'handshake'];

    if (criticalCategories.includes(category)) {
        return 'error';
    }

    if (
        violation.constraintId.includes('required') ||
        violation.constraintId.includes('must') ||
        violation.constraintId.includes('invalid')
    ) {
        return 'error';
    }

    if (
        violation.constraintId.includes('should') ||
        violation.constraintId.includes('recommended')
    ) {
        return 'warning';
    }

    return 'info';
}

function extractFieldName(fieldPath: string): string {
    const parts = fieldPath.split('.');
    return parts[parts.length - 1];
}

function formatError(error: DetailedError): string {
    const lines: string[] = [];

    const severityPrefix = error.severity.toUpperCase();
    lines.push(`[${severityPrefix}] ${error.fieldPath}`);
    lines.push('');

    lines.push(`Problem: ${error.violation.message}`);
    lines.push('');

    if (error.violation.value !== undefined) {
        const valueStr =
            typeof error.violation.value === 'object'
                ? JSON.stringify(error.violation.value, null, 2)
                : String(error.violation.value);
        lines.push(`Current value: ${valueStr}`);
        lines.push('');
    }

    lines.push(`Expected: ${error.violation.expectedConstraint}`);
    lines.push('');

    lines.push(`Suggestion: ${error.suggestion}`);
    lines.push('');

    lines.push(`Documentation: ${error.documentation}`);

    return lines.join('\n');
}

function formatErrorReport(errors: DetailedError[]): string {
    if (errors.length === 0) {
        return 'No validation errors found.';
    }

    const lines: string[] = [];
    const summary = createValidationSummary(errors);
    lines.push('MCP Protocol Validation Report');
    lines.push('## Summary');
    lines.push(`Total issues: ${summary.totalIssues}`);
    lines.push(`Errors: ${summary.errors}`);
    lines.push(`Warnings: ${summary.warnings}`);
    lines.push(`Info: ${summary.info}`);
    lines.push('');

    if (summary.criticalFields.length > 0) {
        lines.push('Critical Fields:');
        for (const field of summary.criticalFields) {
            lines.push(`- ${field}`);
        }
        lines.push('');
    }

    const errorsByCategory = groupErrorsByCategory(errors);

    for (const [category, categoryErrors] of Object.entries(errorsByCategory)) {
        lines.push(`## ${formatCategoryName(category)}`);
        lines.push('');

        for (const error of categoryErrors) {
            lines.push(formatError(error));
            lines.push('');
            lines.push('-'.repeat(40));
            lines.push('');
        }
    }

    return lines.join('\n');
}

function groupErrorsByCategory(errors: DetailedError[]): Record<string, DetailedError[]> {
    const grouped: Record<string, DetailedError[]> = {};

    for (const error of errors) {
        if (!grouped[error.category]) {
            grouped[error.category] = [];
        }
        grouped[error.category].push(error);
    }

    return grouped;
}

function formatCategoryName(category: string): string {
    return category
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function generateFieldPathError(
    fieldPath: string,
    actualValue: unknown,
    expectedConstraint: string,
    message: string,
): string {
    const lines: string[] = [];

    lines.push(`Field: ${fieldPath}`);
    lines.push(`Message: ${message}`);

    if (actualValue !== undefined) {
        lines.push(`Actual: ${JSON.stringify(actualValue)}`);
    }

    lines.push(`Expected: ${expectedConstraint}`);

    return lines.join('\n');
}

function createValidationSummary(errors: DetailedError[]): ValidationSummary {
    const summary: ValidationSummary = {
        totalIssues: errors.length,
        errors: errors.filter((e) => e.severity === 'error').length,
        warnings: errors.filter((e) => e.severity === 'warning').length,
        info: errors.filter((e) => e.severity === 'info').length,
        categories: {},
        criticalFields: [],
    };

    for (const error of errors) {
        summary.categories[error.category] =
            (summary.categories[error.category] ?? 0) + 1;
    }

    summary.criticalFields = errors
        .filter((e) => e.severity === 'error')
        .map((e) => e.fieldPath);

    return summary;
}

export const FieldErrorReporter = {
    generateDetailedErrors,
    formatError,
    formatErrorReport,
    generateFieldPathError,
    createValidationSummary,
};

/**
 * Validation Summary
 */
export interface ValidationSummary {
    totalIssues: number;
    errors: number;
    warnings: number;
    info: number;
    categories: Record<string, number>;
    criticalFields: string[];
}

function formatErrorsAsJSON(errors: DetailedError[]): string {
    return JSON.stringify(errors, null, 2);
}

function formatErrorsAsMarkdown(errors: DetailedError[]): string {
    if (errors.length === 0) {
        return '# MCP Protocol Validation\n\n✅ No validation errors found.';
    }

    const lines: string[] = [];

    lines.push('# MCP Protocol Validation Report');
    lines.push('');

    const summary = FieldErrorReporter.createValidationSummary(errors);
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Issues**: ${summary.totalIssues}`);
    lines.push(`- **Errors**: ${summary.errors}`);
    lines.push(`- **Warnings**: ${summary.warnings}`);
    lines.push(`- **Info**: ${summary.info}`);
    lines.push('');

    lines.push('## Issues by Category');
    lines.push('');
    for (const [category, count] of Object.entries(summary.categories)) {
        const categoryName = category
            .split('-')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        lines.push(`- **${categoryName}**: ${count}`);
    }
    lines.push('');

    lines.push('## Detailed Issues');
    lines.push('');

    for (const error of errors) {
        const icon = error.severity === 'error' ? '❌' : error.severity === 'warning' ? '⚠️' : 'ℹ️';

        lines.push(`### ${icon} ${error.fieldPath}`);
        lines.push('');
        lines.push(`**Problem**: ${error.violation.message}`);
        lines.push('');

        if (error.violation.value !== undefined) {
            lines.push('**Current Value**:');
            lines.push('```json');
            lines.push(JSON.stringify(error.violation.value, null, 2));
            lines.push('```');
            lines.push('');
        }

        lines.push(`**Expected**: ${error.violation.expectedConstraint}`);
        lines.push('');
        lines.push(`**Suggestion**: ${error.suggestion}`);
        lines.push('');
        lines.push(`**Documentation**: [${error.category}](${error.documentation})`);
        lines.push('');
        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}

function formatErrorsAsPlainText(errors: DetailedError[]): string {
    return FieldErrorReporter.formatErrorReport(errors);
}

function formatErrorsAsHTML(errors: DetailedError[]): string {
    if (errors.length === 0) {
        return '<div class="validation-report"><h1>MCP Protocol Validation</h1><p>✅ No validation errors found.</p></div>';
    }

    const lines: string[] = [];

    lines.push('<div class="validation-report">');
    lines.push('<h1>MCP Protocol Validation Report</h1>');

    const summary = FieldErrorReporter.createValidationSummary(errors);
    lines.push('<div class="summary">');
    lines.push('<h2>Summary</h2>');
    lines.push('<ul>');
    lines.push(`<li><strong>Total Issues:</strong> ${summary.totalIssues}</li>`);
    lines.push(`<li><strong>Errors:</strong> ${summary.errors}</li>`);
    lines.push(`<li><strong>Warnings:</strong> ${summary.warnings}</li>`);
    lines.push(`<li><strong>Info:</strong> ${summary.info}</li>`);
    lines.push('</ul>');
    lines.push('</div>');

    lines.push('<div class="errors">');
    lines.push('<h2>Detailed Issues</h2>');

    for (const error of errors) {
        const severityClass = error.severity;
        lines.push(`<div class="error ${severityClass}">`);
        lines.push(`<h3>${error.fieldPath}</h3>`);
        lines.push(`<p class="message">${error.violation.message}</p>`);

        if (error.violation.value !== undefined) {
            lines.push('<div class="value">');
            lines.push('<strong>Current Value:</strong>');
            lines.push(`<pre>${JSON.stringify(error.violation.value, null, 2)}</pre>`);
            lines.push('</div>');
        }

        lines.push(`<p><strong>Expected:</strong> ${error.violation.expectedConstraint}</p>`);
        lines.push(`<p><strong>Suggestion:</strong> ${error.suggestion}</p>`);
        lines.push(`<p><strong>Documentation:</strong> <a href="${error.documentation}" target="_blank">${error.category}</a></p>`);
        lines.push('</div>');
    }

    lines.push('</div>');
    lines.push('</div>');

    return lines.join('\n');
}

export const ErrorFormatter = {
    toJSON: formatErrorsAsJSON,
    toMarkdown: formatErrorsAsMarkdown,
    toPlainText: formatErrorsAsPlainText,
    toHTML: formatErrorsAsHTML,
};
