# Plugin Development Guide

Learn how to create custom plugins for Insula MCP to extend its diagnostic and development assistance capabilities. This guide provides comprehensive examples, API documentation, and best practices for building robust, testable plugins.

## Plugin Architecture

Insula MCP uses a plugin-based architecture where all diagnostic and development assistance features are implemented as plugins. The system supports multiple plugin types with different interfaces and capabilities.

### Plugin Types

1. **Diagnostic Plugins**: Analyze MCP servers for protocol compliance, performance, and configuration issues
2. **Development Plugins**: Generate code, provide templates, and assist with MCP implementation
3. **Conversational Plugins**: Enable interactive debugging and problem-solving sessions
4. **Security Plugins**: Scan for vulnerabilities and security best practices
5. **Performance Plugins**: Profile server performance and optimize resource usage
6. **Academic Plugins**: Integrate research validation and citation support

### Plugin Interfaces

The plugin system provides three main interfaces:

```typescript
// Basic diagnostic plugin interface
interface DiagnosticPlugin {
  id: string;
  title: string;
  order?: number;
  run: (ctx: DiagnosticContext) => Promise<Finding[]>;
}

// Enhanced development plugin interface
interface DevelopmentPlugin {
  id: string;
  title: string;
  category: "diagnostic" | "development" | "conversational";
  order?: number;
  supportedLanguages?: string[];
  requiresLlm?: boolean;
  run: (ctx: DevelopmentContext) => Promise<Finding[]>;
}

// Interactive conversational plugin interface
interface ConversationalPlugin extends DevelopmentPlugin {
  category: "conversational";
  initiateConversation: (ctx: DevelopmentContext, intent: string) => Promise<ConversationSession>;
  continueConversation: (session: ConversationSession, userInput: string) => Promise<ConversationResponse>;
}
```

## Creating Your First Plugin

### Basic Diagnostic Plugin

Here's a complete example of a diagnostic plugin that validates MCP tool definitions:

```typescript
import type { DiagnosticPlugin, DiagnosticContext, Finding } from '../types.js';

export const toolValidationPlugin: DiagnosticPlugin = {
    id: 'tool-validation',
    title: 'MCP Tool Validation',
    order: 10,
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        try {
            // Get tools from MCP server
            const result = await ctx.jsonrpc('tools/list');
            
            if (!result.tools || result.tools.length === 0) {
                findings.push({
                    id: 'tool-validation.no-tools',
                    area: 'configuration',
                    severity: 'minor',
                    title: 'No tools defined',
                    description: 'MCP server has no tools available for clients to use.',
                    evidence: [{ type: 'url', ref: ctx.endpoint }],
                    recommendation: 'Define at least one tool to provide functionality to MCP clients.',
                    confidence: 0.9
                });
                return findings;
            }
            
            // Validate each tool definition
            for (const tool of result.tools) {
                const toolFindings = await validateTool(tool, ctx);
                findings.push(...toolFindings);
            }
            
            // Add evidence for successful validation
            ctx.evidence({
                type: 'log',
                ref: `Validated ${result.tools.length} tools`
            });
            
        } catch (error) {
            findings.push({
                id: 'tool-validation.error',
                area: 'protocol',
                severity: 'major',
                title: 'Tool validation failed',
                description: `Failed to validate tools: ${(error as Error).message}`,
                evidence: [{ type: 'log', ref: 'tool-validation-error' }],
                confidence: 1.0
            });
        }
        
        return findings;
    }
};

// Helper function for tool validation
async function validateTool(tool: any, ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Validate required fields
    if (!tool.name) {
        findings.push({
            id: 'tool-validation.missing-name',
            area: 'protocol',
            severity: 'major',
            title: 'Tool missing name',
            description: 'Tool definition must include a name field.',
            evidence: [{ type: 'log', ref: `tool-${tool.name || 'unnamed'}` }],
            confidence: 1.0
        });
    }
    
    if (!tool.description) {
        findings.push({
            id: 'tool-validation.missing-description',
            area: 'usability',
            severity: 'minor',
            title: 'Tool missing description',
            description: `Tool "${tool.name}" lacks a description for users.`,
            evidence: [{ type: 'log', ref: `tool-${tool.name}` }],
            recommendation: 'Add a clear description explaining what this tool does.',
            confidence: 0.8
        });
    }
    
    // Validate input schema
    if (tool.inputSchema) {
        if (tool.inputSchema.type !== 'object') {
            findings.push({
                id: 'tool-validation.invalid-schema',
                area: 'protocol',
                severity: 'major',
                title: 'Invalid tool input schema',
                description: `Tool "${tool.name}" has invalid input schema type: ${tool.inputSchema.type}`,
                evidence: [{ type: 'log', ref: `tool-${tool.name}-schema` }],
                confidence: 1.0
            });
        }
    }
    
    return findings;
}
```

### Development Plugin Example

Here's an example of a development plugin that generates MCP server code:

```typescript
import type { DevelopmentPlugin, DevelopmentContext, Finding } from '../types.js';

export const serverGeneratorPlugin: DevelopmentPlugin = {
    id: 'server-generator',
    title: 'MCP Server Code Generator',
    category: 'development',
    order: 5,
    requiresLlm: true,
    supportedLanguages: ['typescript', 'javascript', 'python'],
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Check if LLM is available
        if (!ctx.conversationalLlm) {
            findings.push({
                id: 'server-generator.no-llm',
                area: 'development',
                severity: 'minor',
                title: 'Code generation requires LLM',
                description: 'LLM adapter not configured for code generation.',
                evidence: [{ type: 'log', ref: 'server-generator' }],
                recommendation: 'Configure an LLM adapter to enable code generation.'
            });
            return findings;
        }
        
        // Analyze project context
        if (ctx.projectContext?.type === 'mcp-server' && ctx.projectContext.sourceFiles.length === 0) {
            findings.push({
                id: 'server-generator.empty-project',
                area: 'development',
                severity: 'info',
                title: 'Empty MCP server project detected',
                description: 'No source files found in MCP server project.',
                evidence: [{ type: 'file', ref: 'project-root' }],
                recommendation: 'I can generate a complete MCP server implementation for you.',
                remediation: {
                    steps: [
                        'Define server capabilities and tools',
                        'Generate main server file with protocol handling',
                        'Create tool implementations',
                        'Add error handling and logging',
                        'Set up package.json and dependencies'
                    ],
                    filePlan: [
                        {
                            action: 'new',
                            path: 'src/server.ts',
                            description: 'Main MCP server implementation'
                        },
                        {
                            action: 'new',
                            path: 'src/tools/index.ts',
                            description: 'Tool definitions and implementations'
                        },
                        {
                            action: 'new',
                            path: 'package.json',
                            description: 'Package configuration with MCP dependencies'
                        }
                    ]
                }
            });
        }
        
        // Check for code generation requests in conversation
        const hasCodeRequest = ctx.conversationHistory.some(msg => 
            msg.role === 'user' && 
            (msg.content.includes('generate') || msg.content.includes('create server'))
        );
        
        if (hasCodeRequest) {
            findings.push({
                id: 'server-generator.request-detected',
                area: 'development',
                severity: 'info',
                title: 'Server generation request detected',
                description: 'Ready to generate MCP server code based on your requirements.',
                evidence: [{ type: 'log', ref: 'conversation-history' }],
                recommendation: 'Specify your server requirements and I\'ll generate the implementation.'
            });
        }
        
        return findings;
    }
};
```

### Conversational Plugin Example

Here's an example of an interactive debugging plugin:

