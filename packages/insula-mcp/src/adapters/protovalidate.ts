/**
 * Protovalidate Integration for MCP Protocol Validation
 * 
 * Provides semantic validation using CEL (Common Expression Language) expressions
 * for Protocol Buffer messages and MCP protocol compliance.
 * 
 * Requirements: 23.1 - Integrate Protovalidate for semantic validation
 */

export interface ValidationResult {
    valid: boolean;
    violations: FieldViolation[];
    errors: string[];
}

export interface FieldViolation {
    fieldPath: string;
    constraintId: string;
    message: string;
    value: unknown;
    expectedConstraint: string;
}

export interface CELRule {
    field: string;
    expression: string;
    message: string;
    severity: 'error' | 'warning';
}

export interface StringConstraints {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    prefix?: string;
    suffix?: string;
    contains?: string;
    notContains?: string;
    in?: string[];
    notIn?: string[];
    email?: boolean;
    hostname?: boolean;
    ip?: boolean;
    uri?: boolean;
    uuid?: boolean;
}

export interface NumberConstraints {
    const?: number;
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    in?: number[];
    notIn?: number[];
    finite?: boolean;
}

export interface RepeatedConstraints {
    minItems?: number;
    maxItems?: number;
    unique?: boolean;
}

/**
 * Protovalidate Adapter
 * 
 * Provides CEL-based validation for MCP protocol messages with performance optimizations
 * Requirements: 23.5 - Optimize validation performance (<5s validation time)
 */
export class ProtovalidateAdapter {
    private compiledRules: Map<string, CompiledCELRule> = new Map();
    private validationCache: Map<string, ValidationResult> = new Map();
    private cacheEnabled = true;
    private maxCacheSize = 1000;

    /**
     * Enable or disable validation caching
     */
    setCacheEnabled(enabled: boolean): void {
        this.cacheEnabled = enabled;
        if (!enabled) {
            this.validationCache.clear();
        }
    }

    /**
     * Clear validation cache
     */
    clearCache(): void {
        this.validationCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; maxSize: number; hitRate: number } {
        return {
            size: this.validationCache.size,
            maxSize: this.maxCacheSize,
            hitRate: 0 // Would need to track hits/misses for accurate rate
        };
    }

