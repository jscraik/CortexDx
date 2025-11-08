export type Severity = "info" | "minor" | "major" | "blocker";

export interface EvidencePointer {
  type: "url" | "file" | "log";
  ref: string;
  lines?: [number, number];
}

export interface FilePlanItem {
  action: "update" | "new";
  path: string;
  description?: string;
  patch?: string;
}

export type FilePlan = FilePlanItem[];

export interface CodeSample {
  language: string;
  title: string;
  snippet: string;
}

export interface Finding {
  id: string;
  area: string;
  severity: Severity;
  title: string;
  description: string;
  evidence: EvidencePointer[];
  tags?: string[];
  confidence?: number;
  recommendation?: string;
  remediation?: {
    filePlan?: FilePlan;
    steps?: string[];
    codeSamples?: CodeSample[];
  };
  // Enhanced LLM analysis fields
  llmAnalysis?: string;
  rootCause?: string;
  filesToModify?: string[];
  codeChanges?: string;
  validationSteps?: string[];
  riskLevel?: 'low' | 'medium' | 'high';
  templateId?: string;
  canAutoFix?: boolean;
  inspectorData?: unknown; // Raw Inspector data for reference
  requiresLLMAnalysis?: boolean;
  autoFixed?: boolean;
  fixEvidence?: unknown;
}

export interface SseProbeOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface SseResult {
  ok: boolean;
  reason?: string;
  firstEventMs?: number;
  heartbeatMs?: number;
  resolvedUrl?: string;
}

export interface TransportExchange {
  method: string;
  request?: unknown;
  response?: unknown;
  error?: string;
  status?: number;
  timestamp: string;
}

export interface TransportTranscript {
  sessionId?: string;
  initialize?: TransportExchange;
  exchanges: TransportExchange[];
}

export interface TransportState {
  sessionId?: string;
  transcript: () => TransportTranscript;
  headers?: () => Record<string, string>;
}

export interface GovernancePack {
  path: string;
  version?: string;
  commit?: string;
}

export interface LlmAdapter {
  complete: (prompt: string, maxTokens?: number) => Promise<string>;
}

// Enhanced LLM adapter interface with multi-backend support
export interface EnhancedLlmAdapter extends LlmAdapter {
  backend: 'ollama' | 'mlx';
  loadModel: (modelId: string) => Promise<void>;
  unloadModel: (modelId: string) => Promise<void>;
  getSupportedModels: () => Promise<string[]>;
  getModelInfo: (modelId: string) => Promise<ModelInfo>;

  // Conversational capabilities for development assistance
  startConversation: (context: ConversationContext) => Promise<ConversationId>;
  continueConversation: (id: ConversationId, message: string) => Promise<string>;
  endConversation: (id: ConversationId) => Promise<void>;

  // Specialized completion methods for different tasks
  analyzeCode: (code: string, context: string) => Promise<CodeAnalysis>;
  generateSolution: (problem: Problem, constraints: Constraints) => Promise<Solution>;
  explainError: (error: Error, context: Context) => Promise<Explanation>;
}

export type ConversationId = string;

export interface ConversationContext {
  userId?: string;
  sessionType: 'development' | 'debugging' | 'learning';
  mcpContext?: MCPContext;
  codeContext?: string;
  problemContext?: Problem;
}

export interface MCPContext {
  serverEndpoint: string;
  protocolVersion: string;
  capabilities: string[];
  configuration: Record<string, unknown>;
}

export interface CodeAnalysis {
  issues: CodeIssue[];
  suggestions: CodeSuggestion[];
  metrics: CodeMetrics;
  confidence: number;
}

export interface CodeIssue {
  type: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
  severity: Severity;
}

export interface CodeSuggestion {
  type: 'refactor' | 'optimize' | 'fix' | 'enhance';
  description: string;
  code?: string;
  confidence: number;
}

export interface CodeMetrics {
  complexity: number;
  maintainability: number;
  testability: number;
  performance: number;
}

export interface Problem {
  id: string;
  type: ProblemType;
  severity: Severity;
  description: string;
  userFriendlyDescription: string;
  context: ProblemContext;
  evidence: Evidence[];
  affectedComponents: string[];
  suggestedSolutions: RankedSolution[];
  conversationHistory?: ConversationEntry[];
  userLevel: 'beginner' | 'intermediate' | 'expert';
}

export type ProblemType = 'protocol' | 'configuration' | 'security' | 'performance' | 'integration' | 'development';