```typescript
import type { ConversationalPlugin, DevelopmentContext, ConversationSession, ConversationResponse, Finding } from '../types.js';

export const interactiveDebuggerPlugin: ConversationalPlugin = {
    id: 'interactive-debugger',
    title: 'Interactive MCP Debugger',
    category: 'conversational',
    order: 1,
    requiresLlm: true,
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Check for debugging requests
        const hasDebugRequest = ctx.conversationHistory.some(msg =>
            msg.role === 'user' && 
            (msg.content.includes('debug') || msg.content.includes('error') || msg.content.includes('problem'))
        );
        
        if (hasDebugRequest) {
            findings.push({
                id: 'interactive-debugger.session-available',
                area: 'development',
                severity: 'info',
                title: 'Interactive debugging available',
                description: 'I can help debug your MCP implementation interactively.',
                evidence: [{ type: 'log', ref: 'conversation-history' }],
                recommendation: 'Start a debugging session to analyze your specific issue.'
            });
        }
        
        return findings;
    },
    
    async initiateConversation(ctx: DevelopmentContext, intent: string): Promise<ConversationSession> {
        const sessionId = `debug-${Date.now()}`;
        
        return {
            id: sessionId,
            pluginId: 'interactive-debugger',
            context: ctx,
            state: {
                intent,
                step: 'initial',
                collectedInfo: {}
            },
            startTime: Date.now(),
            lastActivity: Date.now()
        };
    },
    
    async continueConversation(session: ConversationSession, userInput: string): Promise<ConversationResponse> {
        const { state } = session;
        
        switch (state.step) {
            case 'initial':
                return {
                    message: "I'll help you debug your MCP issue. Can you describe the problem you're experiencing?",
                    needsInput: true,
                    session: {
                        ...session,
                        state: { ...state, step: 'problem-description' },
                        lastActivity: Date.now()
                    }
                };
                
            case 'problem-description':
                state.collectedInfo.problem = userInput;
                return {
                    message: "Thanks for the description. Can you share any error messages or logs?",
                    needsInput: true,
                    session: {
                        ...session,
                        state: { ...state, step: 'error-collection' },
                        lastActivity: Date.now()
                    }
                };
                
            case 'error-collection':
                state.collectedInfo.errors = userInput;
                const analysis = await this.analyzeIssue(state.collectedInfo, session.context);
                
                return {
                    message: `Based on your description, here's what I found:\n\n${analysis.diagnosis}\n\nRecommended solution:\n${analysis.solution}`,
                    actions: analysis.actions,
                    completed: true,
                    session: {
                        ...session,
                        state: { ...state, step: 'completed' },
                        lastActivity: Date.now()
                    }
                };
                
            default:
                return {
                    message: "Debugging session completed. Feel free to start a new session if you have other issues.",
                    completed: true,
                    session
                };
        }
    },
    
    async analyzeIssue(info: any, ctx: DevelopmentContext) {
        // This would use the LLM to analyze the collected information
        return {
            diagnosis: "Connection timeout detected in MCP server communication.",
            solution: "Check if the server is running and accessible on the specified port.",
            actions: [
                {
                    type: 'validation',
                    description: 'Test server connectivity',
                    data: { endpoint: ctx.endpoint }
                }
            ]
        };
    }
};
```

## Plugin API Reference

### DiagnosticContext API

The `DiagnosticContext` provides utilities for basic diagnostic plugin execution:

```typescript
interface DiagnosticContext {
    // Server endpoint being diagnosed
    endpoint: string;
    
    // Optional HTTP headers for requests
    headers?: Record<string, string>;
    
    // Logging function for debug output
    logger: (...args: unknown[]) => void;
    
    // Generic HTTP request helper
    request: <T>(input: RequestInfo, init?: RequestInit) => Promise<T>;
    
    // JSON-RPC method caller
    jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
    
    // Server-Sent Events probe utility
    sseProbe: (url: string, opts?: unknown) => Promise<SseResult>;
    
    // Governance pack for policy validation (optional)
    governance?: GovernancePack;
    
    // Basic LLM adapter for simple completions (optional)
    llm?: LlmAdapter | null;
    
    // Evidence collection for findings
    evidence: (ev: EvidencePointer) => void;
    
    // Deterministic mode flag for reproducible results
    deterministic?: boolean;
}
```

### DevelopmentContext API

The `DevelopmentContext` extends `DiagnosticContext` with development-specific capabilities:

```typescript
interface DevelopmentContext extends DiagnosticContext {
    // Enhanced LLM adapter with conversational capabilities
    conversationalLlm?: ConversationalLlmAdapter;
    
    // Unique session identifier for tracking conversations
    sessionId: string;
    
    // User's expertise level for tailored responses
    userExpertiseLevel: "beginner" | "intermediate" | "expert";
    
    // Project context information (optional)
    projectContext?: ProjectContext;
    
    // Conversation history for context-aware responses
    conversationHistory: ChatMessage[];
}
```

### ProjectContext Interface

Information about the current project being analyzed:

```typescript
interface ProjectContext {
    name: string;
    type: "mcp-server" | "mcp-client" | "mcp-connector";
    language: string;
    framework?: string;
    dependencies: string[];
    configFiles: string[];
    sourceFiles: string[];
}
```

### Finding Structure

All plugins return findings that follow this structure:

```typescript
interface Finding {
    // Unique identifier for the finding
    id: string;
    
    // Area of concern (e.g., "protocol", "security", "performance")
    area: string;
    
    // Severity level
    severity: "info" | "minor" | "major" | "blocker";
    
    // Short, descriptive title
    title: string;
    
    // Detailed description of the issue
    description: string;
    
    // Evidence supporting this finding
    evidence: EvidencePointer[];
    
    // Optional tags for categorization
    tags?: string[];
    
    // Confidence level (0.0 to 1.0)
    confidence?: number;
    
    // Recommendation for addressing the issue
    recommendation?: string;
    
    // Automated remediation options
    remediation?: {
        filePlan?: FilePlan;
        steps?: string[];
        codeSamples?: CodeSample[];
    };
}
```

### Evidence Types

Evidence provides proof and context for findings:

```typescript
interface EvidencePointer {
    type: "url" | "file" | "log";
    ref: string;
    lines?: [number, number]; // For file evidence, specific line range
}

// Examples:
ctx.evidence({ type: "url", ref: ctx.endpoint });
ctx.evidence({ type: "file", ref: "package.json", lines: [10, 15] });
ctx.evidence({ type: "log", ref: "Protocol validation completed" });
```

## Plugin Development Best Practices

### 1. Follow the ≤40 Line Rule

Keep functions small and focused, following the project's coding standards:

```typescript
// Good: Small, focused validation function
async function validateToolName(tool: any): Promise<Finding | null> {
    if (!tool.name) {
        return {
            id: 'tool.missing-name',
            area: 'protocol',
            severity: 'major',
            title: 'Tool missing name',
            description: 'Tool definition must include a name field.',
            evidence: [{ type: 'log', ref: 'tool-validation' }],
            confidence: 1.0
        };
    }
    
    if (typeof tool.name !== 'string' || tool.name.trim().length === 0) {
        return {
            id: 'tool.invalid-name',
            area: 'protocol',
            severity: 'major',
            title: 'Invalid tool name',
            description: 'Tool name must be a non-empty string.',
            evidence: [{ type: 'log', ref: 'tool-validation' }],
            confidence: 1.0
        };
    }
    
    return null;
}

// Use helper functions in main plugin logic
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const result = await ctx.jsonrpc('tools/list');
    
    for (const tool of result.tools || []) {
        const nameValidation = await validateToolName(tool);
        if (nameValidation) findings.push(nameValidation);
        
        const schemaValidation = await validateToolSchema(tool);
        if (schemaValidation) findings.push(schemaValidation);
    }
    
    return findings;
}
```

### 2. Use Named Exports Only

Follow the project's export conventions:

```typescript
// Good: Named export
export const protocolValidationPlugin: DiagnosticPlugin = {
    id: 'protocol-validation',
    title: 'MCP Protocol Validation',
    // ... implementation
};

// Bad: Default export (not allowed)
export default { ... };
```

### 3. Always Attach Evidence

Every finding must include evidence to support the diagnosis:

```typescript
// Collect different types of evidence
ctx.evidence({ type: 'url', ref: ctx.endpoint });
ctx.evidence({ type: 'log', ref: 'Protocol validation completed' });
ctx.evidence({ type: 'file', ref: 'package.json' });

