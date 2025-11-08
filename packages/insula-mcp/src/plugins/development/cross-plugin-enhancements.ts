/**
 * Cross-Plugin Enhancements
 * Shared functionality for all development plugins
 * Requirements: 24.8
 * 
 * ENHANCEMENTS:
 * - User-level adaptation across all plugins
 * - Conversational UX improvements
 * - Security and compliance awareness
 * - Transparency and control mechanisms
 * - Learning and personalization system
 */

import type { DevelopmentContext } from "../../types.js";

/**
 * User Adaptation System (Req 24.8)
 * Learns from user interactions and adapts responses
 */
export class UserAdaptationSystem {
    private userProfiles: Map<string, UserProfile> = new Map();

    async getUserProfile(userId: string): Promise<UserProfile> {
        let profile = this.userProfiles.get(userId);
        if (!profile) {
            profile = this.createDefaultProfile(userId);
            this.userProfiles.set(userId, profile);
        }
        return profile;
    }

    async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
        const profile = await this.getUserProfile(userId);
        Object.assign(profile, updates);
    }

    async recordInteraction(userId: string, interaction: UserInteraction): Promise<void> {
        const profile = await this.getUserProfile(userId);
        profile.interactionHistory.push(interaction);

        // Update preferences based on interaction
        this.updatePreferencesFromInteraction(profile, interaction);

        // Limit history size
        if (profile.interactionHistory.length > 100) {
            profile.interactionHistory = profile.interactionHistory.slice(-100);
        }
    }

    private createDefaultProfile(userId: string): UserProfile {
        return {
            userId,
            expertiseLevel: 'intermediate',
            preferences: {
                verbosity: 'balanced',
                codeExamples: true,
                technicalDetails: true,
                stepByStepGuidance: true,
                autoFix: false
            },
            interactionHistory: [],
            learningProgress: {
                conceptsLearned: [],
                skillsAcquired: [],
                commonMistakes: []
            },
            lastUpdated: Date.now()
        };
    }

    private updatePreferencesFromInteraction(profile: UserProfile, interaction: UserInteraction): void {
        // Adjust verbosity based on feedback
        if (interaction.feedback === 'too_verbose') {
            profile.preferences.verbosity = 'concise';
        } else if (interaction.feedback === 'too_brief') {
            profile.preferences.verbosity = 'detailed';
        }

        // Track learning progress
        if (interaction.type === 'tutorial_completed') {
            profile.learningProgress.conceptsLearned.push(interaction.context);
        }

        // Detect expertise level changes
        if (interaction.successRate && interaction.successRate > 0.8) {
            if (profile.expertiseLevel === 'beginner') {
                profile.expertiseLevel = 'intermediate';
            } else if (profile.expertiseLevel === 'intermediate' && interaction.successRate > 0.9) {
                profile.expertiseLevel = 'expert';
            }
        }

        profile.lastUpdated = Date.now();
    }
}

export interface UserProfile {
    userId: string;
    expertiseLevel: 'beginner' | 'intermediate' | 'expert';
    preferences: UserPreferences;
    interactionHistory: UserInteraction[];
    learningProgress: LearningProgress;
    lastUpdated: number;
}

export interface UserPreferences {
    verbosity: 'concise' | 'balanced' | 'detailed';
    codeExamples: boolean;
    technicalDetails: boolean;
    stepByStepGuidance: boolean;
    autoFix: boolean;
}

export interface UserInteraction {
    timestamp: number;
    type: string;
    context: string;
    feedback?: 'positive' | 'negative' | 'too_verbose' | 'too_brief';
    successRate?: number;
}

export interface LearningProgress {
    conceptsLearned: string[];
    skillsAcquired: string[];
    commonMistakes: string[];
}

/**
 * Conversational UX Improvements (Req 24.8)
 */