export interface ProblemContext {
  mcpVersion: string;
  serverType: string;
  environment: string;
  configuration: Record<string, unknown>;
  errorLogs: string[];
  performanceMetrics?: PerformanceMetrics;
  userInputs?: MultipleInputs;
  sessionContext?: SessionContext;
  previousAttempts?: ResolutionAttempt[];
}

export interface MultipleInputs {
  errorMessages?: string[];
  logFiles?: LogFile[];
  configurationFiles?: ConfigFile[];
  codeSnippets?: CodeSnippet[];
  format: 'json' | 'text' | 'yaml' | 'mixed';
}

export interface LogFile {
  name: string;
  content: string;
  timestamp: number;
}

export interface ConfigFile {
  name: string;
  content: string;
  format: 'json' | 'yaml' | 'toml' | 'ini';
}

export interface CodeSnippet {
  language: string;
  content: string;
  filename?: string;
}

export interface SessionContext {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  userExpertiseLevel: 'beginner' | 'intermediate' | 'expert';
  preferences: UserPreferences;
}

export interface UserPreferences {
  verbosity: 'minimal' | 'normal' | 'detailed';
  explanationStyle: 'technical' | 'conversational' | 'step-by-step';
  autoApplyFixes: boolean;
  preferredLanguage: string;
}