// Include evidence in findings
findings.push({
    id: 'protocol.version-mismatch',
    area: 'protocol',
    severity: 'major',
    title: 'Protocol version mismatch',
    description: 'Server uses outdated protocol version',
    evidence: [
        { type: 'url', ref: ctx.endpoint },
        { type: 'log', ref: 'protocol-check' }
    ],
    confidence: 0.95
});
```

### 4. Implement Robust Error Handling

Handle all potential errors gracefully:

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
        const result = await ctx.jsonrpc('initialize');
        
        // Validate the response structure
        if (!result || typeof result !== 'object') {
            findings.push({
                id: 'protocol.invalid-response',
                area: 'protocol',
                severity: 'major',
                title: 'Invalid initialization response',
                description: 'Server returned invalid response to initialize request',
                evidence: [{ type: 'log', ref: 'initialize-response' }],
                confidence: 1.0
            });
            return findings;
        }
        
        // Continue with validation...
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        ctx.logger('Initialization failed:', errorMessage);
        
        findings.push({
            id: 'protocol.initialization-failed',
            area: 'connection',
            severity: 'blocker',
            title: 'Server initialization failed',
            description: `Failed to initialize connection: ${errorMessage}`,
            evidence: [{ type: 'log', ref: 'initialization-error' }],
            recommendation: 'Check if the server is running and accessible.',
            confidence: 0.95
        });
    }
    
    return findings;
}
```

### 5. Support Deterministic Mode

Ensure reproducible results when deterministic mode is enabled:

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Use deterministic values when required
    const timestamp = ctx.deterministic 
        ? '2024-01-01T00:00:00Z'
        : new Date().toISOString();
    
    const sessionId = ctx.deterministic
        ? 'deterministic-session-id'
        : `session-${Date.now()}-${Math.random()}`;
    
    // Use these values in findings or logging
    ctx.logger(`Analysis started at ${timestamp} (session: ${sessionId})`);
    
    return findings;
}
```

### 6. Provide Actionable Recommendations

Include specific, actionable recommendations in findings:

```typescript
findings.push({
    id: 'security.missing-auth',
    area: 'security',
    severity: 'major',
    title: 'No authentication configured',
    description: 'MCP server accepts connections without authentication.',
    evidence: [{ type: 'url', ref: ctx.endpoint }],
    recommendation: 'Implement authentication using API keys or OAuth tokens.',
    remediation: {
        steps: [
            'Add authentication middleware to your server',
            'Configure API key validation',
            'Update client configuration to include credentials',
            'Test authentication with a sample request'
        ],
        codeSamples: [
            {
                language: 'typescript',
                title: 'Add API Key Authentication',
                snippet: `
// Add to your MCP server
server.use((req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || !validateApiKey(apiKey)) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
});`
            }
        ]
    },
    confidence: 0.9
});
```

### 7. Handle LLM Integration Properly

When using LLM capabilities, handle availability and errors:

```typescript
async run(ctx: DevelopmentContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Check LLM availability
    if (!ctx.conversationalLlm) {
        findings.push({
            id: 'plugin.llm-unavailable',
            area: 'development',
            severity: 'minor',
            title: 'LLM features unavailable',
            description: 'Advanced AI features require LLM configuration.',
            evidence: [{ type: 'log', ref: 'llm-check' }],
            recommendation: 'Configure an LLM adapter to enable AI-powered analysis.'
        });
        return findings;
    }
    
    try {
        // Use LLM for analysis
        const analysis = await ctx.conversationalLlm.complete(
            'Analyze this MCP server configuration for best practices',
            { maxTokens: 500 }
        );
        
        // Process LLM response...
        
    } catch (error) {
        ctx.logger('LLM analysis failed:', error);
        findings.push({
            id: 'plugin.llm-error',
            area: 'development',
            severity: 'minor',
            title: 'AI analysis failed',
            description: 'Could not complete AI-powered analysis.',
            evidence: [{ type: 'log', ref: 'llm-error' }],
            confidence: 0.8
        });
    }
    
    return findings;
}
```

### 8. Optimize Performance

Follow performance requirements and best practices:

```typescript
async run(ctx: DiagnosticContext): Promise<Finding[]> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    
    try {
        // Perform analysis with timeout
        const analysisPromise = performAnalysis(ctx);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Analysis timeout')), 10000)
        );
        
        const result = await Promise.race([analysisPromise, timeoutPromise]);
        
        // Process results...
        
    } catch (error) {
        if (error.message === 'Analysis timeout') {
            findings.push({
                id: 'plugin.timeout',
                area: 'performance',
                severity: 'minor',
                title: 'Analysis timeout',
                description: 'Plugin analysis exceeded time limit',
                evidence: [{ type: 'log', ref: 'performance' }],
                confidence: 1.0
            });
        }
    } finally {
        const duration = Date.now() - startTime;
        ctx.logger(`Plugin completed in ${duration}ms`);
        
        // Log performance warning if needed
        if (duration > 5000) {
            ctx.logger(`Warning: Plugin took ${duration}ms (>5s threshold)`);
        }
    }
    
    return findings;
}
```

```

## Advanced Plugin Features

### LLM-Enhanced Analysis Plugins

Leverage AI capabilities for intelligent code analysis and recommendations:

```typescript
export const aiCodeAnalyzerPlugin: DevelopmentPlugin = {
    id: 'ai-code-analyzer',
    title: 'AI-Powered Code Analysis',
    category: 'development',
    requiresLlm: true,
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        if (!ctx.conversationalLlm) {
            findings.push({
                id: 'ai-analyzer.no-llm',
                area: 'development',
                severity: 'minor',
                title: 'AI analysis requires LLM',
                description: 'LLM adapter not configured for AI-powered analysis.',
                evidence: [{ type: 'log', ref: 'ai-analyzer' }],
                recommendation: 'Configure an LLM adapter to enable AI features.'
            });
            return findings;
        }
        
        try {
            // Analyze project structure
            if (ctx.projectContext?.sourceFiles.length > 0) {
                const codeAnalysis = await analyzeCodeWithAI(ctx);
                findings.push(...codeAnalysis);
            }
            
            // Analyze conversation for code improvement opportunities
            const conversationAnalysis = await analyzeConversationContext(ctx);
            findings.push(...conversationAnalysis);
            
        } catch (error) {
            ctx.logger('AI analysis failed:', error);
            findings.push({
                id: 'ai-analyzer.error',
                area: 'development',
                severity: 'minor',
                title: 'AI analysis failed',
                description: `AI analysis encountered an error: ${(error as Error).message}`,
                evidence: [{ type: 'log', ref: 'ai-error' }],
                confidence: 0.8
            });
        }
        
        return findings;
    }
};

async function analyzeCodeWithAI(ctx: DevelopmentContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Create analysis prompt
    const prompt = `
Analyze this ${ctx.projectContext?.type} project for:
1. MCP protocol compliance
2. Code quality and best practices
3. Security considerations
4. Performance optimizations

Project details:
- Language: ${ctx.projectContext?.language}
- Files: ${ctx.projectContext?.sourceFiles.length}
- Dependencies: ${ctx.projectContext?.dependencies.join(', ')}

Provide specific, actionable recommendations.
`;
    
    const analysis = await ctx.conversationalLlm!.complete(prompt, { maxTokens: 1000 });
    
    // Parse AI response and create findings
    findings.push({
        id: 'ai-analyzer.code-analysis',
        area: 'development',
        severity: 'info',
        title: 'AI Code Analysis Results',
        description: analysis,
        evidence: [{ type: 'log', ref: 'ai-analysis' }],
        tags: ['ai', 'analysis', 'recommendations'],
        confidence: 0.85
    });
    
    return findings;
}

async function analyzeConversationContext(ctx: DevelopmentContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Look for patterns in conversation that suggest specific needs
    const recentMessages = ctx.conversationHistory.slice(-5);
    const userMessages = recentMessages.filter(msg => msg.role === 'user');
    
    if (userMessages.length > 0) {
        const conversationSummary = userMessages.map(msg => msg.content).join('\n');
        
        const prompt = `
Based on this conversation, identify what the user is trying to accomplish:

${conversationSummary}

Suggest specific next steps or improvements for their MCP project.
`;
        
        const suggestions = await ctx.conversationalLlm!.complete(prompt, { maxTokens: 500 });
        
        findings.push({
            id: 'ai-analyzer.conversation-insights',
            area: 'development',
            severity: 'info',
            title: 'AI-Suggested Next Steps',
            description: suggestions,
            evidence: [{ type: 'log', ref: 'conversation-analysis' }],
            recommendation: 'Consider these AI-generated suggestions for your project.',
            confidence: 0.75
        });
    }
    
    return findings;
}
```

