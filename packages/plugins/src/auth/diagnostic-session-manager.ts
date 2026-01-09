/**
 * Diagnostic Session Manager
 * Manages temporary API keys for diagnostic sessions with scoped permissions
 * Requirements: Secure MCP-to-MCP communication for diagnostics
 */

import Database from "better-sqlite3";
import { randomBytes, createHash } from "node:crypto";
import { join } from "node:path";

/**
 * Diagnostic session configuration
 */
export interface DiagnosticSessionConfig {
  requestedBy: string; // Identity of the requesting diagnostic client (e.g., "cortexdx")
  scope: string[]; // Scoped permissions (e.g., ["read:tools", "read:resources"])
  /**
   * Session TTL in seconds
   * @minimum 60
   * @maximum 86400
   */
  duration: number;
  allowedEndpoints?: string[]; // Optional: specific endpoints allowed
  metadata?: Record<string, unknown>; // Additional context
}

/**
 * Diagnostic session information
 */
export interface DiagnosticSession {
  sessionId: string;
  apiKey: string; // Temporary API key (only returned on creation)
  requestedBy: string;
  scope: string[];
  allowedEndpoints: string[];
  expiresAt: string; // ISO 8601 timestamp
  createdAt: string; // ISO 8601 timestamp
  status: "active" | "revoked" | "expired";
  metadata?: Record<string, unknown>;
}

/**
 * Stored session (with hashed API key)
 */
interface StoredSession {
  session_id: string;
  api_key_hash: string;
  requested_by: string;
  scope_json: string;
  allowed_endpoints_json: string;
  expires_at: number; // Unix timestamp in milliseconds
  created_at: number; // Unix timestamp in milliseconds
  status: string;
  metadata_json: string | null;
  revoked_at: number | null;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  session?: DiagnosticSession;
  reason?: string;
}

/**
 * Diagnostic Session Manager
 * Handles creation, validation, and revocation of temporary diagnostic sessions
 */
