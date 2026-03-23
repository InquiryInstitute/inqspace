# Implementation Plan: iFrame Embed for Guided Code Lectures

## Overview

This plan delivers an embeddable inQspace surface with CSP `frame-ancestors`, embed session issuance, parent `postMessage` protocol, and tests for properties **E1–E5**. Depends on a **web shell** (SPA or SSR) existing or being introduced alongside the current API.

## Tasks

- [ ] 1. Prerequisites — web shell baseline
  - [ ] 1.1 Add minimal web application entry (e.g. static host + routes or framework) that can set per-route response headers
  - [ ] 1.2 Ensure API and web share deployment story (same origin preferred for cookie simplicity)
  - _Requirements: 2.1_

- [ ] 2. Embed configuration
  - [ ] 2.1 Extend course/tenant metadata with `allowedFrameAncestors: string[]` and `embedEnabled: boolean`
  - [ ] 2.2 Admin/instructor API to read/update allowlist with validation (HTTPS origins only, no wildcards in v1)
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. CSP and framing middleware
  - [ ] 3.1 Apply `Content-Security-Policy: frame-ancestors ...` on embed routes based on config
  - [ ] 3.2 When embed disabled, set `frame-ancestors 'none'` or equivalent deny for embed routes
  - [ ] 3.3 Remove or override conflicting `X-Frame-Options` for embed routes
  - _Requirements: 1.1, 1.3_

- [ ] 4. Embed session and JWT
  - [ ] 4.1 Implement `POST /api/embed/sessions` (name may vary) — returns time-limited embed URL
  - [ ] 4.2 JWT claims: `sub`, `exp`, `aud`, course/assignment binding; sign with server secret
  - [ ] 4.3 Validation middleware on `/embed/*` routes
  - _Requirements: 3.1, 3.2, 2.1, 2.2_

- [ ] 5. Embed UI route
  - [ ] 5.1 Implement `/embed/lecture` or `/embed/assignment/:id` with reduced chrome
  - [ ] 5.2 Query params: `step`, `token` (or path-based token per security review)
  - [ ] 5.3 Error states for invalid/missing context
  - [ ] 5.4 `Referrer-Policy: no-referrer` (or strict) on embed pages carrying tokens
  - _Requirements: 2.2, 2.3, 3.3_

- [ ] 6. postMessage protocol
  - [ ] 6.1 Implement inbound handler with `event.origin` allowlist check
  - [ ] 6.2 Implement outbound `ready` / `error` messages to parent
  - [ ] 6.3 Version field on all messages; ignore unknown versions
  - [ ] 6.4 Document protocol in `docs/embed-postmessage.md`
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7. Sensitive actions in embed mode
  - [ ] 7.1 Flag embed context in UI; require confirmation for destructive actions (configurable)
  - _Requirements: 5.1, 5.2_

- [ ] 8. Cross-spec alignment (Requirement 16)
  - [ ] 8.1 Document chosen composition (nested vs sibling iframes) in design appendix
  - [ ] 8.2 Update MCP / IDE allowlist design so lecture origins are included when applicable
  - [ ] 8.3 Coordinate with main spec **Task 20.4** (code-server iframe headers)
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 9. Observability
  - [ ] 9.1 Structured logs for embed session create/validate failures (no secrets)
  - [ ] 9.2 Operator troubleshooting doc for CSP framing errors
  - _Requirements: 7.1, 7.2_

- [ ] 10. Property and unit tests
  - [ ] 10.1 **Property E1: Frame Ancestor Enforcement** — config → expected CSP directive string
  - **Validates: Requirements 1.1, 1.2**
  - [ ] 10.2 **Property E2: postMessage Origin Discrimination** — random origins; state changes only for allowlisted
  - **Validates: Requirement 4.1**
  - [ ] 10.3 **Property E3: No Secret Exfiltration** — outbound messages never contain token-like fields
  - **Validates: Requirement 5.2**
  - [ ] 10.4 **Property E4: Invalid Context** — bad JWT → no privileged data in API responses
  - **Validates: Requirement 2.3**
  - [ ] 10.5 **Property E5: Embed Disablement** — embed off → deny framing
  - **Validates: Requirement 1.3**

- [ ] 11. Checkpoint
  - Manual test: iframe from allowed parent origin loads; disallowed parent blocked by browser CSP.

## Notes

- Property tests: minimum **100 iterations** with `fast-check` where applicable.
- If the web shell is not ready, tasks **1** blocks others; keep API-only milestones behind a feature flag until **1** lands.