### Multi-Language Support Plugins

Create plugins that work across different programming languages:

```typescript
export const multiLanguageValidatorPlugin: DiagnosticPlugin = {
    id: 'multi-language-validator',
    title: 'Multi-Language MCP Validator',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        try {
            // Detect server implementation language
            const language = await detectServerLanguage(ctx);
            
            // Apply language-specific validations
            switch (language) {
                case 'typescript':
                case 'javascript':
                    findings.push(...await validateNodeMCPServer(ctx));
                    break;
                case 'python':
                    findings.push(...await validatePythonMCPServer(ctx));
                    break;
                case 'go':
                    findings.push(...await validateGoMCPServer(ctx));
                    break;
                default:
                    findings.push({
                        id: 'validator.unknown-language',
                        area: 'compatibility',
                        severity: 'minor',
                        title: 'Unknown server language',
                        description: `Could not detect server implementation language: ${language}`,
                        evidence: [{ type: 'url', ref: ctx.endpoint }],
                        recommendation: 'Ensure server follows MCP protocol specification.'
                    });
            }
            
        } catch (error) {
            findings.push({
                id: 'validator.detection-failed',
                area: 'protocol',
                severity: 'minor',
                title: 'Language detection failed',
                description: 'Could not determine server implementation language.',
                evidence: [{ type: 'log', ref: 'language-detection' }],
                confidence: 0.7
            });
        }
        
        return findings;
    }
};

async function detectServerLanguage(ctx: DiagnosticContext): Promise<string> {
    try {
        // Try to get server info
        const result = await ctx.jsonrpc('initialize');
        
        if (result.serverInfo?.name) {
            const name = result.serverInfo.name.toLowerCase();
            if (name.includes('node') || name.includes('typescript') || name.includes('javascript')) {
                return 'typescript';
            }
            if (name.includes('python') || name.includes('py')) {
                return 'python';
            }
            if (name.includes('go') || name.includes('golang')) {
                return 'go';
            }
        }
        
        // Fallback: analyze response patterns
        const tools = await ctx.jsonrpc('tools/list');
        // Language-specific patterns in tool definitions...
        
        return 'unknown';
    } catch (error) {
        return 'unknown';
    }
}

async function validateNodeMCPServer(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Node.js/TypeScript specific validations
    try {
        const result = await ctx.jsonrpc('initialize');
        
        // Check for TypeScript-specific patterns
        if (result.capabilities?.experimental?.typescript) {
            findings.push({
                id: 'node-validator.typescript-support',
                area: 'compatibility',
                severity: 'info',
                title: 'TypeScript support detected',
                description: 'Server implements TypeScript-specific MCP extensions.',
                evidence: [{ type: 'log', ref: 'typescript-detection' }],
                confidence: 0.9
            });
        }
        
        // Validate Node.js best practices
        const tools = await ctx.jsonrpc('tools/list');
        if (tools.tools?.length > 10) {
            findings.push({
                id: 'node-validator.many-tools',
                area: 'performance',
                severity: 'minor',
                title: 'Large number of tools',
                description: `Server defines ${tools.tools.length} tools. Consider grouping related functionality.`,
                evidence: [{ type: 'log', ref: 'tools-count' }],
                recommendation: 'Group related tools or implement lazy loading for better performance.',
                confidence: 0.8
            });
        }
        
    } catch (error) {
        findings.push({
            id: 'node-validator.validation-failed',
            area: 'protocol',
            severity: 'minor',
            title: 'Node.js validation failed',
            description: 'Could not complete Node.js-specific validations.',
            evidence: [{ type: 'log', ref: 'node-validation-error' }],
            confidence: 0.6
        });
    }
    
    return findings;
}

async function validatePythonMCPServer(ctx: DiagnosticContext): Promise<Finding[]> {
    // Python-specific validations...
    return [];
}

async function validateGoMCPServer(ctx: DiagnosticContext): Promise<Finding[]> {
    // Go-specific validations...
    return [];
}
```

### Performance Monitoring Plugins

Implement comprehensive performance analysis:

```typescript
export const performanceMonitorPlugin: DiagnosticPlugin = {
    id: 'performance-monitor',
    title: 'MCP Performance Monitor',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        const metrics = await collectPerformanceMetrics(ctx);
        
        // Analyze response times
        if (metrics.averageResponseTime > 1000) {
            findings.push({
                id: 'performance.slow-response',
                area: 'performance',
                severity: 'major',
                title: 'Slow server response times',
                description: `Average response time: ${metrics.averageResponseTime}ms (threshold: 1000ms)`,
                evidence: [{ type: 'log', ref: 'performance-metrics' }],
                recommendation: 'Optimize server processing or consider caching frequently requested data.',
                confidence: 0.95
            });
        }
        
        // Analyze memory usage patterns
        if (metrics.memoryUsage > 100) { // MB
            findings.push({
                id: 'performance.high-memory',
                area: 'performance',
                severity: 'minor',
                title: 'High memory usage',
                description: `Server using ${metrics.memoryUsage}MB memory`,
                evidence: [{ type: 'log', ref: 'memory-usage' }],
                recommendation: 'Monitor for memory leaks and optimize data structures.',
                confidence: 0.8
            });
        }
        
        // Check for performance best practices
        const bestPractices = await checkPerformanceBestPractices(ctx);
        findings.push(...bestPractices);
        
        return findings;
    }
};

async function collectPerformanceMetrics(ctx: DiagnosticContext) {
    const metrics = {
        averageResponseTime: 0,
        memoryUsage: 0,
        requestCount: 0
    };
    
    // Measure multiple requests
    const measurements: number[] = [];
    const testMethods = ['initialize', 'tools/list', 'resources/list'];
    
    for (const method of testMethods) {
        try {
            const start = performance.now();
            await ctx.jsonrpc(method);
            const duration = performance.now() - start;
            measurements.push(duration);
        } catch (error) {
            // Skip failed requests in performance calculation
            ctx.logger(`Performance test failed for ${method}:`, error);
        }
    }
    
    if (measurements.length > 0) {
        metrics.averageResponseTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        metrics.requestCount = measurements.length;
    }
    
    return metrics;
}

async function checkPerformanceBestPractices(ctx: DiagnosticContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    try {
        // Check if server supports batch requests
        const batchSupported = await testBatchRequestSupport(ctx);
        if (!batchSupported) {
            findings.push({
                id: 'performance.no-batch-support',
                area: 'performance',
                severity: 'minor',
                title: 'Batch requests not supported',
                description: 'Server does not support JSON-RPC batch requests for improved performance.',
                evidence: [{ type: 'log', ref: 'batch-test' }],
                recommendation: 'Implement batch request support to reduce network overhead.',
                confidence: 0.9
            });
        }
        
        // Check for caching headers
        const cacheHeaders = await checkCacheHeaders(ctx);
        if (!cacheHeaders) {
            findings.push({
                id: 'performance.no-caching',
                area: 'performance',
                severity: 'minor',
                title: 'No caching headers detected',
                description: 'Server responses lack caching headers for static resources.',
                evidence: [{ type: 'log', ref: 'cache-headers' }],
                recommendation: 'Add appropriate cache headers for static resources and tool definitions.',
                confidence: 0.7
            });
        }
        
    } catch (error) {
        ctx.logger('Performance best practices check failed:', error);
    }
    
    return findings;
}

async function testBatchRequestSupport(ctx: DiagnosticContext): Promise<boolean> {
    try {
        // Test batch request (this is a simplified example)
        const batchRequest = [
            { jsonrpc: '2.0', method: 'tools/list', id: 1 },
            { jsonrpc: '2.0', method: 'resources/list', id: 2 }
        ];
        
        const response = await ctx.request(ctx.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchRequest)
        });
        
        return Array.isArray(response);
    } catch (error) {
        return false;
    }
}

async function checkCacheHeaders(ctx: DiagnosticContext): Promise<boolean> {
    try {
        const response = await fetch(ctx.endpoint, { method: 'HEAD' });
        return response.headers.has('cache-control') || response.headers.has('etag');
    } catch (error) {
        return false;
    }
}
```

