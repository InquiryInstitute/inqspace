# Design Document: xAPI / Tin Can (LRS) Integration

## Overview

inQspace acts as an **xAPI statement producer**: when learning-relevant events occur in the application layer, the system builds conformant **xAPI 1.0.x** statements and delivers them to a configured **LRS** over HTTPS. The LRS is external; inQspace does not implement a full LRS in this feature.

### Key Design Goals

1. **Opt-in per scope**: No emission without explicit LRS configuration.
2. **Non-blocking**: Grading, submission, and fork flows never depend on LRS availability.
3. **Privacy-aware actors**: Default to `account`-style identifiers; avoid leaking email in statements unless required.
4. **Retry without duplicate chaos**: Queue + idempotency keys for at-least-once delivery semantics.

### System Boundaries

**Integrates with:**

- Existing services: `AssignmentService`, `GradingService`, and related repositories (fork, submission).
- Optional: `EnvironmentSetupService`, `SyncService` for extended verbs in later phases.

**Does not:**

- Replace in-app notifications.
- Store statements long-term (beyond a short outbox) unless implementing a local audit trail (optional future).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Application services                            │
│  AssignmentService   GradingService   (others)               │
│       │                    │                               │
│       └──────────┬─────────┘                               │
│                  ▼                                          │
│         IXapiEventSink.emit(event)   ← fire-and-forget      │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  XapiPipeline                                                │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │ Map domain  │ → │ Build stmt   │ → │ Enqueue / deliver  │ │
│  │ event → DTO │   │ (1.0.x JSON) │   │ (HTTP POST LRS)    │ │
│  └──────────────┘   └──────────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
              External LRS (HTTPS)
```

## Data Model Extensions

### LRS configuration (conceptual)

Stored alongside course/tenant metadata (exact table/column TBD with persistence layer):

| Field | Purpose |
|-------|---------|
| `lrsBaseUrl` | Base URL for API (statements path resolved relative to this) |
| `lrsAuthType` | e.g. `basic` |
| `lrsCredentialsEncrypted` | Encrypted secret material |
| `enabled` | Master switch |
| `activityBaseIri` | Prefix for generated activity ids, e.g. `https://inqspace.app/xapi/activities` |

### Domain event DTO (internal)

```typescript
// Conceptual — names may vary in implementation
type XapiDomainEventType =
  | 'assignment_forked'
  | 'assignment_submitted'
  | 'submission_graded'
  | 'feedback_added';

interface XapiDomainEvent {
  type: XapiDomainEventType;
  occurredAt: Date;
  courseId: string;
  assignmentId: string;
  studentUserId: string;
  // Optional context
  forkId?: string;
  submissionId?: string;
  pullRequestUrl?: string;
  scoreScaled?: number; // 0..1 for xAPI result.score.scaled
  maxScore?: number;
}
```

## Statement Construction

### Activity IRIs

- Course: `{activityBaseIri}/course/{courseId}`
- Assignment: `{activityBaseIri}/assignment/{assignmentId}`
- Submission: `{activityBaseIri}/submission/{submissionId}` (when available)

### Verbs (initial mapping)

| Event | Verb IRI (suggested) |
|-------|---------------------|
| Forked | Custom: `{activityBaseIri}/verbs/forked` or `http://adlnet.gov/expapi/verbs/initialized` |
| Submitted | `http://adlnet.gov/expapi/verbs/submitted` or `http://adlnet.gov/expapi/verbs/completed` (product choice) |
| Graded | `http://adlnet.gov/expapi/verbs/scored` |
| Feedback | `http://adlnet.gov/expapi/verbs/commented` |

### Actor

```json
{
  "objectType": "Agent",
  "account": {
    "homePage": "https://github.com/",
    "name": "<github_username or stable internal id>"
  }
}
```

Use internal user id in `account.name` if GitHub username is unavailable; document mapping.

### Context extensions

Include non-secret metadata: `courseId`, `assignmentId`, `repositoryFullName`, `pullRequestNumber`, etc.

## LRS Client

- **Transport**: `POST` with `Content-Type: application/json`; body is a single statement object or array per xAPI spec.
- **Auth**: Configurable Basic auth from decrypted credentials.
- **Errors**: On network/5xx, push to outbox; on 401/403, log and backoff; never throw to caller.

## Outbox and Idempotency

**Phase 1**: In-memory queue with retry (acceptable for development only).

**Phase 2 (production)**: Persistent outbox table:

- `id`, `statement_json`, `scope_id`, `created_at`, `attempt_count`, `last_error`, `idempotency_key`

**Idempotency key** suggestion: hash of `(eventType, submissionId|forkId, occurredAt bucket)` or explicit UUID stored with the business entity when the event fires.

## Service Integration Points

| Service method (conceptual) | After success | Event |
|----------------------------|---------------|-------|
| `forkAssignment` | persist fork | `assignment_forked` |
| `submitAssignment` | persist submission | `assignment_submitted` |
| `recordGrade` / equivalent | persist grade | `submission_graded` |
| `addFeedback` | persist feedback | `feedback_added` |

Inject `IXapiEventSink` via DI; default no-op implementation when xAPI disabled.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of the system. Properties bridge human-readable requirements and machine-verifiable tests.*

### Property X1: Emission Gating

*For any* learning event, if LRS configuration is disabled or missing for that event's scope, the system should not send HTTP requests to an LRS for that event.

**Validates: Requirements 1.3, 1.4**

### Property X2: Primary Operation Independence

*For any* fork, submission, grade, or feedback operation that completes successfully in persistence, the outcome should remain successful regardless of whether the LRS delivery succeeds or fails.

**Validates: Requirements 4.1**

### Property X3: Statement Schema Minimality

*For any* emitted statement, the JSON should include valid `actor`, `verb`, `object`, and ISO 8601 `timestamp`, and verb/object ids should be absolute IRIs.

**Validates: Requirements 5.1, 5.3**

### Property X4: Secret Exclusion

*For any* emitted statement, the serialized JSON should not contain OAuth access tokens, refresh tokens, or LRS credentials.

**Validates: Requirements 7.2**

### Property X5: Credential Protection at Rest

*For any* stored LRS credential configuration, raw secrets should only appear in encrypted form in the persistence layer (verified via repository tests or integration tests).

**Validates: Requirements 1.2**

### Property X6: Idempotent Retry Safety

*For any* single logical event with a fixed idempotency key, multiple delivery attempts should not create conflicting analytics semantics beyond what the LRS allows (implementation: same statement id or dedup key as designed).

**Validates: Requirements 4.3**

## Testing Strategy

- **Unit tests**: Statement builder with fixed clocks and fixtures; maps each `XapiDomainEvent` to expected JSON shape.
- **Property tests**: Random valid events → statements always parse and contain required fields; never contain forbidden substrings (token patterns).
- **Integration tests**: Mock HTTP LRS; verify POST path, headers, and that service methods complete when LRS returns 500.

## References

- [xAPI Specification](https://github.com/adlnet/xAPI-Spec) (ADL)
- ADL verb registry (common verb IRIs)