export class ConversationalUXManager {
    async formatResponse(
        content: string,
        context: DevelopmentContext,
        options?: ResponseFormatOptions
    ): Promise<string> {
        const profile = await userAdaptation.getUserProfile(context.userId || 'default');

        let formatted = content;

        // Apply verbosity preference
        if (profile.preferences.verbosity === 'concise') {
            formatted = this.makeConcise(formatted);
        } else if (profile.preferences.verbosity === 'detailed') {
            formatted = this.makeDetailed(formatted, context);
        }

        // Add code examples if preferred
        if (profile.preferences.codeExamples && options?.includeCodeExample) {
            formatted += `\n\n${this.generateCodeExample(context)}`;
        }

        // Add step-by-step guidance if preferred
        if (profile.preferences.stepByStepGuidance && options?.includeSteps) {
            formatted += `\n\n${this.generateStepByStep(context)}`;
        }

        return formatted;
    }

    private makeConcise(content: string): string {
        // Remove verbose explanations, keep key points
        return content
            .split('\n')
            .filter(line => !line.includes('In other words') && !line.includes('To elaborate'))
            .join('\n');
    }

    private makeDetailed(content: string, _context: DevelopmentContext): string {
        // Add more context and explanations
        return `${content}\n\nFor more details, see the MCP specification documentation.`;
    }

    private generateCodeExample(_context: DevelopmentContext): string {
        return '```typescript\n// Example code\nexport const example = () => {\n  // Implementation\n};\n```';
    }

    private generateStepByStep(_context: DevelopmentContext): string {
        return '**Steps:**\n1. First step\n2. Second step\n3. Third step';
    }
}

export interface ResponseFormatOptions {
    includeCodeExample?: boolean;
    includeSteps?: boolean;
    includeTechnicalDetails?: boolean;
}

/**
 * Security and Compliance Awareness (Req 24.8)
 */
export class SecurityComplianceManager {
    async checkSecurity(code: string, context: DevelopmentContext): Promise<SecurityCheckResult> {
        const issues: SecurityIssue[] = [];

        // Check for common security issues
        if (code.includes('eval(')) {
            issues.push({
                severity: 'critical',
                type: 'dangerous-function',
                message: 'Use of eval() detected',
                recommendation: 'Avoid eval() - use safer alternatives',
                cwe: 'CWE-95'
            });
        }

        if (code.match(/password\s*=\s*["'][^"']+["']/)) {
            issues.push({
                severity: 'critical',
                type: 'hardcoded-secret',
                message: 'Hardcoded password detected',
                recommendation: 'Use environment variables for secrets',
                cwe: 'CWE-798'
            });
        }

        const score = Math.max(0, 100 - (issues.length * 20));
        const passed = issues.filter(i => i.severity === 'critical').length === 0;

        return {
            passed,
            score,
            issues,
            recommendations: issues.map(i => i.recommendation)
        };
    }

    async checkCompliance(code: string, policy: CompliancePolicy): Promise<ComplianceCheckResult> {
        const violations: ComplianceViolation[] = [];

        // Check license compliance
        if (policy.requiredLicense && !code.includes(policy.requiredLicense)) {
            violations.push({
                rule: 'license-header',
                severity: 'warning',
                message: 'Missing required license header',
                suggestion: `Add ${policy.requiredLicense} license header`
            });
        }

        // Check coding standards
        if (policy.codingStandards) {
            for (const standard of policy.codingStandards) {
                if (!this.checkStandard(code, standard)) {
                    violations.push({
                        rule: standard,
                        severity: 'info',
                        message: `Does not follow ${standard} standard`,
                        suggestion: `Review ${standard} guidelines`
                    });
                }
            }
        }

        return {
            compliant: violations.filter(v => v.severity === 'error').length === 0,
            violations,
            score: Math.max(0, 100 - (violations.length * 10))
        };
    }

    private checkStandard(_code: string, _standard: string): boolean {
        // Simplified standard checking
        return true;
    }
}