## Plugin Testing

### Unit Testing Framework

Use Vitest for comprehensive plugin testing. Follow the project's testing patterns:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DiagnosticContext, DevelopmentContext } from '../src/types.js';
import { toolValidationPlugin } from '../src/plugins/tool-validation.js';

describe('Tool Validation Plugin', () => {
    let mockContext: DiagnosticContext;
    let evidenceCollector: any[];
    
    beforeEach(() => {
        evidenceCollector = [];
        mockContext = {
            endpoint: 'http://localhost:3000',
            headers: {},
            logger: vi.fn(),
            request: vi.fn(),
            jsonrpc: vi.fn(),
            sseProbe: vi.fn(),
            evidence: vi.fn((ev) => evidenceCollector.push(ev)),
            deterministic: true
        };
    });
    
    it('should detect missing tools', async () => {
        // Mock empty tools response
        mockContext.jsonrpc = vi.fn().mockResolvedValue({ tools: [] });
        
        const findings = await toolValidationPlugin.run(mockContext);
        
        expect(findings).toHaveLength(1);
        expect(findings[0].id).toBe('tool-validation.no-tools');
        expect(findings[0].severity).toBe('minor');
        expect(findings[0].title).toBe('No tools defined');
        expect(evidenceCollector).toHaveLength(1);
    });
    
    it('should validate tool structure', async () => {
        // Mock tools with missing names
        const invalidTools = [
            { description: 'Tool without name' },
            { name: '', description: 'Tool with empty name' },
            { name: 'valid-tool', description: 'Valid tool' }
        ];
        
        mockContext.jsonrpc = vi.fn().mockResolvedValue({ tools: invalidTools });
        
        const findings = await toolValidationPlugin.run(mockContext);
        
        // Should find issues with first two tools
        const nameIssues = findings.filter(f => f.id.includes('missing-name') || f.id.includes('invalid-name'));
        expect(nameIssues).toHaveLength(2);
        
        // Should not flag the valid tool
        expect(findings.every(f => !f.description.includes('valid-tool'))).toBe(true);
    });
    
    it('should handle JSON-RPC errors gracefully', async () => {
        // Mock network error
        mockContext.jsonrpc = vi.fn().mockRejectedValue(new Error('Connection refused'));
        
        const findings = await toolValidationPlugin.run(mockContext);
        
        expect(findings).toHaveLength(1);
        expect(findings[0].id).toBe('tool-validation.error');
        expect(findings[0].severity).toBe('major');
        expect(findings[0].description).toContain('Connection refused');
    });
    
    it('should respect deterministic mode', async () => {
        mockContext.jsonrpc = vi.fn().mockResolvedValue({ tools: [] });
        
        // Run twice with deterministic mode
        const findings1 = await toolValidationPlugin.run(mockContext);
        const findings2 = await toolValidationPlugin.run(mockContext);
        
        // Results should be identical
        expect(findings1).toEqual(findings2);
    });
});
```

### Development Plugin Testing

Test development plugins with enhanced context:

```typescript
describe('Server Generator Plugin', () => {
    let mockDevContext: DevelopmentContext;
    
    beforeEach(() => {
        mockDevContext = {
            ...mockContext, // Base diagnostic context
            conversationalLlm: {
                complete: vi.fn(),
                chat: vi.fn(),
                stream: vi.fn(),
                getModelInfo: vi.fn()
            },
            sessionId: 'test-session-123',
            userExpertiseLevel: 'intermediate',
            projectContext: {
                name: 'test-mcp-server',
                type: 'mcp-server',
                language: 'typescript',
                dependencies: [],
                configFiles: ['package.json'],
                sourceFiles: []
            },
            conversationHistory: []
        };
    });
    
    it('should detect empty MCP server projects', async () => {
        const findings = await serverGeneratorPlugin.run(mockDevContext);
        
        const emptyProjectFinding = findings.find(f => f.id === 'server-generator.empty-project');
        expect(emptyProjectFinding).toBeDefined();
        expect(emptyProjectFinding?.remediation?.filePlan).toBeDefined();
        expect(emptyProjectFinding?.remediation?.steps).toHaveLength(5);
    });
    
    it('should handle missing LLM gracefully', async () => {
        mockDevContext.conversationalLlm = undefined;
        
        const findings = await serverGeneratorPlugin.run(mockDevContext);
        
        expect(findings).toHaveLength(1);
        expect(findings[0].id).toBe('server-generator.no-llm');
        expect(findings[0].recommendation).toContain('Configure an LLM adapter');
    });
    
    it('should detect code generation requests in conversation', async () => {
        mockDevContext.conversationHistory = [
            { role: 'user', content: 'Can you generate a server for me?', timestamp: Date.now() },
            { role: 'assistant', content: 'I can help with that.', timestamp: Date.now() }
        ];
        
        const findings = await serverGeneratorPlugin.run(mockDevContext);
        
        const requestFinding = findings.find(f => f.id === 'server-generator.request-detected');
        expect(requestFinding).toBeDefined();
    });
});
```

### Integration Testing

Test plugins against real MCP servers using mock servers:

```typescript
import { startMockServer, stopMockServer } from '../scripts/mock-servers/ok.js';

describe('Plugin Integration Tests', () => {
    let serverUrl: string;
    
    beforeAll(async () => {
        serverUrl = await startMockServer();
    });
    
    afterAll(async () => {
        await stopMockServer();
    });
    
    it('should work with real MCP server', async () => {
        const realContext: DiagnosticContext = {
            endpoint: serverUrl,
            headers: {},
            logger: console.log,
            request: async (input, init) => {
                const response = await fetch(input, init);
                return response.json();
            },
            jsonrpc: async (method, params) => {
                const response = await fetch(serverUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method,
                        params,
                        id: 1
                    })
                });
                const result = await response.json();
                return result.result;
            },
            sseProbe: async () => ({ ok: true }),
            evidence: () => {},
            deterministic: false
        };
        
        const findings = await toolValidationPlugin.run(realContext);
        expect(findings).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);
    });
    
    it('should handle server errors appropriately', async () => {
        // Test with broken server
        const brokenServerUrl = await startMockServer('broken-sse');
        
        const brokenContext = { ...realContext, endpoint: brokenServerUrl };
        const findings = await toolValidationPlugin.run(brokenContext);
        
        // Should detect and report server issues
        expect(findings.some(f => f.severity === 'major' || f.severity === 'blocker')).toBe(true);
        
        await stopMockServer('broken-sse');
    });
});
```

### Performance Testing

Ensure plugins meet performance requirements:

```typescript
describe('Plugin Performance', () => {
    it('should complete analysis within time limits', async () => {
        const startTime = performance.now();
        
        const findings = await toolValidationPlugin.run(mockContext);
        
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(5000); // 5 second limit
        
        // Log performance for monitoring
        console.log(`Plugin completed in ${duration.toFixed(2)}ms`);
    });
    
    it('should handle large datasets efficiently', async () => {
        // Mock server with many tools
        const manyTools = Array.from({ length: 100 }, (_, i) => ({
            name: `tool-${i}`,
            description: `Tool number ${i}`,
            inputSchema: { type: 'object', properties: {} }
        }));
        
        mockContext.jsonrpc = vi.fn().mockResolvedValue({ tools: manyTools });
        
        const startTime = performance.now();
        const findings = await toolValidationPlugin.run(mockContext);
        const duration = performance.now() - startTime;
        
        expect(duration).toBeLessThan(10000); // 10 second limit for large datasets
        expect(findings).toBeDefined();
    });
});
```

### Test Utilities

Create reusable test utilities for plugin development:

```typescript
// test-utils.ts
export function createMockDiagnosticContext(overrides: Partial<DiagnosticContext> = {}): DiagnosticContext {
    return {
        endpoint: 'http://localhost:3000',
        headers: {},
        logger: vi.fn(),
        request: vi.fn(),
        jsonrpc: vi.fn(),
        sseProbe: vi.fn().mockResolvedValue({ ok: true }),
        evidence: vi.fn(),
        deterministic: true,
        ...overrides
    };
}

