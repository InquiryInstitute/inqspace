# Requirements Document: xAPI / Tin Can (LRS) Integration

## Introduction

This document specifies requirements for emitting **Experience API (xAPI)** statements from inQspace to external **Learning Record Stores (LRS)**. Tin Can API refers to the same interoperability standard. The goal is to let institutions aggregate learning analytics from assignment lifecycle events (fork, submit, grade, feedback) alongside other LMS data.

## Glossary

- **xAPI**: Standard format for learning experience statements (actor, verb, object, context, result, timestamp).
- **LRS**: Learning Record Store; HTTP endpoint that accepts and stores xAPI statements.
- **Statement**: A single xAPI record describing one learning event.
- **Activity**: The thing being experienced (typically identified by an IRI); e.g. an assignment or course.
- **Verb**: The action taken; identified by an IRI (often from ADL or a custom namespace).
- **inQspace**: The GitHub Classroom–style platform (see main product spec).

## Requirements

### Requirement 1: LRS Configuration per Scope

**User Story:** As an administrator or instructor, I want to configure an LRS endpoint and credentials for a course or organization, so that statements are delivered to our institutional analytics system.

#### Acceptance Criteria

1. THE System SHALL allow storage of an LRS base URL and authentication credentials associated with a configurable scope (e.g. course or tenant)
2. THE System SHALL encrypt LRS credentials at rest using the same security posture as other integration secrets (e.g. OAuth tokens)
3. WHERE no LRS is configured, THE System SHALL not emit statements
4. THE System SHALL support disabling xAPI emission per scope without removing stored configuration

### Requirement 2: Statement Emission for Core Learning Events

**User Story:** As an institution, I want fork, submission, grading, and feedback events recorded as xAPI statements, so that we can report on engagement and outcomes.

#### Acceptance Criteria

1. WHEN a student successfully forks an assignment, THE System SHALL emit a statement describing that event (subject to Requirement 1)
2. WHEN a student successfully submits an assignment (e.g. via pull request), THE System SHALL emit a statement with a link to submission metadata in extensions or result
3. WHEN an instructor records a grade for a submission, THE System SHALL emit a statement using a scored/completed-style verb with scaled score in `result` where applicable
4. WHEN feedback is added to a submission, THE System SHALL emit a statement describing the feedback action
5. FOR each emitted statement, THE System SHALL use stable HTTPS activity identifiers under an inQspace-controlled namespace

### Requirement 3: Actor and Privacy

**User Story:** As a privacy officer, I want actors identified with minimal PII, so that we comply with institutional policy.

#### Acceptance Criteria

1. THE System SHALL represent the `actor` using a stable identifier (e.g. `account` with homePage + unique name) rather than raw email by default
2. WHERE institutional policy requires anonymization, THE System SHALL support omitting or hashing identifiable fields in statement context
3. THE System SHALL document which fields may contain PII in emitted statements

### Requirement 4: Non-Blocking Delivery

**User Story:** As a student, I want submission and grading to succeed even if the LRS is down, so that my coursework is never blocked by analytics infrastructure.

#### Acceptance Criteria

1. WHEN emitting a statement, THE System SHALL NOT fail the primary business operation if the LRS is unreachable or returns an error
2. THE System SHALL log or queue failed deliveries for retry according to the design document
3. FOR retried statements, THE System SHALL use idempotency or deduplication keys where supported to avoid duplicate analytics records

### Requirement 5: Valid xAPI 1.0.x Payloads

**User Story:** As an LRS operator, I want conformant statements, so that our validator and reporting tools accept inQspace data.

#### Acceptance Criteria

1. THE System SHALL produce statements that validate against xAPI 1.0.x rules for required fields (actor, verb, object, timestamp)
2. THE System SHALL set `version` appropriately on statements when included
3. THE System SHALL use IRIs for verb ids and activity ids

### Requirement 6: HTTP Integration with LRS

**User Story:** As an integrator, I want standard LRS authentication patterns, so that we can connect common vendors.

#### Acceptance Criteria

1. THE System SHALL send statements to the LRS using HTTP POST to the configured statements resource (typically `/statements` relative to the LRS base URL as configured)
2. THE System SHALL support at least one authentication method (e.g. HTTP Basic with API key / secret as configured)
3. WHERE the LRS returns 401 or 403, THE System SHALL record the failure and apply backoff without blocking users

### Requirement 7: Context and Extensions

**User Story:** As a data analyst, I want course, assignment, and GitHub context on statements, so that I can slice reports by course and repository.

#### Acceptance Criteria

1. FOR learning events tied to GitHub workflow, THE System SHALL include contextual extensions (e.g. course id, assignment id, repository identifiers, PR URL) where appropriate
2. THE System SHALL not place secrets (tokens, passwords) in statement context or extensions

## Related Specifications

- **GitHub Classroom Support** (parent): domain models and services that produce the events listed above.
- **iframe embed guided lectures** (sibling): optional future emission of lecture-step events via the same xAPI pipeline.