    /**
     * Validate a message against constraints with caching and parallel execution
     * Requirements: 23.5 - Performance optimization
     */
    async validate(message: unknown, constraints: CELRule[]): Promise<ValidationResult> {
        // Check cache if enabled
        if (this.cacheEnabled) {
            const cacheKey = this.generateCacheKey(message, constraints);
            const cached = this.validationCache.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        const violations: FieldViolation[] = [];
        const errors: string[] = [];

        // Parallel validation for better performance
        const validationPromises = constraints.map(async (rule) => {
            try {
                const result = await this.evaluateCEL(rule.expression, message, rule.field);

                if (!result.valid) {
                    return {
                        violation: {
                            fieldPath: rule.field,
                            constraintId: rule.expression,
                            message: rule.message,
                            value: this.getFieldValue(message, rule.field),
                            expectedConstraint: rule.expression
                        },
                        error: null
                    };
                }
                return { violation: null, error: null };
            } catch (error) {
                return {
                    violation: null,
                    error: `Failed to evaluate rule for ${rule.field}: ${String(error)}`
                };
            }
        });

        // Wait for all validations to complete
        const results = await Promise.all(validationPromises);

        // Collect violations and errors
        for (const result of results) {
            if (result.violation) {
                violations.push(result.violation);
            }
            if (result.error) {
                errors.push(result.error);
            }
        }

        const validationResult = {
            valid: violations.length === 0 && errors.length === 0,
            violations,
            errors
        };

        // Cache the result if enabled
        if (this.cacheEnabled) {
            const cacheKey = this.generateCacheKey(message, constraints);
            this.addToCache(cacheKey, validationResult);
        }

        return validationResult;
    }

    /**
     * Validate multiple messages in parallel
     * Requirements: 23.5 - Parallel validation for multiple messages
     */
    async validateBatch(
        messages: unknown[],
        constraints: CELRule[]
    ): Promise<ValidationResult[]> {
        const validationPromises = messages.map(message =>
            this.validate(message, constraints)
        );

        return Promise.all(validationPromises);
    }

    /**
     * Generate cache key for validation result
     */
    private generateCacheKey(message: unknown, constraints: CELRule[]): string {
        const messageHash = JSON.stringify(message);
        const constraintsHash = constraints.map(c => `${c.field}:${c.expression}`).join('|');
        return `${messageHash}:${constraintsHash}`;
    }

    /**
     * Add result to cache with size limit
     */
    private addToCache(key: string, result: ValidationResult): void {
        // Implement LRU-like behavior: remove oldest entry if cache is full
        if (this.validationCache.size >= this.maxCacheSize) {
            const firstKey = this.validationCache.keys().next().value;
            if (firstKey) {
                this.validationCache.delete(firstKey);
            }
        }

        this.validationCache.set(key, result);
    }

    /**
     * Validate a specific field against constraints
     */
    async validateField(
        value: unknown,
        fieldPath: string,
        constraint: StringConstraints | NumberConstraints | RepeatedConstraints
    ): Promise<ValidationResult> {
        const violations: FieldViolation[] = [];

        if (typeof value === 'string' && this.isStringConstraints(constraint)) {
            const stringViolations = this.validateString(value, fieldPath, constraint);
            violations.push(...stringViolations);
        } else if (typeof value === 'number' && this.isNumberConstraints(constraint)) {
            const numberViolations = this.validateNumber(value, fieldPath, constraint);
            violations.push(...numberViolations);
        } else if (Array.isArray(value) && this.isRepeatedConstraints(constraint)) {
            const arrayViolations = this.validateRepeated(value, fieldPath, constraint);
            violations.push(...arrayViolations);
        }

        return {
            valid: violations.length === 0,
            violations,
            errors: []
        };
    }

    /**
     * Evaluate a CEL expression
     */
    async evaluateCEL(
        expression: string,
        context: unknown,
        fieldPath: string
    ): Promise<{ valid: boolean; error?: string }> {
        try {
            // Get compiled rule or compile new one
            let compiled = this.compiledRules.get(expression);
            if (!compiled) {
                compiled = await this.compileCEL(expression);
                this.compiledRules.set(expression, compiled);
            }

            // Evaluate the expression
            const value = this.getFieldValue(context, fieldPath);
            const result = compiled.evaluate(value, context);

            return { valid: result };
        } catch (error) {
            return { valid: false, error: String(error) };
        }
    }

    /**
     * Compile a CEL expression for reuse
     */
    async compileCEL(expression: string): Promise<CompiledCELRule> {
        // Parse and compile the CEL expression
        return new CompiledCELRule(expression);
    }

    /**
     * Validate string constraints
     */
    private validateString(
        value: string,
        fieldPath: string,
        constraints: StringConstraints
    ): FieldViolation[] {
        const violations: FieldViolation[] = [];

        if (constraints.minLength !== undefined && value.length < constraints.minLength) {
            violations.push({
                fieldPath,
                constraintId: 'string.minLength',
                message: `String length ${value.length} is less than minimum ${constraints.minLength}`,
                value,
                expectedConstraint: `minLength: ${constraints.minLength}`
            });
        }

        if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
            violations.push({
                fieldPath,
                constraintId: 'string.maxLength',
                message: `String length ${value.length} exceeds maximum ${constraints.maxLength}`,
                value,
                expectedConstraint: `maxLength: ${constraints.maxLength}`
            });
        }

        if (constraints.pattern && !new RegExp(constraints.pattern).test(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.pattern',
                message: `String does not match pattern ${constraints.pattern}`,
                value,
                expectedConstraint: `pattern: ${constraints.pattern}`
            });
        }

        if (constraints.prefix && !value.startsWith(constraints.prefix)) {
            violations.push({
                fieldPath,
                constraintId: 'string.prefix',
                message: `String does not start with required prefix "${constraints.prefix}"`,
                value,
                expectedConstraint: `prefix: ${constraints.prefix}`
            });
        }

        if (constraints.suffix && !value.endsWith(constraints.suffix)) {
            violations.push({
                fieldPath,
                constraintId: 'string.suffix',
                message: `String does not end with required suffix "${constraints.suffix}"`,
                value,
                expectedConstraint: `suffix: ${constraints.suffix}`
            });
        }