export function createMockDevelopmentContext(overrides: Partial<DevelopmentContext> = {}): DevelopmentContext {
    return {
        ...createMockDiagnosticContext(),
        conversationalLlm: {
            complete: vi.fn(),
            chat: vi.fn(),
            stream: vi.fn(),
            getModelInfo: vi.fn()
        },
        sessionId: 'test-session',
        userExpertiseLevel: 'intermediate',
        conversationHistory: [],
        ...overrides
    };
}

export function expectFindingStructure(finding: any) {
    expect(finding).toHaveProperty('id');
    expect(finding).toHaveProperty('area');
    expect(finding).toHaveProperty('severity');
    expect(finding).toHaveProperty('title');
    expect(finding).toHaveProperty('description');
    expect(finding).toHaveProperty('evidence');
    expect(Array.isArray(finding.evidence)).toBe(true);
    expect(finding.evidence.length).toBeGreaterThan(0);
}

export async function runPluginWithTimeout<T>(
    pluginRun: () => Promise<T>,
    timeoutMs: number = 5000
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Plugin timeout')), timeoutMs)
    );
    
    return Promise.race([pluginRun(), timeoutPromise]);
}
```

## Plugin Registration and Configuration

### Plugin Registration

Plugins are automatically discovered and registered through the module system:

```typescript
// src/plugins/index.ts - Main plugin registry
export { toolValidationPlugin } from './tool-validation.js';
export { serverGeneratorPlugin } from './development/server-generator.js';
export { interactiveDebuggerPlugin } from './development/interactive-debugger.js';
export { performanceMonitorPlugin } from './performance-monitor.js';

// Development plugins are exported separately
export { 
    codeGenerationPlugin,
    templateGeneratorPlugin,
    testingFrameworkPlugin 
} from './development/index.js';

// Academic plugins
export {
    semanticScholarPlugin,
    arxivPlugin,
    openAlexPlugin
} from './academic/index.js';
```

### Plugin Discovery

The plugin system automatically discovers plugins based on their exports:

```typescript
// src/plugin-host.ts
import * as plugins from './plugins/index.js';
import * as developmentPlugins from './plugins/development/index.js';

export class PluginHost {
    private diagnosticPlugins: DiagnosticPlugin[] = [];
    private developmentPlugins: DevelopmentPlugin[] = [];
    
    constructor() {
        this.discoverPlugins();
    }
    
    private discoverPlugins() {
        // Discover diagnostic plugins
        for (const [name, plugin] of Object.entries(plugins)) {
            if (this.isDiagnosticPlugin(plugin)) {
                this.diagnosticPlugins.push(plugin);
            }
        }
        
        // Discover development plugins
        for (const [name, plugin] of Object.entries(developmentPlugins)) {
            if (this.isDevelopmentPlugin(plugin)) {
                this.developmentPlugins.push(plugin);
            }
        }
        
        // Sort by order
        this.diagnosticPlugins.sort((a, b) => (a.order || 100) - (b.order || 100));
        this.developmentPlugins.sort((a, b) => (a.order || 100) - (b.order || 100));
    }
}
```

### Plugin Configuration

Configure plugins through the main configuration system:

```json
{
  "plugins": {
    "tool-validation": {
      "enabled": true,
      "order": 10,
      "config": {
        "strictMode": true,
        "validateSchemas": true,
        "maxTools": 50
      }
    },
    "server-generator": {
      "enabled": true,
      "order": 5,
      "requiresLlm": true,
      "config": {
        "defaultLanguage": "typescript",
        "includeTests": true,
        "templatePath": "./templates"
      }
    },
    "performance-monitor": {
      "enabled": true,
      "order": 20,
      "config": {
        "responseTimeThreshold": 1000,
        "memoryThreshold": 100,
        "enableProfiling": false
      }
    }
  },
  "development": {
    "llmProvider": "ollama",
    "defaultExpertiseLevel": "intermediate",
    "enableConversational": true
  }
}
```

### Environment-Specific Configuration

Support different configurations for different environments:

```typescript
// config/plugin-config.ts
export interface PluginConfig {
    enabled: boolean;
    order?: number;
    config?: Record<string, unknown>;
}

export interface PluginConfiguration {
    plugins: Record<string, PluginConfig>;
    development?: {
        llmProvider?: string;
        defaultExpertiseLevel?: 'beginner' | 'intermediate' | 'expert';
        enableConversational?: boolean;
    };
}

export function loadPluginConfiguration(environment: string = 'development'): PluginConfiguration {
    const baseConfig = require('./base-config.json');
    const envConfig = require(`./config.${environment}.json`);
    
    return {
        ...baseConfig,
        ...envConfig,
        plugins: {
            ...baseConfig.plugins,
            ...envConfig.plugins
        }
    };
}
```

### Dynamic Plugin Loading

Support for loading plugins at runtime:

```typescript
export class DynamicPluginLoader {
    private loadedPlugins = new Map<string, DiagnosticPlugin | DevelopmentPlugin>();
    
    async loadPlugin(pluginPath: string): Promise<void> {
        try {
            const module = await import(pluginPath);
            
            // Look for exported plugins
            for (const [exportName, exportValue] of Object.entries(module)) {
                if (this.isValidPlugin(exportValue)) {
                    this.loadedPlugins.set(exportValue.id, exportValue);
                    console.log(`Loaded plugin: ${exportValue.id} from ${pluginPath}`);
                }
            }
        } catch (error) {
            console.error(`Failed to load plugin from ${pluginPath}:`, error);
        }
    }
    
    async loadPluginsFromDirectory(directory: string): Promise<void> {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        try {
            const files = await fs.readdir(directory);
            const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts'));
            
            for (const file of pluginFiles) {
                const fullPath = path.join(directory, file);
                await this.loadPlugin(fullPath);
            }
        } catch (error) {
            console.error(`Failed to load plugins from ${directory}:`, error);
        }
    }
    
    private isValidPlugin(obj: any): obj is DiagnosticPlugin | DevelopmentPlugin {
        return obj && 
               typeof obj === 'object' &&
               typeof obj.id === 'string' &&
               typeof obj.title === 'string' &&
               typeof obj.run === 'function';
    }
    
    getPlugin(id: string): DiagnosticPlugin | DevelopmentPlugin | undefined {
        return this.loadedPlugins.get(id);
    }
    
    getAllPlugins(): (DiagnosticPlugin | DevelopmentPlugin)[] {
        return Array.from(this.loadedPlugins.values());
    }
}
```

## Publishing Your Plugin

### Plugin Package Structure

Create a well-structured plugin package for distribution:

```
my-insula-plugin/
├── src/
│   ├── index.ts                 # Main plugin exports
│   ├── plugins/
│   │   ├── my-diagnostic.ts     # Diagnostic plugin
│   │   └── my-development.ts    # Development plugin
│   ├── types.ts                 # Plugin-specific types
│   └── utils/
│       └── helpers.ts           # Utility functions
├── tests/
│   ├── diagnostic.spec.ts       # Plugin tests
│   ├── development.spec.ts      # Development plugin tests
│   └── integration.spec.ts      # Integration tests
├── docs/
│   ├── README.md               # Plugin documentation
│   └── API.md                  # API reference
├── examples/
│   └── usage-example.ts        # Usage examples
├── package.json                # Package configuration
├── tsconfig.json              # TypeScript configuration
├── vitest.config.ts           # Test configuration
├── biome.json                 # Linting configuration
└── LICENSE                    # License file
```

### package.json Configuration

```json
{
  "name": "@myorg/insula-plugin-custom",
  "version": "1.0.0",
  "description": "Custom diagnostic and development plugins for Insula MCP",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./diagnostic": {
      "import": "./dist/plugins/my-diagnostic.js",
      "types": "./dist/plugins/my-diagnostic.d.ts"
    },
    "./development": {
      "import": "./dist/plugins/my-development.js",
      "types": "./dist/plugins/my-development.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check src tests",
    "lint:fix": "biome check --apply src tests",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "pnpm build && pnpm test && pnpm lint"
  },
  "keywords": [
    "insula-mcp",
    "mcp",
    "plugin",
    "diagnostic",
    "development",
    "model-context-protocol"
  ],
  "author": "Your Name <your.email@example.com>",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/myorg/insula-plugin-custom.git"
  },
  "bugs": {
    "url": "https://github.com/myorg/insula-plugin-custom/issues"
  },
  "homepage": "https://github.com/myorg/insula-plugin-custom#readme",
  "peerDependencies": {
    "@brainwav/insula-mcp": "^0.1.0"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^20.11.1",
    "tsup": "^8.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  },
  "engines": {
    "node": ">=20.11.1"
  }
}
```

### TypeScript Configuration

```json
{
  "extends": "@brainwav/insula-mcp/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "moduleResolution": "NodeNext",
    "module": "NodeNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "skipLibCheck": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "dist",
    "node_modules",
    "tests"
  ]
}
```

### Build Configuration (tsup.config.ts)

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/plugins/my-diagnostic.ts',
    'src/plugins/my-development.ts'
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  external: [
    '@brainwav/insula-mcp'
  ]
});
```