export interface ResolutionAttempt {
  timestamp: number;
  approach: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface Evidence {
  type: 'log' | 'metric' | 'configuration' | 'code' | 'network';
  source: string;
  data: unknown;
  timestamp: number;
  relevance: number;
}

export interface RankedSolution {
  solution: Solution;
  confidence: number;
  successLikelihood: number;
  implementationComplexity: 'low' | 'medium' | 'high';
  estimatedTime: string;
  prerequisites: string[];
}

export interface Solution {
  id: string;
  type: SolutionType;
  confidence: number;
  description: string;
  userFriendlyDescription: string;
  steps: SolutionStep[];
  codeChanges: CodeChange[];
  configChanges: ConfigChange[];
  testingStrategy: TestingStrategy;
  rollbackPlan: RollbackPlan;
  automatedFix?: AutomatedFix;
  licenseCompliance?: LicenseCompliance;
}

export type SolutionType = 'automated' | 'guided' | 'manual' | 'configuration' | 'code_generation';

export interface SolutionStep {
  order: number;
  description: string;
  userFriendlyDescription: string;
  action: Action;
  validation: ValidationCriteria;
  dependencies: string[];
  estimatedDuration: string;
  canAutomate: boolean;
}

export interface Action {
  type: 'code' | 'config' | 'command' | 'validation' | 'restart';
  target: string;
  operation: string;
  parameters: Record<string, unknown>;
}

export interface ValidationCriteria {
  type: 'test' | 'metric' | 'manual' | 'automated';
  description: string;
  expectedResult: string;
  timeout?: number;
}

export interface CodeChange {
  file: string;
  operation: 'create' | 'update' | 'delete';
  description?: string;
  content?: string;
  patch?: string;
  backup: boolean;
}

export interface ConfigChange {
  file: string;
  key: string;
  value: unknown;
  previousValue?: unknown;
  backup: boolean;
}

export interface TestingStrategy {
  type: 'unit' | 'integration' | 'e2e' | 'manual';
  tests: TestCase[];
  coverage: number;
  automated: boolean;
}

export interface TestCase {
  name: string;
  description: string;
  steps: string[];
  expectedResult: string;
  automated: boolean;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  automated: boolean;
  backupRequired: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RollbackStep {
  order: number;
  description: string;
  action: Action;
  validation: ValidationCriteria;
}

export interface AutomatedFix {
  canApplyAutomatically: boolean;
  requiresUserConfirmation: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  backupRequired: boolean;
  validationTests: ValidationTest[];
}

export interface ValidationTest {
  name: string;
  command: string;
  expectedOutput: string;
  timeout: number;
}

export interface LicenseCompliance {
  requiresLicenseCheck: boolean;
  approvedLicenses: string[];
  proprietaryContent: boolean;
  approvalRequired: boolean;
  complianceStatus: 'compliant' | 'requires_approval' | 'non_compliant';
}

export interface ConversationEntry {
  timestamp: number;
  role: 'user' | 'assistant' | 'system';
  message: string;
  context?: Record<string, unknown>;
}

export interface Constraints {
  timeLimit?: number;
  memoryLimit?: number;
  complexity: 'low' | 'medium' | 'high';
  compatibility: string[];
  security: SecurityConstraints;
  performance: PerformanceConstraints;
}

export interface SecurityConstraints {
  allowExternalCalls: boolean;
  allowFileSystem: boolean;
  allowNetworking: boolean;
  requiredPermissions: string[];
}

export interface PerformanceConstraints {
  maxResponseTime: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
  targetThroughput?: number;
}

export interface Context {
  type: 'development' | 'debugging' | 'analysis' | 'generation';
  environment: string;
  tools: string[];
  history: ContextEntry[];
  metadata: Record<string, unknown>;
}

export interface ContextEntry {
  timestamp: number;
  action: string;
  result: string;
  duration: number;
}

export interface Explanation {
  summary: string;
  details: string;
  userFriendlyExplanation: string;
  technicalDetails?: string;
  relatedConcepts: string[];
  nextSteps: string[];
  confidence: number;
}

export interface DiagnosticContext {
  endpoint: string;
  headers?: Record<string, string>;
  logger: (...args: unknown[]) => void;
  request: <T>(input: RequestInfo, init?: RequestInit) => Promise<T>;
  jsonrpc: <T>(method: string, params?: unknown) => Promise<T>;
  sseProbe: (url: string, opts?: SseProbeOptions) => Promise<SseResult>;
  governance?: GovernancePack;
  llm?: LlmAdapter | null;
  evidence: (ev: EvidencePointer) => void;
  deterministic?: boolean;
  transport?: TransportState;
}

export interface DiagnosticPlugin {
  id: string;
  title: string;
  order?: number;
  run: (ctx: DiagnosticContext) => Promise<Finding[]>;
}
// Enhanced LLM interfaces for conversational development
export interface ConversationalLlmAdapter extends LlmAdapter {
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;
  stream: (messages: ChatMessage[], options?: ChatOptions) => AsyncIterable<string>;
  getModelInfo: () => Promise<ModelInfo>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  capabilities: string[];
  contextWindow: number;
  responseTimeMs?: number;
}

// Development assistance interfaces
export interface DevelopmentContext extends DiagnosticContext {
  conversationalLlm?: ConversationalLlmAdapter;
  sessionId: string;
  userExpertiseLevel: "beginner" | "intermediate" | "expert";
  projectContext?: ProjectContext;
  conversationHistory: ChatMessage[];
}

export interface ProjectContext {
  name: string;
  type: "mcp-server" | "mcp-client" | "mcp-connector";
  language: string;
  environment?: string;
  framework?: string;
  dependencies: string[];
  configFiles: string[];
  sourceFiles: string[];
}

// Enhanced plugin interfaces
export interface DevelopmentPlugin {
  id: string;
  title: string;
  category: "diagnostic" | "development" | "conversational";
  order?: number;
  supportedLanguages?: string[];
  requiresLlm?: boolean;
  run: (ctx: DevelopmentContext) => Promise<Finding[]>;
}

export interface ConversationalPlugin extends DevelopmentPlugin {
  category: "conversational";
  initiateConversation: (ctx: DevelopmentContext, intent: string) => Promise<ConversationSession>;
  continueConversation: (session: ConversationSession, userInput: string) => Promise<ConversationResponse>;
}

export interface ConversationSession {
  id: string;
  pluginId: string;
  context: DevelopmentContext;
  state: Record<string, unknown>;
  startTime: number;
  lastActivity: number;
}

export interface ConversationResponse {
  message: string;
  actions?: ConversationAction[];
  needsInput?: boolean;
  completed?: boolean;
  session: ConversationSession;
}

export interface ConversationAction {
  type: "code_generation" | "file_creation" | "configuration" | "validation";
  description: string;
  data: unknown;
  conversationPrompt: string;
}

// MCP tool definitions for development assistance
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// License validation interfaces
export interface LicenseValidationResult {
  isValid: boolean;
  license: string;
  restrictions: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface AcademicIntegrationContext {
  provider: string;
  contentType: "research" | "citation" | "methodology";
  licenseValidation: LicenseValidationResult;
  complianceTracking: ComplianceRecord;
}

export interface ComplianceRecord {
  timestamp: number;
  provider: string;
  contentUsed: string;
  licenseStatus: string;
  approvalRequired: boolean;
  auditTrail: string[];
}

// Performance monitoring interfaces
export interface PerformanceMetrics {
  responseTimeMs: number;
  memoryUsageMb: number;
  cpuUsagePercent: number;
  llmInferenceTimeMs?: number;
  diagnosticTimeMs: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  maxResponseTimeMs: number;
  maxMemoryUsageMb: number;
  maxCpuUsagePercent: number;
  maxLlmInferenceTimeMs: number;
}