export class DiagnosticSessionManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath =
      dbPath || join(process.cwd(), ".cortexdx", "diagnostic-sessions.db");
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
    this.startCleanupTimer();
  }

  /**
   * Initialize SQLite database schema
   */
  private initializeDatabase(): void {
    this.db.exec(`
            CREATE TABLE IF NOT EXISTS diagnostic_sessions (
                session_id TEXT PRIMARY KEY,
                api_key_hash TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                scope_json TEXT NOT NULL,
                allowed_endpoints_json TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                metadata_json TEXT,
                revoked_at INTEGER,
                last_used_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_api_key_hash
            ON diagnostic_sessions(api_key_hash);

            CREATE INDEX IF NOT EXISTS idx_status_expires
            ON diagnostic_sessions(status, expires_at);

            CREATE INDEX IF NOT EXISTS idx_requested_by
            ON diagnostic_sessions(requested_by);

            -- Session usage tracking
            CREATE TABLE IF NOT EXISTS session_usage (
                usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                endpoint TEXT NOT NULL,
                method TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (session_id) REFERENCES diagnostic_sessions(session_id)
            );

            CREATE INDEX IF NOT EXISTS idx_session_usage
            ON session_usage(session_id, timestamp DESC);
        `);
  }

  /**
   * Create a new diagnostic session
   */
  createSession(config: DiagnosticSessionConfig): DiagnosticSession {
    // Generate secure session ID and API key
    const sessionId = `sess_${this.generateSecureToken(16)}`;
    const apiKey = `diag_${this.generateSecureToken(32)}`;
    const apiKeyHash = this.hashApiKey(apiKey);

    // Calculate expiration
    const now = Date.now();
    const expiresAt = now + config.duration * 1000;

    // Default allowed endpoints
    const allowedEndpoints = config.allowedEndpoints || [
      "/mcp",
      "/health",
      "/capabilities",
      "/providers",
    ];

    // Store session
    const stmt = this.db.prepare(`
            INSERT INTO diagnostic_sessions
            (session_id, api_key_hash, requested_by, scope_json, allowed_endpoints_json,
             expires_at, created_at, status, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    stmt.run(
      sessionId,
      apiKeyHash,
      config.requestedBy,
      JSON.stringify(config.scope),
      JSON.stringify(allowedEndpoints),
      expiresAt,
      now,
      "active",
      config.metadata ? JSON.stringify(config.metadata) : null,
    );

    return {
      sessionId,
      apiKey, // Only returned on creation
      requestedBy: config.requestedBy,
      scope: config.scope,
      allowedEndpoints,
      expiresAt: new Date(expiresAt).toISOString(),
      createdAt: new Date(now).toISOString(),
      status: "active",
      metadata: config.metadata,
    };
  }

  /**
   * Validate a diagnostic session API key
   */
  validateSession(apiKey: string, endpoint?: string): SessionValidationResult {
    const apiKeyHash = this.hashApiKey(apiKey);

    const stmt = this.db.prepare(`
            SELECT * FROM diagnostic_sessions
            WHERE api_key_hash = ?
        `);

    const row = stmt.get(apiKeyHash) as StoredSession | undefined;

    if (!row) {
      return {
        valid: false,
        reason: "Invalid diagnostic session key",
      };
    }

    // Check expiration
    if (row.expires_at < Date.now()) {
      // Auto-expire
      this.expireSession(row.session_id);
      return {
        valid: false,
        reason: "Diagnostic session expired",
      };
    }

    // Check status
    if (row.status !== "active") {
      return {
        valid: false,
        reason: `Diagnostic session ${row.status}`,
      };
    }

    // Parse session data
    const scope = JSON.parse(row.scope_json) as string[];
    const allowedEndpoints = JSON.parse(row.allowed_endpoints_json) as string[];

    // Check endpoint permissions
    if (endpoint && !this.isEndpointAllowed(endpoint, allowedEndpoints)) {
      return {
        valid: false,
        reason: `Endpoint ${endpoint} not allowed for this diagnostic session`,
      };
    }

    // Update last used timestamp
    this.updateLastUsed(row.session_id);

    return {
      valid: true,
      session: {
        sessionId: row.session_id,
        apiKey: "", // Never return the actual key
        requestedBy: row.requested_by,
        scope,
        allowedEndpoints,
        expiresAt: new Date(row.expires_at).toISOString(),
        createdAt: new Date(row.created_at).toISOString(),
        status: row.status as "active" | "revoked" | "expired",
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      },
    };
  }

  /**
   * Revoke a diagnostic session
   */
  revokeSession(sessionId: string): boolean {
    const stmt = this.db.prepare(`
            UPDATE diagnostic_sessions
            SET status = 'revoked', revoked_at = ?
            WHERE session_id = ? AND status = 'active'
        `);

    const result = stmt.run(Date.now(), sessionId);
    return result.changes > 0;
  }

  /**
   * Get session information (without API key)
   */
  getSession(sessionId: string): DiagnosticSession | null {
    const stmt = this.db.prepare(`
            SELECT * FROM diagnostic_sessions
            WHERE session_id = ?
        `);

    const row = stmt.get(sessionId) as StoredSession | undefined;

    if (!row) {
      return null;
    }

    return {
      sessionId: row.session_id,
      apiKey: "", // Never expose the actual key
      requestedBy: row.requested_by,
      scope: JSON.parse(row.scope_json),
      allowedEndpoints: JSON.parse(row.allowed_endpoints_json),
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      status: row.status as "active" | "revoked" | "expired",
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    };
  }

  /**
   * List all sessions for a requester
   */
  listSessions(
    requestedBy: string,
    status?: "active" | "revoked" | "expired",
  ): DiagnosticSession[] {
    let query = `
            SELECT * FROM diagnostic_sessions
            WHERE requested_by = ?
        `;
    const params: (string | number)[] = [requestedBy];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as StoredSession[];

    return rows.map((row) => ({
      sessionId: row.session_id,
      apiKey: "",
      requestedBy: row.requested_by,
      scope: JSON.parse(row.scope_json),
      allowedEndpoints: JSON.parse(row.allowed_endpoints_json),
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      status: row.status as "active" | "revoked" | "expired",
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
    }));
  }

  /**
   * Track session usage
   */
  trackUsage(
    sessionId: string,
    endpoint: string,
    method: string,
    ipAddress?: string,
    userAgent?: string,
  ): void {
    const stmt = this.db.prepare(`
            INSERT INTO session_usage
            (session_id, endpoint, method, timestamp, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

    stmt.run(
      sessionId,
      endpoint,
      method,
      Date.now(),
      ipAddress || null,
      userAgent || null,
    );
  }

  /**
   * Get session usage statistics
   */
  getSessionUsage(sessionId: string): Array<{
    endpoint: string;
    method: string;
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
  }> {
    const stmt = this.db.prepare(`
            SELECT endpoint, method, timestamp, ip_address, user_agent
            FROM session_usage
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT 100
        `);

    const rows = stmt.all(sessionId) as Array<{
      endpoint: string;
      method: string;
      timestamp: number;
      ip_address: string | null;
      user_agent: string | null;
    }>;

    return rows.map((row) => ({
      endpoint: row.endpoint,
      method: row.method,
      timestamp: new Date(row.timestamp).toISOString(),
      ipAddress: row.ip_address || undefined,
      userAgent: row.user_agent || undefined,
    }));
  }

  /**
   * Cleanup expired sessions
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();

    // Mark expired sessions
    const expireStmt = this.db.prepare(`
            UPDATE diagnostic_sessions
            SET status = 'expired'
            WHERE status = 'active' AND expires_at < ?
        `);

    const expireResult = expireStmt.run(now);

    // Delete sessions older than 30 days
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const deleteStmt = this.db.prepare(`
            DELETE FROM diagnostic_sessions
            WHERE expires_at < ?
        `);

    const deleteResult = deleteStmt.run(thirtyDaysAgo);

    return expireResult.changes + deleteResult.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.db.close();
  }

  // Private helper properties
  private cleanupTimer?: NodeJS.Timeout;

  // Private helper methods
  private startCleanupTimer(): void {
    // Run cleanup every hour
    this.cleanupTimer = setInterval(
      () => {
        try {
          const cleaned = this.cleanupExpiredSessions();
          if (cleaned > 0) {
            console.log(
              `[DiagnosticSessionManager] Cleaned up ${cleaned} expired sessions`,
            );
          }
        } catch (error) {
          console.error("[DiagnosticSessionManager] Cleanup failed:", error);
        }
      },
      60 * 60 * 1000,
    ); // 1 hour
    this.cleanupTimer.unref();
  }

  private generateSecureToken(bytes: number): string {
    return randomBytes(bytes).toString("base64url");
  }

  private hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  private isEndpointAllowed(
    endpoint: string,
    allowedEndpoints: string[],
  ): boolean {
    return allowedEndpoints.some((allowed) => {
      if (allowed.endsWith("/*")) {
        return this.matchesWildcard(endpoint, allowed);
      }
      return this.matchesExact(endpoint, allowed);
    });
  }

  private matchesWildcard(endpoint: string, pattern: string): boolean {
    // pattern is like '/api/*'
    const prefix = pattern.slice(0, -2); // Remove '/*'
    // Allow if endpoint is exactly the prefix, or starts with prefix + '/'
    return endpoint === prefix || endpoint.startsWith(prefix + "/");
  }

  private matchesExact(endpoint: string, allowed: string): boolean {
    // Allow if endpoint is exactly allowed, or starts with allowed + '/'
    return endpoint === allowed || endpoint.startsWith(allowed + "/");
  }
  private expireSession(sessionId: string): void {
    const stmt = this.db.prepare(`
            UPDATE diagnostic_sessions
            SET status = 'expired'
            WHERE session_id = ?
        `);

    stmt.run(sessionId);
  }

  private updateLastUsed(sessionId: string): void {
    const stmt = this.db.prepare(`
            UPDATE diagnostic_sessions
            SET last_used_at = ?
            WHERE session_id = ?
        `);

    stmt.run(Date.now(), sessionId);
  }
}

// Map of DiagnosticSessionManager instances keyed by dbPath
const diagnosticSessionManagers = new Map<string, DiagnosticSessionManager>();

/**
 * Get or create diagnostic session manager instance for a given dbPath
 */
export function getDiagnosticSessionManager(
  dbPath?: string,
): DiagnosticSessionManager {
  const path =
    dbPath || join(process.cwd(), ".cortexdx", "diagnostic-sessions.db");
  if (!diagnosticSessionManagers.has(path)) {
    diagnosticSessionManagers.set(path, new DiagnosticSessionManager(path));
  }
  return diagnosticSessionManagers.get(path)!;
}