### Plugin Documentation Template

Create comprehensive documentation for your plugin:

```markdown
# My Custom Insula MCP Plugin

A comprehensive plugin package providing custom diagnostic and development capabilities for Insula MCP.

## Features

- **Custom Diagnostic Plugin**: Validates custom MCP server configurations
- **Development Assistant**: Generates boilerplate code for specific use cases
- **Performance Monitoring**: Tracks custom metrics and performance indicators

## Installation

```bash
npm install @myorg/insula-plugin-custom
```

## Usage

### Basic Usage

```typescript
import { myDiagnosticPlugin, myDevelopmentPlugin } from '@myorg/insula-plugin-custom';

// Plugins are automatically discovered when imported
// No additional registration required
```

### Advanced Configuration

```json
{
  "plugins": {
    "my-diagnostic": {
      "enabled": true,
      "config": {
        "strictMode": true,
        "customRules": ["rule1", "rule2"]
      }
    },
    "my-development": {
      "enabled": true,
      "requiresLlm": true,
      "config": {
        "templatePath": "./custom-templates",
        "generateTests": true
      }
    }
  }
}
```

## API Reference

### MyDiagnosticPlugin

Validates custom MCP server configurations and detects common issues.

**Configuration Options:**

- `strictMode` (boolean): Enable strict validation rules
- `customRules` (string[]): Additional validation rules to apply

**Findings:**

- `my-diagnostic.config-missing`: Missing required configuration
- `my-diagnostic.invalid-format`: Invalid configuration format
- `my-diagnostic.deprecated-usage`: Usage of deprecated features

### MyDevelopmentPlugin

Assists with code generation and development tasks.

**Configuration Options:**

- `templatePath` (string): Path to custom templates
- `generateTests` (boolean): Include test generation
- `defaultLanguage` (string): Default programming language

**Capabilities:**

- Code generation from templates
- Test suite generation
- Configuration file creation

## Examples

See the [examples](./examples) directory for complete usage examples.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `pnpm test` and `pnpm lint`
6. Submit a pull request

## License

Apache 2.0 - see [LICENSE](./LICENSE) file for details.

```

### Publishing Checklist

Before publishing your plugin:

1. **Code Quality**
   - [ ] All tests pass (`pnpm test`)
   - [ ] Linting passes (`pnpm lint`)
   - [ ] TypeScript compilation succeeds (`pnpm type-check`)
   - [ ] Build succeeds (`pnpm build`)

2. **Documentation**
   - [ ] README.md is complete and accurate
   - [ ] API documentation is up to date
   - [ ] Examples are working and tested
   - [ ] CHANGELOG.md documents changes

3. **Package Configuration**
   - [ ] package.json metadata is correct
   - [ ] Version number follows semantic versioning
   - [ ] License is specified and file is included
   - [ ] Keywords are relevant for discovery

4. **Testing**
   - [ ] Unit tests cover core functionality
   - [ ] Integration tests work with real MCP servers
   - [ ] Performance tests validate requirements
   - [ ] Tests run in CI environment

5. **Compatibility**
   - [ ] Compatible with current Insula MCP version
   - [ ] Peer dependencies are correct
   - [ ] Node.js version requirements are specified
   - [ ] Works with both diagnostic and development contexts

### Publishing Commands

```bash
# Final checks before publishing
pnpm run prepublishOnly

# Publish to npm (requires authentication)
npm publish

# Publish with specific tag
npm publish --tag beta

# Publish scoped package as public
npm publish --access public
```

## Debugging and Troubleshooting

### Plugin Debugging Techniques

Use these techniques to debug plugin issues:

```typescript
export const debuggablePlugin: DiagnosticPlugin = {
    id: 'debuggable-plugin',
    title: 'Debuggable Plugin Example',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        // Enable detailed logging in development
        const debug = process.env.NODE_ENV === 'development';
        
        if (debug) {
            ctx.logger('Plugin started with context:', {
                endpoint: ctx.endpoint,
                deterministic: ctx.deterministic,
                hasLlm: !!ctx.llm
            });
        }
        
        try {
            // Add timing information
            const startTime = performance.now();
            
            const result = await ctx.jsonrpc('tools/list');
            
            const duration = performance.now() - startTime;
            if (debug) {
                ctx.logger(`JSON-RPC call completed in ${duration.toFixed(2)}ms`);
            }
            
            // Validate response structure with detailed logging
            if (!result || typeof result !== 'object') {
                const errorDetails = {
                    received: typeof result,
                    value: result,
                    endpoint: ctx.endpoint
                };
                
                if (debug) {
                    ctx.logger('Invalid response structure:', errorDetails);
                }
                
                findings.push({
                    id: 'debug.invalid-response',
                    area: 'protocol',
                    severity: 'major',
                    title: 'Invalid response structure',
                    description: `Expected object, received ${typeof result}`,
                    evidence: [{ type: 'log', ref: JSON.stringify(errorDetails) }],
                    confidence: 1.0
                });
            }
            
        } catch (error) {
            // Detailed error logging
            const errorInfo = {
                message: (error as Error).message,
                stack: (error as Error).stack,
                endpoint: ctx.endpoint,
                timestamp: new Date().toISOString()
            };
            
            ctx.logger('Plugin error:', errorInfo);
            
            findings.push({
                id: 'debug.execution-error',
                area: 'plugin',
                severity: 'major',
                title: 'Plugin execution error',
                description: `Error: ${errorInfo.message}`,
                evidence: [{ type: 'log', ref: JSON.stringify(errorInfo) }],
                confidence: 1.0
            });
        }
        
        return findings;
    }
};
```

### Common Plugin Issues

#### Issue: Plugin Not Loading

**Symptoms:** Plugin doesn't appear in diagnostic results

**Solutions:**

1. Check plugin export syntax:

   ```typescript
   // Correct
   export const myPlugin: DiagnosticPlugin = { ... };
   
   // Incorrect
   export default { ... };
   ```

2. Verify plugin is exported from index:

   ```typescript
   // src/plugins/index.ts
   export { myPlugin } from './my-plugin.js';
   ```

3. Check plugin structure:

   ```typescript
   // Must have required fields
   const plugin = {
       id: 'unique-id',        // Required
       title: 'Plugin Title', // Required
       run: async (ctx) => [] // Required
   };
   ```

#### Issue: Context Methods Failing

**Symptoms:** `ctx.jsonrpc()` or other context methods throw errors

**Solutions:**

1. Handle network errors:

   ```typescript
   try {
       const result = await ctx.jsonrpc('method');
   } catch (error) {
       if (error.code === 'ECONNREFUSED') {
           // Handle connection refused
       } else if (error.code === 'ETIMEDOUT') {
           // Handle timeout
       }
   }
   ```

2. Validate server responses:

   ```typescript
   const result = await ctx.jsonrpc('tools/list');
   if (!result || !Array.isArray(result.tools)) {
       // Handle invalid response
   }
   ```

#### Issue: LLM Integration Problems

**Symptoms:** LLM-dependent features not working

**Solutions:**

1. Check LLM availability:

   ```typescript
   if (!ctx.conversationalLlm) {
       return [/* findings about missing LLM */];
   }
   ```