export interface SecurityCheckResult {
    passed: boolean;
    score: number;
    issues: SecurityIssue[];
    recommendations: string[];
}

export interface SecurityIssue {
    severity: 'critical' | 'high' | 'medium' | 'low';
    type: string;
    message: string;
    recommendation: string;
    cwe?: string;
}

export interface CompliancePolicy {
    requiredLicense?: string;
    codingStandards?: string[];
    forbiddenPatterns?: string[];
}

export interface ComplianceCheckResult {
    compliant: boolean;
    violations: ComplianceViolation[];
    score: number;
}

export interface ComplianceViolation {
    rule: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion: string;
}

/**
 * Transparency and Control (Req 24.8)
 */
export class TransparencyControlManager {
    async explainDecision(decision: string, reasoning: string[]): Promise<string> {
        let explanation = `**Decision:** ${decision}\n\n`;
        explanation += '**Reasoning:**\n';
        for (let i = 0; i < reasoning.length; i++) {
            explanation += `${i + 1}. ${reasoning[i]}\n`;
        }
        return explanation;
    }

    async requestUserApproval(action: string, impact: string): Promise<boolean> {
        // In a real implementation, this would prompt the user
        console.log(`Requesting approval for: ${action}`);
        console.log(`Impact: ${impact}`);
        return true; // Simulated approval
    }

    async logAction(action: ActionLog): Promise<void> {
        // Log all automated actions for transparency
        console.log(`[${new Date(action.timestamp).toISOString()}] ${action.type}: ${action.description}`);
    }
}

export interface ActionLog {
    timestamp: number;
    type: string;
    description: string;
    automated: boolean;
    userApproved: boolean;
    result: 'success' | 'failure' | 'partial';
}

/**
 * Learning and Personalization (Req 24.8)
 */
export class LearningPersonalizationSystem {
    private patterns: Map<string, LearnedPattern> = new Map();

    async learnFromSuccess(context: string, solution: string, outcome: 'success' | 'failure'): Promise<void> {
        const patternId = this.generatePatternId(context);
        let pattern = this.patterns.get(patternId);

        if (!pattern) {
            pattern = {
                id: patternId,
                context,
                solutions: [],
                successRate: 0,
                timesApplied: 0
            };
            this.patterns.set(patternId, pattern);
        }

        pattern.solutions.push({ solution, outcome, timestamp: Date.now() });
        pattern.timesApplied++;

        // Calculate success rate
        const successes = pattern.solutions.filter(s => s.outcome === 'success').length;
        pattern.successRate = successes / pattern.solutions.length;
    }

    async getSimilarPatterns(context: string): Promise<LearnedPattern[]> {
        const similar: LearnedPattern[] = [];

        for (const pattern of this.patterns.values()) {
            const similarity = this.calculateSimilarity(context, pattern.context);
            if (similarity > 0.7) {
                similar.push(pattern);
            }
        }

        return similar.sort((a, b) => b.successRate - a.successRate);
    }

    private generatePatternId(context: string): string {
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
            hash = ((hash << 5) - hash) + context.charCodeAt(i);
            hash = hash & hash;
        }
        return `pattern-${Math.abs(hash)}`;
    }

    private calculateSimilarity(context1: string, context2: string): number {
        const words1 = new Set(context1.toLowerCase().split(/\s+/));
        const words2 = new Set(context2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size;
    }
}

export interface LearnedPattern {
    id: string;
    context: string;
    solutions: Array<{ solution: string; outcome: 'success' | 'failure'; timestamp: number }>;
    successRate: number;
    timesApplied: number;
}

// Global instances
export const userAdaptation = new UserAdaptationSystem();
export const conversationalUX = new ConversationalUXManager();
export const securityCompliance = new SecurityComplianceManager();
export const transparencyControl = new TransparencyControlManager();
export const learningPersonalization = new LearningPersonalizationSystem();
