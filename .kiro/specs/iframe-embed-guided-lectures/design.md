# Design Document: iFrame Embed for Guided Code Lectures

## Overview

Third-party **lecture pages** embed inQspace using an `<iframe src="...">`. inQspace must (1) **allow** those parents via **CSP `frame-ancestors`**, (2) **authenticate** users in a world of third-party cookie restrictions, and (3) optionally **coordinate** with the parent via **`postMessage`** for guided steps. This spec covers the **inQspace web shell**; VS Code inside Codespaces remains as in Requirement 16 of the main spec.

### Key Design Goals

1. **Explicit trust**: Only listed origins may frame inQspace in production.
2. **Embed-first auth**: Short-lived embed tokens or top-level OAuth handoff; avoid silent breakage in Safari / Chrome third-party cookie policies.
3. **Minimal attack surface**: No secret leakage over `postMessage`; validate `event.origin` on every message.
4. **Clear composition**: Document nested vs sibling iframe strategy for IDE URLs.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Parent lecture page (LMS / instructor)    │
│  ┌───────────────────────────────────────┐  │
│  │  iframe: inQspace /embed/...          │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ Optional: nested iframe           │  │  │
│  │  │ Codespace VS Code port URL        │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         postMessage (strict origin check)
```

### Composition options (decision required during implementation)

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Nested** | Embed surface hosts inner iframe to `*.app.github.dev` | Single CSP story for student; IDE same tab | GitHub port CSP must allow inQspace origin as parent |
| **B. Sibling** | Parent holds two iframes: inQspace + IDE | Simpler inQspace app | Parent must implement layout; two trust boundaries |

Default recommendation: **A (nested)** for student-facing simplicity, if GitHub forwarded-port framing allows it; otherwise **B**.

## Components

### 1. Embed configuration service

- Resolves `allowedFrameAncestors: string[]` for a course/tenant.
- Merges with environment defaults (e.g. staging only: `self`).

### 2. HTTP security middleware

- Sets `Content-Security-Policy: frame-ancestors <origins>` on HTML responses for embed routes (and optionally globally).
- Removes conflicting `X-Frame-Options: DENY` on those routes if a legacy middleware sets it.

### 3. Embed session API

`POST /api/embed/sessions` (conceptual):

- **Input**: authenticated instructor or system; `courseId`, optional `assignmentId`, `lectureId`, `returnUrl`
- **Output**: `{ embedUrl, expiresAt }` where `embedUrl` includes a signed JWT query param or path token
- **Validation**: JWT signed with server secret; claims: `sub` (user), `scope`, `exp`, `aud: 'inqspace-embed'`

### 4. Embed SPA / route

- Validates token on load; exchanges for session (server-set **first-party** cookie on inQspace host may still be third-party inside iframe—hence token-in-URL or `postMessage` bootstrap from opener).
- Renders reduced UI: assignment context, links to open full app, optional step UI.

### 5. postMessage protocol (v1)

**Parent → iframe** (examples):

```typescript
// type, version, payload
{ type: 'inqspace:navigate', version: 1, payload: { step: 3, assignmentId: '...' } }
```

**iframe → Parent**:

```typescript
{ type: 'inqspace:ready', version: 1, payload: { assignmentId: '...' } }
{ type: 'inqspace:error', version: 1, payload: { code: 'AUTH_REQUIRED' } }
```

Both sides: `if (event.origin !== ALLOWED) return;`

### 6. MCP / IDE origin allowlist (cross-spec)

When Requirement 16 MCP server validates `Origin`, extend allowed origins to include:

- inQspace production origin(s)
- Known lecture parent origins from embed configuration (if MCP is called from parent directly in sibling-iframe mode)

Avoid `*`.

## Authentication Flows

### Flow 1: Signed embed URL (MVP)

1. Student clicks link in LMS → lands on **top-level** inQspace once to establish session (if needed).
2. Instructor-generated **embed URL** with JWT opens in iframe; JWT proves right to load context without extra cookie round-trip in some deployments.
3. On JWT expiry, iframe shows “Open in new window” to refresh auth.

### Flow 2: opener handoff

1. Parent opens `window.open` to inQspace OAuth; child completes OAuth.
2. Child `postMessage`s session bootstrap to opener **only** if opener origin is allowlisted.
3. Parent passes token to iframe via first-party storage is not available cross-origin—prefer server-issued one-time code redeemable inside iframe.

Exact choice documented in implementation tasks; both flows must satisfy Requirement 3.

## Threat Model (summary)

| Threat | Mitigation |
|--------|------------|
| Clickjacking | `frame-ancestors` allowlist only |
| CSRF on embed API | SameSite cookies + CSRF tokens on POST; JWT `aud` restriction |
| Token theft via referrer | Short TTL; `Referrer-Policy: no-referrer` on embed pages |
| Malicious parent reading secrets | Never postMessage secrets; validate origin |

## Correctness Properties

### Property E1: Frame Ancestor Enforcement

*For any* HTTP response serving an embed route in production configuration, the `Content-Security-Policy` `frame-ancestors` directive should include only origins from the configured allowlist (and not `*`).

**Validates: Requirements 1.1, 1.2**

### Property E2: postMessage Origin Discrimination

*For any* `message` event handled by the embed surface, if `event.origin` is not in the allowlist, the embed surface should not change application state based on that message.

**Validates: Requirements 4.1**

### Property E3: No Secret Exfiltration via postMessage

*For any* message sent from the embed surface to the parent, the payload should not contain OAuth tokens, refresh tokens, LRS credentials, or raw GitHub PATs.

**Validates: Requirements 5.2**

### Property E4: Invalid Context Handling

*For any* request to an embed URL with missing or invalid token/context, the user should see an error state and the system should not load privileged assignment data.

**Validates: Requirements 2.3**

### Property E5: Embed Disablement

*For any* course with embed disabled, responses for embed routes should refuse framing (e.g. `frame-ancestors 'none'`) or return an error page that breaks out of iframe per policy.

**Validates: Requirements 1.3**

## Testing Strategy

- **Unit tests**: URL builder for embed sessions; JWT claim validation; postMessage handler with mocked `MessageEvent`.
- **Property tests**: Random “origins” — handler accepts iff in allowlist.
- **E2E** (optional): Playwright with two origins (mock parent + app) to verify CSP allows/denies framing.

## Related Implementation

- Main spec **Task 20.4** (iframe for code-server): applies to **VS Code** server headers, not necessarily the inQspace app shell—both must align in nested-iframe scenarios.