2. Handle LLM errors gracefully:

   ```typescript
   try {
       const response = await ctx.conversationalLlm.complete(prompt);
   } catch (error) {
       ctx.logger('LLM error:', error);
       // Provide fallback functionality
   }
   ```

### Performance Optimization

#### Optimize Plugin Performance

1. **Use Concurrent Operations:**

   ```typescript
   // Good: Concurrent requests
   const [tools, resources] = await Promise.all([
       ctx.jsonrpc('tools/list'),
       ctx.jsonrpc('resources/list')
   ]);
   
   // Bad: Sequential requests
   const tools = await ctx.jsonrpc('tools/list');
   const resources = await ctx.jsonrpc('resources/list');
   ```

2. **Implement Caching:**

   ```typescript
   const cache = new Map<string, any>();
   
   async function getCachedResult(key: string, fetcher: () => Promise<any>) {
       if (cache.has(key)) {
           return cache.get(key);
       }
       
       const result = await fetcher();
       cache.set(key, result);
       return result;
   }
   ```

3. **Use Timeouts:**

   ```typescript
   async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
       const timeout = new Promise<never>((_, reject) =>
           setTimeout(() => reject(new Error('Timeout')), ms)
       );
       
       return Promise.race([promise, timeout]);
   }
   ```

## Plugin Templates and Scaffolding

### Using the Plugin Template Generator

Generate plugin boilerplate using the built-in template system:

```typescript
import { generatePluginTemplate } from '../src/sdk/plugin-templates.js';

const template = generatePluginTemplate({
    metadata: {
        id: 'my-new-plugin',
        title: 'My New Plugin',
        description: 'A plugin that does something useful',
        version: '1.0.0',
        author: 'Your Name',
        category: 'diagnostic',
        tags: ['validation', 'protocol']
    },
    includeTests: true,
    includeDocumentation: true,
    language: 'typescript'
});

// template.pluginFile.content contains the generated plugin code
// template.testFile.content contains the generated test code
// template.documentationFile.content contains the generated documentation
```

### Custom Template Creation

Create your own plugin templates:

```typescript
export function createCustomTemplate(options: {
    pluginName: string;
    category: 'diagnostic' | 'development';
    features: string[];
}): string {
    return `
/**
 * ${options.pluginName}
 * Generated custom plugin template
 */

import type { ${options.category === 'diagnostic' ? 'DiagnosticPlugin, DiagnosticContext' : 'DevelopmentPlugin, DevelopmentContext'}, Finding } from '../types.js';

export const ${toCamelCase(options.pluginName)}Plugin: ${options.category === 'diagnostic' ? 'DiagnosticPlugin' : 'DevelopmentPlugin'} = {
    id: '${toKebabCase(options.pluginName)}',
    title: '${options.pluginName}',
    ${options.category === 'development' ? 'category: "development",' : ''}
    
    async run(ctx: ${options.category === 'diagnostic' ? 'DiagnosticContext' : 'DevelopmentContext'}): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        ${options.features.map(feature => generateFeatureCode(feature)).join('\n        ')}
        
        return findings;
    }
};

${options.features.map(feature => generateFeatureHelpers(feature)).join('\n\n')}
`;
}

function generateFeatureCode(feature: string): string {
    switch (feature) {
        case 'validation':
            return '// Add validation logic here\nconst validationResults = await validateConfiguration(ctx);';
        case 'performance':
            return '// Add performance monitoring here\nconst performanceMetrics = await measurePerformance(ctx);';
        case 'security':
            return '// Add security checks here\nconst securityIssues = await checkSecurity(ctx);';
        default:
            return `// Add ${feature} logic here`;
    }
}
```

## Examples and Resources

### Complete Plugin Examples

#### 1. Basic Diagnostic Plugin

```typescript
// examples/basic-diagnostic/plugin.ts
export const basicDiagnosticPlugin: DiagnosticPlugin = {
    id: 'basic-diagnostic',
    title: 'Basic MCP Diagnostic',
    
    async run(ctx: DiagnosticContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        try {
            // Check server initialization
            const initResult = await ctx.jsonrpc('initialize');
            
            if (!initResult.protocolVersion) {
                findings.push({
                    id: 'basic.no-protocol-version',
                    area: 'protocol',
                    severity: 'major',
                    title: 'Missing protocol version',
                    description: 'Server did not provide protocol version in initialization',
                    evidence: [{ type: 'url', ref: ctx.endpoint }],
                    confidence: 1.0
                });
            }
            
            // Check available capabilities
            if (!initResult.capabilities) {
                findings.push({
                    id: 'basic.no-capabilities',
                    area: 'protocol',
                    severity: 'minor',
                    title: 'No capabilities declared',
                    description: 'Server did not declare any capabilities',
                    evidence: [{ type: 'log', ref: 'initialization' }],
                    confidence: 0.9
                });
            }
            
        } catch (error) {
            findings.push({
                id: 'basic.initialization-failed',
                area: 'connection',
                severity: 'blocker',
                title: 'Server initialization failed',
                description: `Cannot initialize connection: ${(error as Error).message}`,
                evidence: [{ type: 'log', ref: 'init-error' }],
                confidence: 1.0
            });
        }
        
        return findings;
    }
};
```

#### 2. LLM-Enhanced Development Plugin

```typescript
// examples/llm-development/plugin.ts
export const llmDevelopmentPlugin: DevelopmentPlugin = {
    id: 'llm-development',
    title: 'LLM-Enhanced Development Assistant',
    category: 'development',
    requiresLlm: true,
    
    async run(ctx: DevelopmentContext): Promise<Finding[]> {
        const findings: Finding[] = [];
        
        if (!ctx.conversationalLlm) {
            findings.push({
                id: 'llm-dev.no-llm',
                area: 'development',
                severity: 'minor',
                title: 'LLM not available',
                description: 'Development assistance requires LLM configuration',
                evidence: [{ type: 'log', ref: 'llm-check' }],
                recommendation: 'Configure an LLM adapter for enhanced development features'
            });
            return findings;
        }
        
        // Analyze conversation for development needs
        const recentMessages = ctx.conversationHistory.slice(-3);
        const hasDevRequest = recentMessages.some(msg => 
            msg.role === 'user' && 
            /\b(help|generate|create|build|implement)\b/i.test(msg.content)
        );
        
        if (hasDevRequest) {
            const analysisPrompt = `
Analyze this development conversation and suggest next steps:

${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Project context: ${ctx.projectContext?.type} in ${ctx.projectContext?.language}
User level: ${ctx.userExpertiseLevel}

Provide specific, actionable suggestions.
`;
            
            try {
                const suggestions = await ctx.conversationalLlm.complete(analysisPrompt, {
                    maxTokens: 500
                });
                
                findings.push({
                    id: 'llm-dev.suggestions',
                    area: 'development',
                    severity: 'info',
                    title: 'AI Development Suggestions',
                    description: suggestions,
                    evidence: [{ type: 'log', ref: 'ai-analysis' }],
                    tags: ['ai', 'suggestions', 'development'],
                    confidence: 0.8
                });
                
            } catch (error) {
                ctx.logger('LLM analysis failed:', error);
            }
        }
        
        return findings;
    }
};
```

### Resources and Documentation

- **[API Reference](./API_REFERENCE.md)** - Complete API documentation
- **[User Guide](./USER_GUIDE.md)** - End-user documentation
- **[Contributing Guide](./CONTRIBUTING.md)** - Development guidelines
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions

### Community and Support

- **Interactive Help**: Use `insula-mcp interactive` for conversational assistance
- **GitHub Discussions**: Share plugins and get community help
- **GitHub Issues**: Report bugs and request features
- **Plugin Registry**: Discover community plugins (coming soon)

### Plugin Development Workflow

1. **Plan**: Define plugin purpose and requirements
2. **Scaffold**: Use template generator or copy existing plugin
3. **Implement**: Write plugin logic following best practices
4. **Test**: Create comprehensive test suite
5. **Document**: Write clear documentation and examples
6. **Publish**: Share with the community

### Next Steps

- Explore the [existing plugins](../src/plugins/) for inspiration
- Try the [plugin template generator](../src/sdk/plugin-templates.ts)
- Join the community discussions to share your plugins
- Contribute improvements to the plugin system
