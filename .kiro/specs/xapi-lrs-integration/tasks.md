# Implementation Plan: xAPI / Tin Can (LRS) Integration

## Overview

This plan implements xAPI statement emission from inQspace to external LRS endpoints, with configuration, non-blocking delivery, and tests aligned to design properties **X1–X6**.

## Tasks

- [ ] 1. Data model and configuration
  - [ ] 1.1 Add types for LRS configuration and `XapiDomainEvent` (or equivalent) in `src/types`
  - [ ] 1.2 Extend course/tenant metadata persistence with encrypted LRS fields (`lrsBaseUrl`, auth, `enabled`, `activityBaseIri`)
  - [ ] 1.3 Add repository methods to load LRS config by scope
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Statement builder
  - [ ] 2.1 Implement pure function(s) mapping each `XapiDomainEvent` type to xAPI 1.0.x JSON (`actor`, `verb`, `object`, `timestamp`, optional `context`, `result`)
  - [ ] 2.2 Centralize activity IRI and verb IRI constants
  - [ ] 2.3 Add unit tests with fixed `Date` for golden JSON snapshots
  - _Requirements: 2.5, 5.1, 5.2, 5.3, 7.1_

- [ ] 3. LRS HTTP client
  - [ ] 3.1 Implement POST to configured statements endpoint with Basic auth
  - [ ] 3.2 Map HTTP status to retry vs permanent failure
  - [ ] 3.3 Unit tests with mocked `fetch` / HTTP client
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 4. XapiPipeline and event sink
  - [ ] 4.1 Define `IXapiEventSink` with no-op default in DI container
  - [ ] 4.2 Implement pipeline: load config → if disabled return → build statement → enqueue/deliver
  - [ ] 4.3 Wire sink into `AssignmentService` (fork), `GradingService` (submit, grade, feedback) after successful persistence
  - _Requirements: 2.1–2.4, 4.1, 4.2_

- [ ] 5. Outbox and retry
  - [ ] 5.1 Implement in-memory queue with exponential backoff (development milestone)
  - [ ] 5.2 Implement persistent outbox schema and worker (production milestone)
  - [ ] 5.3 Add idempotency key generation per event type
  - _Requirements: 4.2, 4.3_

- [ ] 6. Admin / instructor API (optional scope)
  - [ ] 6.1 `PUT /api/courses/:id/xapi-config` (or similar) with validation
  - [ ] 6.2 Mask secrets on read; never return decrypted password in JSON
  - _Requirements: 1.1, 1.2_

- [ ] 7. Property and unit tests
  - [ ] 7.1 **Property X1: Emission Gating** — randomized events with config on/off → HTTP mock called iff enabled
  - **Validates: Requirements 1.3, 1.4**
  - [ ] 7.2 **Property X2: Primary Operation Independence** — LRS throws → business method still resolves
  - **Validates: Requirement 4.1**
  - [ ] 7.3 **Property X3: Statement Schema Minimality** — random valid events produce statements with required fields and IRI verbs/objects
  - **Validates: Requirements 5.1, 5.3**
  - [ ] 7.4 **Property X4: Secret Exclusion** — serialized statements never contain known secret patterns
  - **Validates: Requirement 7.2**
  - [ ] 7.5 Unit tests for actor mapping (GitHub username vs internal id)
  - _Requirements: 3.1, 3.2_

- [ ] 8. Documentation
  - [ ] 8.1 Document PII fields and verb mapping in `docs/` or README section
  - _Requirements: 3.3_

- [ ] 9. Checkpoint
  - Ensure all new tests pass; run full `npm test`.

## Notes

- Property tests: minimum **100 iterations** with `fast-check` per project convention.
- Phase delivery: tasks **1–4** and **7** can form MVP; **5** persistent outbox before production.
