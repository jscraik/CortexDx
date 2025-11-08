/**
 * CEL Rule Builder and Configuration System
 * 
 * Provides tools for creating, loading, and managing custom CEL validation rules
 * for MCP protocol validation.
 * 
 * Requirements: 23.3 - Implement custom CEL rules
 */

import type { CELRule } from "./protovalidate.js";

/**
 * CEL Rule Builder
 * 
 * Fluent API for building CEL validation rules
 */
export class CELRuleBuilder {
    private field: string = '';
    private expression: string = '';
    private message: string = '';
    private severity: 'error' | 'warning' = 'error';

    /**
     * Set the field path to validate
     */
    forField(fieldPath: string): this {
        this.field = fieldPath;
        return this;
    }

    /**
     * Set the CEL expression
     */
    withExpression(expr: string): this {
        this.expression = expr;
        return this;
    }

    /**
     * Set the validation message
     */
    withMessage(msg: string): this {
        this.message = msg;
        return this;
    }

    /**
     * Set the severity level
     */
    withSeverity(level: 'error' | 'warning'): this {
        this.severity = level;
        return this;
    }

    /**
     * Build the CEL rule
     */
    build(): CELRule {
        if (!this.field || !this.expression || !this.message) {
            throw new Error('Field, expression, and message are required to build a CEL rule');
        }

        return {
            field: this.field,
            expression: this.expression,
            message: this.message,
            severity: this.severity
        };
    }

    /**
     * Helper methods for common validation patterns
     */

    /**
     * Validate string length
     */
    stringLength(min?: number, max?: number): this {
        const conditions: string[] = [];

        if (min !== undefined) {
            conditions.push(`size(this) >= ${min}`);
        }
        if (max !== undefined) {
            conditions.push(`size(this) <= ${max}`);
        }

        this.expression = conditions.join(' && ');

        if (!this.message) {
            if (min !== undefined && max !== undefined) {
                this.message = `String length must be between ${min} and ${max} characters`;
            } else if (min !== undefined) {
                this.message = `String length must be at least ${min} characters`;
            } else if (max !== undefined) {
                this.message = `String length must be at most ${max} characters`;
            }
        }

        return this;
    }

    /**
     * Validate string pattern
     */
    matchesPattern(pattern: string): this {
        this.expression = `this.matches("${pattern.replace(/\\/g, '\\\\')}")`;
        if (!this.message) {
            this.message = `String must match pattern: ${pattern}`;
        }
        return this;
    }

    /**
     * Validate string starts with prefix
     */
    startsWith(prefix: string): this {
        this.expression = `this.startsWith("${prefix}")`;
        if (!this.message) {
            this.message = `String must start with "${prefix}"`;
        }
        return this;
    }

    /**
     * Validate string ends with suffix
     */
    endsWith(suffix: string): this {
        this.expression = `this.endsWith("${suffix}")`;
        if (!this.message) {
            this.message = `String must end with "${suffix}"`;
        }
        return this;
    }

    /**
     * Validate string contains substring
     */
    contains(substring: string): this {
        this.expression = `this.contains("${substring}")`;
        if (!this.message) {
            this.message = `String must contain "${substring}"`;
        }
        return this;
    }

    /**
     * Validate field exists
     */
    fieldExists(): this {
        this.expression = `has(this.${this.field})`;
        if (!this.message) {
            this.message = `Field ${this.field} must exist`;
        }
        return this;
    }

    /**
     * Validate number range
     */
    numberRange(min?: number, max?: number): this {
        const conditions: string[] = [];

        if (min !== undefined) {
            conditions.push(`this >= ${min}`);
        }
        if (max !== undefined) {
            conditions.push(`this <= ${max}`);
        }

        this.expression = conditions.join(' && ');

        if (!this.message) {
            if (min !== undefined && max !== undefined) {
                this.message = `Number must be between ${min} and ${max}`;
            } else if (min !== undefined) {
                this.message = `Number must be at least ${min}`;
            } else if (max !== undefined) {
                this.message = `Number must be at most ${max}`;
            }
        }

        return this;
    }

    /**
     * Validate array size
     */
    arraySize(min?: number, max?: number): this {
        const conditions: string[] = [];

        if (min !== undefined) {
            conditions.push(`size(this) >= ${min}`);
        }
        if (max !== undefined) {
            conditions.push(`size(this) <= ${max}`);
        }

        this.expression = conditions.join(' && ');

        if (!this.message) {
            if (min !== undefined && max !== undefined) {
                this.message = `Array size must be between ${min} and ${max}`;
            } else if (min !== undefined) {
                this.message = `Array must have at least ${min} items`;
            } else if (max !== undefined) {
                this.message = `Array must have at most ${max} items`;
            }
        }

        return this;
    }

