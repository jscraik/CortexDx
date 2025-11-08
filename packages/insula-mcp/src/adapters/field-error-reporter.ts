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

/**
 * Field Error Reporter
 * 
 * Generates detailed, actionable error reports with suggestions and documentation
 */
export class FieldErrorReporter {
    private static readonly MCP_DOCS_BASE = 'https://modelcontextprotocol.io/docs';
    private static readonly MCP_SPEC_BASE = 'https://spec.modelcontextprotocol.io';

    /**
     * Generate detailed errors from field violations
     */
    static generateDetailedErrors(violations: FieldViolation[]): DetailedError[] {
        return violations.map(violation => this.createDetailedError(violation));
    }

    /**
     * Create a detailed error from a field violation
     */
    private static createDetailedError(violation: FieldViolation): DetailedError {
        const category = this.categorizeError(violation.fieldPath);
        const suggestion = this.generateSuggestion(violation, category);
        const documentation = this.getDocumentationLink(category, violation.fieldPath);
        const severity = this.determineSeverity(violation, category);

        return {
            field: this.extractFieldName(violation.fieldPath),
            fieldPath: violation.fieldPath,
            violation,
            suggestion,
            documentation,
            severity,
            category
        };
    }

    /**
     * Categorize error based on field path
     */
    private static categorizeError(fieldPath: string): ErrorCategory {
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

    /**
     * Generate actionable suggestion for fixing the violation
     */
    private static generateSuggestion(violation: FieldViolation, category: ErrorCategory): string {
        const suggestions: Record<string, (v: FieldViolation) => string> = {
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

            'handshake': (v) => {
                return 'Ensure the initialize request/response follows the MCP handshake protocol';
            },

            'authentication': (v) => {
                return 'Check authentication configuration and ensure proper credentials are provided';
            },

            'general': (v) => {
                return `Fix the ${v.fieldPath} field to satisfy the constraint: ${v.expectedConstraint}`;
            }
        };

        const suggestionFn = suggestions[category] || suggestions['general'];
        return suggestionFn(violation);
    }

    /**
     * Get documentation link for the error category
     */
    private static getDocumentationLink(category: ErrorCategory, fieldPath: string): string {
        const links: Record<ErrorCategory, string> = {
            'protocol-version': `${this.MCP_SPEC_BASE}/protocol/version`,
            'capabilities': `${this.MCP_DOCS_BASE}/concepts/capabilities`,
            'tool-definition': `${this.MCP_DOCS_BASE}/concepts/tools`,
            'resource-definition': `${this.MCP_DOCS_BASE}/concepts/resources`,
            'server-info': `${this.MCP_DOCS_BASE}/concepts/server-info`,
            'json-rpc': `${this.MCP_SPEC_BASE}/protocol/json-rpc`,
            'handshake': `${this.MCP_DOCS_BASE}/concepts/lifecycle#initialization`,
            'authentication': `${this.MCP_DOCS_BASE}/concepts/authentication`,
            'general': `${this.MCP_DOCS_BASE}/specification`
        };

        return links[category] || links['general'];
    }

    /**
     * Determine severity based on violation and category
     */
    private static determineSeverity(
        violation: FieldViolation,
        category: ErrorCategory
    ): 'error' | 'warning' | 'info' {
        // Critical categories that should be errors
        const criticalCategories: ErrorCategory[] = [
            'protocol-version',
            'json-rpc',
            'handshake'
        ];

        if (criticalCategories.includes(category)) {
            return 'error';
        }

        // Check constraint ID for severity hints
        if (violation.constraintId.includes('required') ||
            violation.constraintId.includes('must') ||
            violation.constraintId.includes('invalid')) {
            return 'error';
        }

        if (violation.constraintId.includes('should') ||
            violation.constraintId.includes('recommended')) {
            return 'warning';
        }

        return 'info';
    }

    /**
     * Extract field name from field path
     */
    private static extractFieldName(fieldPath: string): string {
        const parts = fieldPath.split('.');
        return parts[parts.length - 1];
    }

    /**
     * Format detailed error as human-readable message
     */
    static formatError(error: DetailedError): string {
        const lines: string[] = [];

        // Header with severity
        const severityPrefix = error.severity.toUpperCase();
        lines.push(`[${severityPrefix}] ${error.fieldPath}`);
        lines.push('');

        // Violation message
        lines.push(`Problem: ${error.violation.message}`);
        lines.push('');

        // Current value (if available)
        if (error.violation.value !== undefined) {
            const valueStr = typeof error.violation.value === 'object'
                ? JSON.stringify(error.violation.value, null, 2)
                : String(error.violation.value);
            lines.push(`Current value: ${valueStr}`);
            lines.push('');
        }

        // Expected constraint
        lines.push(`Expected: ${error.violation.expectedConstraint}`);
        lines.push('');

        // Suggestion
        lines.push(`Suggestion: ${error.suggestion}`);
        lines.push('');

        // Documentation link
        lines.push(`Documentation: ${error.documentation}`);

        return lines.join('\n');
    }

    /**
     * Format multiple errors as a report
     */
    static formatErrorReport(errors: DetailedError[]): string {
        if (errors.length === 0) {
            return 'No validation errors found.';
        }

        const lines: string[] = [];

        // Summary
        const errorCount = errors.filter(e => e.severity === 'error').length;
        const warningCount = errors.filter(e => e.severity === 'warning').length;
        const infoCount = errors.filter(e => e.severity === 'info').length;

        lines.push('=== MCP Protocol Validation Report ===');
        lines.push('');
        lines.push(`Total issues: ${errors.length}`);
        lines.push(`  Errors: ${errorCount}`);
        lines.push(`  Warnings: ${warningCount}`);
        lines.push(`  Info: ${infoCount}`);
        lines.push('');
        lines.push('='.repeat(40));
        lines.push('');

        // Group errors by category
        const errorsByCategory = this.groupErrorsByCategory(errors);

        for (const [category, categoryErrors] of Object.entries(errorsByCategory)) {
            lines.push(`## ${this.formatCategoryName(category)}`);
            lines.push('');

            for (const error of categoryErrors) {
                lines.push(this.formatError(error));
                lines.push('');
                lines.push('-'.repeat(40));
                lines.push('');
            }
        }

        return lines.join('\n');
    }

    /**
     * Group errors by category
     */
    private static groupErrorsByCategory(errors: DetailedError[]): Record<string, DetailedError[]> {
        const grouped: Record<string, DetailedError[]> = {};

        for (const error of errors) {
            if (!grouped[error.category]) {
                grouped[error.category] = [];
            }
            grouped[error.category].push(error);
        }

        return grouped;
    }

    /**
     * Format category name for display
     */
    private static formatCategoryName(category: string): string {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Generate field path error message
     */
    static generateFieldPathError(
        fieldPath: string,
        actualValue: unknown,
        expectedConstraint: string,
        message: string
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

    /**
     * Create validation summary
     */
    static createValidationSummary(errors: DetailedError[]): ValidationSummary {
        const summary: ValidationSummary = {
            totalIssues: errors.length,
            errors: errors.filter(e => e.severity === 'error').length,
            warnings: errors.filter(e => e.severity === 'warning').length,
            info: errors.filter(e => e.severity === 'info').length,
            categories: {},
            criticalFields: []
        };

        // Count by category
        for (const error of errors) {
            if (!summary.categories[error.category]) {
                summary.categories[error.category] = 0;
            }
            summary.categories[error.category]++;
        }

        // Identify critical fields
        summary.criticalFields = errors
            .filter(e => e.severity === 'error')
            .map(e => e.fieldPath);

        return summary;
    }
}

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

/**
 * Error Formatter for different output formats
 */
export class ErrorFormatter {
    /**
     * Format errors as JSON
     */
    static toJSON(errors: DetailedError[]): string {
        return JSON.stringify(errors, null, 2);
    }

    /**
     * Format errors as Markdown
     */
    static toMarkdown(errors: DetailedError[]): string {
        if (errors.length === 0) {
            return '# MCP Protocol Validation\n\n✅ No validation errors found.';
        }

        const lines: string[] = [];

        lines.push('# MCP Protocol Validation Report');
        lines.push('');

        // Summary
        const summary = FieldErrorReporter.createValidationSummary(errors);
        lines.push('## Summary');
        lines.push('');
        lines.push(`- **Total Issues**: ${summary.totalIssues}`);
        lines.push(`- **Errors**: ${summary.errors}`);
        lines.push(`- **Warnings**: ${summary.warnings}`);
        lines.push(`- **Info**: ${summary.info}`);
        lines.push('');

        // Issues by category
        lines.push('## Issues by Category');
        lines.push('');
        for (const [category, count] of Object.entries(summary.categories)) {
            const categoryName = category.split('-').map(w =>
                w.charAt(0).toUpperCase() + w.slice(1)
            ).join(' ');
            lines.push(`- **${categoryName}**: ${count}`);
        }
        lines.push('');

        // Detailed errors
        lines.push('## Detailed Issues');
        lines.push('');

        for (const error of errors) {
            const icon = error.severity === 'error' ? '❌' :
                error.severity === 'warning' ? '⚠️' : 'ℹ️';

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

    /**
     * Format errors as plain text
     */
    static toPlainText(errors: DetailedError[]): string {
        return FieldErrorReporter.formatErrorReport(errors);
    }

    /**
     * Format errors as HTML
     */
    static toHTML(errors: DetailedError[]): string {
        if (errors.length === 0) {
            return '<div class="validation-report"><h1>MCP Protocol Validation</h1><p>✅ No validation errors found.</p></div>';
        }

        const lines: string[] = [];

        lines.push('<div class="validation-report">');
        lines.push('<h1>MCP Protocol Validation Report</h1>');

        // Summary
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

        // Detailed errors
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
}