        if (constraints.contains && !value.includes(constraints.contains)) {
            violations.push({
                fieldPath,
                constraintId: 'string.contains',
                message: `String does not contain required substring "${constraints.contains}"`,
                value,
                expectedConstraint: `contains: ${constraints.contains}`
            });
        }

        if (constraints.notContains && value.includes(constraints.notContains)) {
            violations.push({
                fieldPath,
                constraintId: 'string.notContains',
                message: `String contains forbidden substring "${constraints.notContains}"`,
                value,
                expectedConstraint: `notContains: ${constraints.notContains}`
            });
        }

        if (constraints.in && !constraints.in.includes(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.in',
                message: `String value not in allowed set: ${constraints.in.join(', ')}`,
                value,
                expectedConstraint: `in: [${constraints.in.join(', ')}]`
            });
        }

        if (constraints.notIn?.includes(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.notIn',
                message: `String value in forbidden set: ${constraints.notIn.join(', ')}`,
                value,
                expectedConstraint: `notIn: [${constraints.notIn.join(', ')}]`
            });
        }

        // Format validators
        if (constraints.email && !this.isValidEmail(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.email',
                message: 'String is not a valid email address',
                value,
                expectedConstraint: 'email: true'
            });
        }

        if (constraints.uri && !this.isValidURI(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.uri',
                message: 'String is not a valid URI',
                value,
                expectedConstraint: 'uri: true'
            });
        }

        if (constraints.uuid && !this.isValidUUID(value)) {
            violations.push({
                fieldPath,
                constraintId: 'string.uuid',
                message: 'String is not a valid UUID',
                value,
                expectedConstraint: 'uuid: true'
            });
        }

        return violations;
    }

    /**
     * Validate number constraints
     */
    private validateNumber(
        value: number,
        fieldPath: string,
        constraints: NumberConstraints
    ): FieldViolation[] {
        const violations: FieldViolation[] = [];

        if (constraints.const !== undefined && value !== constraints.const) {
            violations.push({
                fieldPath,
                constraintId: 'number.const',
                message: `Number ${value} does not equal required constant ${constraints.const}`,
                value,
                expectedConstraint: `const: ${constraints.const}`
            });
        }

        if (constraints.lt !== undefined && value >= constraints.lt) {
            violations.push({
                fieldPath,
                constraintId: 'number.lt',
                message: `Number ${value} is not less than ${constraints.lt}`,
                value,
                expectedConstraint: `lt: ${constraints.lt}`
            });
        }

        if (constraints.lte !== undefined && value > constraints.lte) {
            violations.push({
                fieldPath,
                constraintId: 'number.lte',
                message: `Number ${value} is not less than or equal to ${constraints.lte}`,
                value,
                expectedConstraint: `lte: ${constraints.lte}`
            });
        }

        if (constraints.gt !== undefined && value <= constraints.gt) {
            violations.push({
                fieldPath,
                constraintId: 'number.gt',
                message: `Number ${value} is not greater than ${constraints.gt}`,
                value,
                expectedConstraint: `gt: ${constraints.gt}`
            });
        }

        if (constraints.gte !== undefined && value < constraints.gte) {
            violations.push({
                fieldPath,
                constraintId: 'number.gte',
                message: `Number ${value} is not greater than or equal to ${constraints.gte}`,
                value,
                expectedConstraint: `gte: ${constraints.gte}`
            });
        }

        if (constraints.in && !constraints.in.includes(value)) {
            violations.push({
                fieldPath,
                constraintId: 'number.in',
                message: `Number value not in allowed set: ${constraints.in.join(', ')}`,
                value,
                expectedConstraint: `in: [${constraints.in.join(', ')}]`
            });
        }

        if (constraints.notIn?.includes(value)) {
            violations.push({
                fieldPath,
                constraintId: 'number.notIn',
                message: `Number value in forbidden set: ${constraints.notIn.join(', ')}`,
                value,
                expectedConstraint: `notIn: [${constraints.notIn.join(', ')}]`
            });
        }

        if (constraints.finite && !Number.isFinite(value)) {
            violations.push({
                fieldPath,
                constraintId: 'number.finite',
                message: 'Number must be finite (not NaN or Infinity)',
                value,
                expectedConstraint: 'finite: true'
            });
        }

        return violations;
    }

    /**
     * Validate repeated (array) constraints
     */
    private validateRepeated(
        value: unknown[],
        fieldPath: string,
        constraints: RepeatedConstraints
    ): FieldViolation[] {
        const violations: FieldViolation[] = [];

        if (constraints.minItems !== undefined && value.length < constraints.minItems) {
            violations.push({
                fieldPath,
                constraintId: 'repeated.minItems',
                message: `Array length ${value.length} is less than minimum ${constraints.minItems}`,
                value,
                expectedConstraint: `minItems: ${constraints.minItems}`
            });
        }

        if (constraints.maxItems !== undefined && value.length > constraints.maxItems) {
            violations.push({
                fieldPath,
                constraintId: 'repeated.maxItems',
                message: `Array length ${value.length} exceeds maximum ${constraints.maxItems}`,
                value,
                expectedConstraint: `maxItems: ${constraints.maxItems}`
            });
        }

        if (constraints.unique) {
            const uniqueValues = new Set(value.map(v => JSON.stringify(v)));
            if (uniqueValues.size !== value.length) {
                violations.push({
                    fieldPath,
                    constraintId: 'repeated.unique',
                    message: 'Array contains duplicate values',
                    value,
                    expectedConstraint: 'unique: true'
                });
            }
        }

        return violations;
    }

    /**
     * Get field value from object using dot notation
     */
    private getFieldValue(obj: unknown, fieldPath: string): unknown {
        if (!obj || typeof obj !== 'object') {
            return undefined;
        }

        const parts = fieldPath.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || typeof current !== 'object') {
                return undefined;
            }
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }

    /**
     * Type guards
     */
    private isStringConstraints(constraint: unknown): constraint is StringConstraints {
        return typeof constraint === 'object' && constraint !== null &&
            ('minLength' in constraint || 'maxLength' in constraint || 'pattern' in constraint);
    }

    private isNumberConstraints(constraint: unknown): constraint is NumberConstraints {
        return typeof constraint === 'object' && constraint !== null &&
            ('lt' in constraint || 'gt' in constraint || 'const' in constraint);
    }

    private isRepeatedConstraints(constraint: unknown): constraint is RepeatedConstraints {
        return typeof constraint === 'object' && constraint !== null &&
            ('minItems' in constraint || 'maxItems' in constraint || 'unique' in constraint);
    }

    /**
     * Format validators
     */
    private isValidEmail(value: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    private isValidURI(value: string): boolean {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    private isValidUUID(value: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    }
}

/**
 * Compiled CEL Rule
 * 
 * Represents a compiled CEL expression for efficient evaluation
 */
class CompiledCELRule {
    constructor(private expression: string) { }

    /**
     * Evaluate the compiled rule against a value
     */
    evaluate(value: unknown, context: unknown): boolean {
        try {
            // Parse and evaluate CEL-like expressions
            // Supported operators: ==, !=, <, >, <=, >=, &&, ||, matches, startsWith, endsWith, contains, size

            const expr = this.expression.trim();

            // Handle 'this' reference
            const thisValue = value;

            // String methods
            if (expr.includes('.matches(')) {
                return this.evaluateMatches(expr, thisValue);
            }
            if (expr.includes('.startsWith(')) {
                return this.evaluateStartsWith(expr, thisValue);
            }
            if (expr.includes('.endsWith(')) {
                return this.evaluateEndsWith(expr, thisValue);
            }
            if (expr.includes('.contains(')) {
                return this.evaluateContains(expr, thisValue);
            }

            // Size function
            if (expr.includes('size(')) {
                return this.evaluateSize(expr, thisValue, context);
            }

            // Has function (check if field exists)
            if (expr.includes('has(')) {
                return this.evaluateHas(expr, context);
            }

            // Comparison operators
            if (expr.includes('==') || expr.includes('!=') ||
                expr.includes('<=') || expr.includes('>=') ||
                expr.includes('<') || expr.includes('>')) {
                return this.evaluateComparison(expr, thisValue, context);
            }

            // Logical operators
            if (expr.includes('&&') || expr.includes('||')) {
                return this.evaluateLogical(expr, thisValue, context);
            }

            // Default: try to evaluate as boolean
            return Boolean(thisValue);
        } catch {
            return false;
        }
    }

    private evaluateMatches(expr: string, value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const match = expr.match(/\.matches\("(.+?)"\)/);
        if (!match) return false;
        const pattern = match[1].replace(/\\\\/g, '\\');
        return new RegExp(pattern).test(value);
    }

    private evaluateStartsWith(expr: string, value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const match = expr.match(/\.startsWith\("(.+?)"\)/);
        if (!match) return false;
        return value.startsWith(match[1]);
    }

    private evaluateEndsWith(expr: string, value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const match = expr.match(/\.endsWith\("(.+?)"\)/);
        if (!match) return false;
        return value.endsWith(match[1]);
    }

    private evaluateContains(expr: string, value: unknown): boolean {
        if (typeof value !== 'string') return false;
        const match = expr.match(/\.contains\("(.+?)"\)/);
        if (!match) return false;
        return value.includes(match[1]);
    }

    private evaluateSize(expr: string, value: unknown, context: unknown): boolean {
        const match = expr.match(/size\((.+?)\)\s*([><=!]+)\s*(\d+)/);
        if (!match) return false;

        const [, target, operator, sizeStr] = match;
        const expectedSize = Number.parseInt(sizeStr, 10);

        let actualSize = 0;
        if (target === 'this') {
            if (typeof value === 'string' || Array.isArray(value)) {
                actualSize = value.length;
            } else if (typeof value === 'object' && value !== null) {
                actualSize = Object.keys(value).length;
            }
        } else {
            const targetValue = this.getNestedValue(context, target);
            if (typeof targetValue === 'string' || Array.isArray(targetValue)) {
                actualSize = targetValue.length;
            } else if (typeof targetValue === 'object' && targetValue !== null) {
                actualSize = Object.keys(targetValue).length;
            }
        }

        return this.compareValues(actualSize, operator, expectedSize);
    }

    private evaluateHas(expr: string, context: unknown): boolean {
        const match = expr.match(/has\((.+?)\)/);
        if (!match) return false;

        const fieldPath = match[1].replace(/^this\./, '');
        const value = this.getNestedValue(context, fieldPath);
        return value !== undefined && value !== null;
    }

    private evaluateComparison(expr: string, value: unknown, context: unknown): boolean {
        // Parse comparison: this <op> value or field <op> value
        const operators = ['==', '!=', '<=', '>=', '<', '>'];

        for (const op of operators) {
            if (expr.includes(op)) {
                const parts = expr.split(op).map(p => p.trim());
                if (parts.length !== 2) continue;

                const left = parts[0] === 'this' ? value : this.parseValue(parts[0], context);
                const right = this.parseValue(parts[1], context);

                return this.compareValues(left, op, right);
            }
        }

        return false;
    }

    private evaluateLogical(expr: string, value: unknown, context: unknown): boolean {
        if (expr.includes('&&')) {
            const parts = expr.split('&&').map(p => p.trim());
            return parts.every(part => {
                const rule = new CompiledCELRule(part);
                return rule.evaluate(value, context);
            });
        }

        if (expr.includes('||')) {
            const parts = expr.split('||').map(p => p.trim());
            return parts.some(part => {
                const rule = new CompiledCELRule(part);
                return rule.evaluate(value, context);
            });
        }

        return false;
    }

    private compareValues(left: unknown, operator: string, right: unknown): boolean {
        switch (operator) {
            case '==':
                return left === right;
            case '!=':
                return left !== right;
            case '<':
                return (left as number) < (right as number);
            case '>':
                return (left as number) > (right as number);
            case '<=':
                return (left as number) <= (right as number);
            case '>=':
                return (left as number) >= (right as number);
            default:
                return false;
        }
    }

    private parseValue(str: string, context: unknown): unknown {
        const normalized = str.trim();

        // String literal
        if (normalized.startsWith('"') && normalized.endsWith('"')) {
            return normalized.slice(1, -1);
        }

        // Number literal
        if (/^-?\d+(\.\d+)?$/.test(normalized)) {
            return Number.parseFloat(normalized);
        }

        // Boolean literal
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;

        // Null literal
        if (normalized === 'null') return null;

        // Field reference
        if (normalized.startsWith('this.')) {
            return this.getNestedValue(context, normalized.replace(/^this\./, ''));
        }

        return this.getNestedValue(context, normalized);
    }

    private getNestedValue(obj: unknown, path: string): unknown {
        if (!obj || typeof obj !== 'object') return undefined;

        const parts = path.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') return undefined;
            current = (current as Record<string, unknown>)[part];
        }

        return current;
    }
}
