# Storage

This directory contains persistence layer implementations for CortexDx, including pattern learning, conversation state, and diagnostic data.

## Components

### Pattern Storage

#### `pattern-storage.ts`
Interface definition for pattern storage backends.

#### `pattern-storage-sqlite.ts`
SQLite-based pattern storage with encryption support.

**Features:**
- Pattern persistence with metadata
- Success/failure tracking
- Confidence scoring
- Feedback collection
- AES-256-GCM encryption (optional)
- Automatic cleanup of old patterns

**Usage:**
```typescript
import { PatternStorageSQLite } from './pattern-storage-sqlite.js';

const storage = new PatternStorageSQLite({
  dbPath: './.cortexdx/patterns/patterns.db',
  encryptionKey: process.env.CORTEXDX_PATTERN_KEY
});

// Save a pattern
await storage.savePattern({
  id: 'pattern-123',
  pattern: { /* pattern data */ },
  metadata: {
    successCount: 5,
    failureCount: 1,
    avgConfidence: 0.85,
    tags: ['mcp', 'protocol']
  }
});

// Query patterns
const similar = await storage.queryPatterns({
  tags: ['mcp'],
  minConfidence: 0.7
});
```

**Configuration:**
```bash
CORTEXDX_PATTERN_DB=./.cortexdx/patterns/patterns.db
CORTEXDX_PATTERN_KEY=your-32-character-encryption-key
```

### Conversation Storage

#### `conversation-storage.ts`
Persistent storage for conversational development assistance sessions.

**Features:**
- Session persistence across restarts
- Message history storage
- Context preservation
- Automatic session cleanup (30 day TTL)
- Export/import functionality

**Usage:**
```typescript
import { ConversationStorage } from './conversation-storage.js';

const storage = new ConversationStorage('./.cortexdx/conversations');

// Save conversation
await storage.saveConversation({
  id: 'conv-123',
  pluginId: 'development-assistant',
  context: ctx,
  state: { /* conversation state */ },
  startTime: Date.now(),
  lastActivity: Date.now()
});

// Load conversation
const session = await storage.loadConversation('conv-123');

// Export for backup
const exported = await storage.exportConversations();
```

### Report Storage & Optimization

#### `report-optimizer.ts`
Optimizes and compresses diagnostic reports for storage.

**Features:**
- Report compression (gzip)
- Redundant data removal
- Size optimization
- Format conversion
- Cloud upload preparation

**Usage:**
```typescript
import { optimizeReport } from './report-optimizer.js';

const optimized = await optimizeReport({
  report: largeReport,
  compression: true,
  removeRedundantData: true,
  targetSizeKB: 500
});

console.log(`Reduced size: ${originalSize} -> ${optimized.size} bytes`);
```

## Storage Architecture

```
storage/
├── pattern-storage.ts          # Pattern storage interface
├── pattern-storage-sqlite.ts   # SQLite implementation
├── conversation-storage.ts     # Conversation persistence
├── report-optimizer.ts         # Report compression
└── README.md                   # This file
```

## Database Schemas

### Pattern Storage Schema

```sql
CREATE TABLE patterns (
    id TEXT PRIMARY KEY,
    pattern_data TEXT NOT NULL,      -- JSON (encrypted if key provided)
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_confidence REAL DEFAULT 0.0,
    tags TEXT,                        -- JSON array
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE pattern_feedback (
    id TEXT PRIMARY KEY,
    pattern_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,      -- 'success' | 'failure'
    context TEXT,                     -- JSON
    confidence REAL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
);

CREATE INDEX idx_patterns_confidence ON patterns(avg_confidence);
CREATE INDEX idx_patterns_updated ON patterns(updated_at);
CREATE INDEX idx_feedback_pattern ON pattern_feedback(pattern_id);
```

### Conversation Storage Schema

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    context TEXT NOT NULL,            -- JSON
    state TEXT NOT NULL,               -- JSON
    start_time INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_conversations_activity ON conversations(last_activity);
CREATE INDEX idx_conversations_plugin ON conversations(plugin_id);
```

## Encryption

### Pattern Encryption

When `CORTEXDX_PATTERN_KEY` is set, pattern data is encrypted using **AES-256-GCM**:

```typescript
// Encryption
const encrypted = encrypt(patternData, key);
// Format: iv:authTag:ciphertext (all base64)

// Decryption
const decrypted = decrypt(encrypted, key);
```

**Security Notes:**
- Use a 32-character random key
- Store key securely (environment variable or secret manager)
- Key is required for decryption - losing it means losing data
- Each encryption uses a unique IV (initialization vector)

### Generating Encryption Key

```bash
# Generate secure 32-character key
openssl rand -base64 32 | head -c 32
```

## Performance Characteristics

| Operation | SQLite (unencrypted) | SQLite (encrypted) |
|-----------|---------------------|-------------------|
| Save pattern | ~5ms | ~8ms |
| Query patterns (100) | ~15ms | ~25ms |
| Save conversation | ~3ms | N/A |
| Load conversation | ~2ms | N/A |
| Delete old patterns | ~50ms | ~50ms |

## Maintenance

### Cleanup Old Data

```typescript
// Delete patterns older than 90 days
await storage.deleteOlderThan(90 * 24 * 60 * 60 * 1000);

// Delete expired conversations (30 day TTL)
await conversationStorage.deleteOlderThan(30);
```

### Vacuum Database

```bash
# Reduce database size after deletions
sqlite3 .cortexdx/patterns/patterns.db "VACUUM;"
```

### Backup

```bash
# Backup pattern database
cp .cortexdx/patterns/patterns.db .cortexdx/patterns/patterns.db.backup

# Export conversations
# (Use ConversationStorage.exportConversations() API)
```

## Testing

```bash
pnpm test tests/pattern-storage.spec.ts
pnpm test tests/conversation-storage.spec.ts
pnpm test tests/pattern-feedback.spec.ts
```

## Related

- [Pattern Learning System](../learning/README.md)
- [RAG System](../learning/rag-system.ts)
- [State Manager](../orchestration/state-manager.ts)
- [Architecture](../../../docs/ARCHITECTURE.md#storage-architecture)