    /**
     * Validate value is in set
     */
    inSet(values: (string | number)[]): this {
        const valueList = values.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ');
        this.expression = `this in [${valueList}]`;
        if (!this.message) {
            this.message = `Value must be one of: ${values.join(', ')}`;
        }
        return this;
    }

    /**
     * Validate value equals constant
     */
    equals(value: string | number | boolean): this {
        const valueStr = typeof value === 'string' ? `"${value}"` : value;
        this.expression = `this == ${valueStr}`;
        if (!this.message) {
            this.message = `Value must equal ${value}`;
        }
        return this;
    }

    /**
     * Validate value not equals constant
     */
    notEquals(value: string | number | boolean): this {
        const valueStr = typeof value === 'string' ? `"${value}"` : value;
        this.expression = `this != ${valueStr}`;
        if (!this.message) {
            this.message = `Value must not equal ${value}`;
        }
        return this;
    }
}

/**
 * MCP-Specific CEL Rule Library
 * 
 * Pre-defined validation rules for common MCP protocol patterns
 */
export class MCPCELRuleLibrary {
    /**
     * Get all MCP-specific validation rules
     */
    static getAllRules(): CELRule[] {
        return [
            ...this.getProtocolVersionRules(),
            ...this.getCapabilityRules(),
            ...this.getToolDefinitionRules(),
            ...this.getResourceRules(),
            ...this.getServerInfoRules()
        ];
    }

    /**
     * Protocol version validation rules
     */
    static getProtocolVersionRules(): CELRule[] {
        return [
            new CELRuleBuilder()
                .forField('protocolVersion')
                .matchesPattern('^\\d{4}-\\d{2}-\\d{2}$')
                .withMessage('Protocol version must be in YYYY-MM-DD format (e.g., "2024-11-05")')
                .withSeverity('error')
                .build(),

            new CELRuleBuilder()
                .forField('protocolVersion')
                .startsWith('2024-')
                .withMessage('Protocol version should be from 2024 specification')
                .withSeverity('warning')
                .build()
        ];
    }

    /**
     * Capability validation rules
     */
    static getCapabilityRules(): CELRule[] {
        return [
            {
                field: 'capabilities',
                expression: 'has(this.tools) || has(this.resources) || has(this.prompts)',
                message: 'Server must declare at least one capability (tools, resources, or prompts)',
                severity: 'warning'
            },
            {
                field: 'capabilities.tools',
                expression: 'size(this) > 0',
                message: 'If tools capability is declared, at least one tool should be available',
                severity: 'warning'
            }
        ];
    }

    /**
     * Tool definition validation rules
     */
    static getToolDefinitionRules(): CELRule[] {
        return [
            new CELRuleBuilder()
                .forField('tool.name')
                .stringLength(1, 100)
                .withMessage('Tool name must be between 1 and 100 characters')
                .withSeverity('error')
                .build(),

            {
                field: 'tool.inputSchema',
                expression: 'has(this.type) && this.type == "object"',
                message: 'Tool input schema must be a JSON Schema object',
                severity: 'error'
            },

            new CELRuleBuilder()
                .forField('tool.description')
                .stringLength(10, 1000)
                .withMessage('Tool description should be between 10 and 1000 characters')
                .withSeverity('warning')
                .build()
        ];
    }

    /**
     * Resource validation rules
     */
    static getResourceRules(): CELRule[] {
        return [
            {
                field: 'resource.uri',
                expression: 'this.startsWith("file://") || this.startsWith("http://") || this.startsWith("https://")',
                message: 'Resource URI must use a valid scheme (file://, http://, or https://)',
                severity: 'error'
            },

            new CELRuleBuilder()
                .forField('resource.name')
                .stringLength(1, 200)
                .withMessage('Resource name must be between 1 and 200 characters')
                .withSeverity('error')
                .build(),

            {
                field: 'resource.mimeType',
                expression: 'this.contains("/")',
                message: 'MIME type must contain a forward slash (e.g., "text/plain")',
                severity: 'warning'
            }
        ];
    }

    /**
     * Server info validation rules
     */
    static getServerInfoRules(): CELRule[] {
        return [
            new CELRuleBuilder()
                .forField('serverInfo.name')
                .stringLength(3, 100)
                .withMessage('Server name should be between 3 and 100 characters')
                .withSeverity('warning')
                .build(),

            {
                field: 'serverInfo.version',
                expression: 'this.matches("^\\\\d+\\\\.\\\\d+\\\\.\\\\d+") || this.matches("^\\\\d+\\\\.\\\\d+")',
                message: 'Server version should follow semantic versioning (e.g., "1.0.0")',
                severity: 'warning'
            }
        ];
    }

