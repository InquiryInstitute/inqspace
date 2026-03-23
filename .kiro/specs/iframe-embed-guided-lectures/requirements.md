# Requirements Document: iFrame Embed for Guided Code Lectures

## Introduction

This document specifies requirements for loading **inQspace** (or a dedicated embed surface) inside a **third-party lecture page** via HTML `iframe`, so instructors can run guided code lectures in LMS pages, slide decks, or custom sites. This complements **Requirement 16** in the GitHub Classroom support spec (VS Code inside a Codespace iframe); here the focus is on **embedding the inQspace web application** or a minimal **lecture runner** that orchestrates context and navigation.

## Glossary

- **Parent page**: The top-level lecture page that hosts the iframe (e.g. LMS lesson, instructor website).
- **Embed surface**: The inQspace route or app intended for iframe use (reduced chrome, guided UX).
- **Frame ancestor**: An origin allowed to embed inQspace per Content Security Policy `frame-ancestors`.
- **Embed session**: A short-lived, scoped authorization mechanism for loading the embed surface without relying on third-party cookies inside the iframe.

## Requirements

### Requirement 1: Configurable Embed Allowlist

**User Story:** As an administrator, I want to specify which origins may embed inQspace, so that we prevent clickjacking and respect institutional LMS domains.

#### Acceptance Criteria

1. THE System SHALL send a `Content-Security-Policy` header (or equivalent) with `frame-ancestors` listing only configured allowed origins in production
2. THE System SHALL NOT use `frame-ancestors *` in production default configuration
3. WHERE embed is disabled for a course or tenant, THE System SHALL refuse framing regardless of global defaults
4. THE Instructor or Administrator SHALL be able to view or manage the allowlist for their scope per product policy

### Requirement 2: Dedicated Embed Entry Route

**User Story:** As an instructor, I want a stable URL I can paste into my lecture page iframe, so that students land on the right assignment or lecture flow.

#### Acceptance Criteria

1. THE System SHALL provide at least one embed-optimized route (e.g. `/embed/...`) that loads without requiring the full dashboard chrome
2. THE Embed surface SHALL support deep linking with query parameters for lecture or assignment context (e.g. assignment id, optional step index)
3. THE System SHALL display a clear error state when context is missing or invalid

### Requirement 3: Authentication in Embedded Context

**User Story:** As a student, I want to use inQspace inside my LMS without broken login, so that embedded mode works under modern browser cookie policies.

#### Acceptance Criteria

1. THE System SHALL support an embed authentication model that does not depend solely on third-party cookies in the iframe (e.g. signed embed token, top-level OAuth handoff, or Storage Access patterns as designed)
2. WHEN an embed token is used, THE System SHALL enforce expiration and scope (course, user, or lecture binding as specified)
3. IF authentication cannot be established in the iframe, THE System SHALL instruct the user to open inQspace in a new top-level window and preserve return context where possible

### Requirement 4: Parent–Child Communication Protocol

**User Story:** As a lecture tooling author, I want a documented `postMessage` protocol, so that the parent page can synchronize slides or steps with the embed surface.

#### Acceptance Criteria

1. THE Embed surface SHALL accept `postMessage` messages only from allowed parent origins (matching the frame-ancestors policy)
2. THE System SHALL document a versioned message schema (e.g. ready, navigate-step, error)
3. THE Embed surface SHALL ignore messages from disallowed origins

### Requirement 5: Security Boundaries for Sensitive Actions

**User Story:** As a security reviewer, I want high-risk actions protected when embedded, so that framing does not enable unintended actions.

#### Acceptance Criteria

1. WHERE configured, THE System SHALL require an explicit user gesture or confirmation for sensitive operations in embed mode (e.g. destructive repo actions, token exposure)
2. THE System SHALL NOT expose raw OAuth tokens or long-lived secrets to the parent page via `postMessage`

### Requirement 6: Coexistence with VS Code / Codespace Iframe

**User Story:** As an instructor, I want guided lectures that may show both inQspace chrome and the live IDE, so that the architecture supports nested or sibling iframes.

#### Acceptance Criteria

1. THE System design SHALL state whether the VS Code UI iframe is nested under the embed surface or loaded as a sibling iframe on the parent page
2. WHEN MCP or IDE control endpoints validate origin, THE System SHALL include lecture parent origins in the trusted set if those endpoints are invoked from the embedded flow
3. THE System SHALL maintain a single coherent threat model document for cross-origin frames (parent ↔ inQspace ↔ Codespace port URL)

### Requirement 7: Observability

**User Story:** As an operator, I want to detect embed misconfiguration, so that instructors can fix CSP or allowlist issues quickly.

#### Acceptance Criteria

1. WHEN a browser blocks framing due to CSP, THE System SHALL provide documentation for common LMS domains and troubleshooting
2. THE System SHALL log embed session creation failures (without logging secrets)

## Related Specifications

- **GitHub Classroom Support**, Requirement 16: VS Code IDE embedding and scripting (Codespace port URLs, MCP origin validation).
- **xAPI LRS integration** (sibling): optional statement emission for embed or step events.