    /**
     * Get rules for specific MCP feature
     */
    static getRulesForFeature(feature: 'protocol' | 'capabilities' | 'tools' | 'resources' | 'serverInfo'): CELRule[] {
        switch (feature) {
            case 'protocol':
                return this.getProtocolVersionRules();
            case 'capabilities':
                return this.getCapabilityRules();
            case 'tools':
                return this.getToolDefinitionRules();
            case 'resources':
                return this.getResourceRules();
            case 'serverInfo':
                return this.getServerInfoRules();
            default:
                return [];
        }
    }
}

/**
 * CEL Rule Configuration Loader
 * 
 * Loads custom CEL rules from configuration files
 */
export class CELRuleConfigLoader {
    /**
     * Load rules from JSON configuration
     */
    static loadFromJSON(json: string): CELRule[] {
        try {
            const config = JSON.parse(json);
            return this.parseRulesConfig(config);
        } catch (error) {
            throw new Error(`Failed to parse CEL rules JSON: ${String(error)}`);
        }
    }

    /**
     * Load rules from configuration object
     */
    static loadFromConfig(config: CELRulesConfig): CELRule[] {
        return this.parseRulesConfig(config);
    }

    /**
     * Parse rules configuration
     */
    private static parseRulesConfig(config: CELRulesConfig): CELRule[] {
        const rules: CELRule[] = [];

        if (config.rules) {
            for (const rule of config.rules) {
                if (this.isValidRule(rule)) {
                    rules.push({
                        field: rule.field,
                        expression: rule.expression,
                        message: rule.message,
                        severity: rule.severity || 'error'
                    });
                }
            }
        }

        return rules;
    }

    /**
     * Validate rule configuration
     */
    private static isValidRule(rule: unknown): rule is CELRule {
        if (!rule || typeof rule !== 'object') {
            return false;
        }

        const r = rule as Record<string, unknown>;

        return (
            typeof r.field === 'string' &&
            typeof r.expression === 'string' &&
            typeof r.message === 'string' &&
            (!r.severity || r.severity === 'error' || r.severity === 'warning')
        );
    }

    /**
     * Merge multiple rule sets
     */
    static mergeRuleSets(...ruleSets: CELRule[][]): CELRule[] {
        const merged: CELRule[] = [];
        const seen = new Set<string>();

        for (const ruleSet of ruleSets) {
            for (const rule of ruleSet) {
                const key = `${rule.field}:${rule.expression}`;
                if (!seen.has(key)) {
                    merged.push(rule);
                    seen.add(key);
                }
            }
        }

        return merged;
    }

    /**
     * Create default MCP rules configuration
     */
    static createDefaultConfig(): CELRulesConfig {
        return {
            version: '1.0',
            rules: MCPCELRuleLibrary.getAllRules()
        };
    }
}

/**
 * CEL Rules Configuration Interface
 */
export interface CELRulesConfig {
    version?: string;
    rules: CELRule[];
    extends?: string; // Path to base configuration
}

/**
 * Rule Validation and Testing
 */
export class CELRuleValidator {
    /**
     * Validate a CEL rule syntax
     */
    static validateRule(rule: CELRule): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check required fields
        if (!rule.field) {
            errors.push('Rule must have a field path');
        }

        if (!rule.expression) {
            errors.push('Rule must have an expression');
        }

        if (!rule.message) {
            errors.push('Rule must have a message');
        }

        // Check expression syntax (basic validation)
        if (rule.expression) {
            try {
                this.validateExpressionSyntax(rule.expression);
            } catch (error) {
                errors.push(`Invalid expression syntax: ${String(error)}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate expression syntax
     */
    private static validateExpressionSyntax(expression: string): void {
        // Check for balanced parentheses
        let depth = 0;
        for (const char of expression) {
            if (char === '(') depth++;
            if (char === ')') depth--;
            if (depth < 0) {
                throw new Error('Unbalanced parentheses');
            }
        }
        if (depth !== 0) {
            throw new Error('Unbalanced parentheses');
        }

        // Check for balanced quotes
        const quotes = expression.match(/"/g);
        if (quotes && quotes.length % 2 !== 0) {
            throw new Error('Unbalanced quotes');
        }

        // Check for valid operators
        const invalidOperators = /[^a-zA-Z0-9_.\s()[\]{},"'<>=!&|+-/*]/g;
        const invalid = expression.match(invalidOperators);
        if (invalid) {
            throw new Error(`Invalid characters in expression: ${invalid.join(', ')}`);
        }
    }

    /**
     * Test a rule against sample data
     */
    static async testRule(
        rule: CELRule,
        sampleData: unknown
    ): Promise<{ passed: boolean; error?: string }> {
        try {
            const { ProtovalidateAdapter } = await import('./protovalidate.js');
            const adapter = new ProtovalidateAdapter();

            const result = await adapter.validate(sampleData, [rule]);

            return {
                passed: result.valid,
                error: result.violations.length > 0 ? result.violations[0].message : undefined
            };
        } catch (error) {
            return {
                passed: false,
                error: String(error)
            };
        }
    }
}
