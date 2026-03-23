/**
 * Build xAPI 1.0.x statement objects from domain events.
 */

import { createHash } from 'crypto';
import type { XapiDomainEvent } from './xapiEvents';

const ADL = {
  submitted: 'http://adlnet.gov/expapi/verbs/submitted',
  scored: 'http://adlnet.gov/expapi/verbs/scored',
  commented: 'http://adlnet.gov/expapi/verbs/commented',
  initialized: 'http://adlnet.gov/expapi/verbs/initialized',
} as const;

export interface XapiActor {
  objectType: 'Agent';
  account: { homePage: string; name: string };
}

export interface XapiStatement {
  id: string;
  actor: XapiActor;
  verb: { id: string; display?: Record<string, string> };
  object: {
    objectType: 'Activity';
    id: string;
    definition?: { type?: string; name?: Record<string, string> };
  };
  timestamp: string;
  context?: {
    extensions?: Record<string, string | number | boolean | undefined>;
  };
  result?: {
    score?: { scaled?: number; raw?: number; min?: number; max?: number };
    success?: boolean;
    completion?: boolean;
  };
}

const DEFAULT_ACTIVITY_BASE = 'https://inqspace.local/xapi/activities';

function activityIri(base: string, kind: string, id: string): string {
  const b = base.replace(/\/$/, '');
  return `${b}/${kind}/${id}`;
}

function verbForked(base: string): string {
  return `${base.replace(/\/$/, '')}/verbs/forked`;
}

/** Deterministic statement UUID from idempotency key (xAPI requires UUID). */
export function statementIdFromKey(key: string): string {
  const hash = createHash('sha256').update(key, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildActor(userId: string, githubUsername?: string): XapiActor {
  const name = githubUsername?.trim() || userId;
  return {
    objectType: 'Agent',
    account: {
      homePage: 'https://github.com/',
      name,
    },
  };
}

export function buildStatement(
  event: XapiDomainEvent,
  actors: { primary: XapiActor },
  activityBaseIri: string
): XapiStatement {
  const base = activityBaseIri?.trim() || DEFAULT_ACTIVITY_BASE;
  const ts = event.occurredAt.toISOString();

  switch (event.type) {
    case 'assignment_forked': {
      const idem = `fork:${event.forkId}:${event.occurredAt.getTime()}`;
      return {
        id: statementIdFromKey(idem),
        actor: actors.primary,
        verb: { id: verbForked(base), display: { 'en-US': 'forked' } },
        object: {
          objectType: 'Activity',
          id: activityIri(base, 'assignment', event.assignmentId),
          definition: { name: { 'en-US': 'Assignment' } },
        },
        timestamp: ts,
        context: {
          extensions: {
            courseId: event.courseId,
            assignmentId: event.assignmentId,
            forkId: event.forkId,
            repositoryUrl: event.repositoryUrl,
          },
        },
      };
    }
    case 'assignment_submitted': {
      const idem = `submit:${event.submissionId}`;
      return {
        id: statementIdFromKey(idem),
        actor: actors.primary,
        verb: { id: ADL.submitted, display: { 'en-US': 'submitted' } },
        object: {
          objectType: 'Activity',
          id: activityIri(base, 'submission', event.submissionId),
          definition: { name: { 'en-US': 'Submission' } },
        },
        timestamp: ts,
        context: {
          extensions: {
            courseId: event.courseId,
            assignmentId: event.assignmentId,
            forkId: event.forkId,
            pullRequestUrl: event.pullRequestUrl,
            pullRequestNumber: event.pullRequestNumber,
          },
        },
        result: { completion: true },
      };
    }
    case 'submission_graded': {
      const idem = `graded:${event.submissionId}:${event.gradedByUserId}:${event.score}:${event.maxScore}`;
      const scaled = event.maxScore > 0 ? event.score / event.maxScore : 0;
      return {
        id: statementIdFromKey(idem),
        actor: actors.primary,
        verb: { id: ADL.scored, display: { 'en-US': 'scored' } },
        object: {
          objectType: 'Activity',
          id: activityIri(base, 'submission', event.submissionId),
          definition: { name: { 'en-US': 'Submission' } },
        },
        timestamp: ts,
        context: {
          extensions: {
            courseId: event.courseId,
            assignmentId: event.assignmentId,
            studentId: event.studentId,
          },
        },
        result: {
          score: { scaled, raw: event.score, min: 0, max: event.maxScore },
          success: scaled >= 0.6,
          completion: true,
        },
      };
    }
    case 'feedback_added': {
      const idem = `feedback:${event.submissionId}:${event.authorId}:${event.occurredAt.getTime()}`;
      return {
        id: statementIdFromKey(idem),
        actor: actors.primary,
        verb: { id: ADL.commented, display: { 'en-US': 'commented' } },
        object: {
          objectType: 'Activity',
          id: activityIri(base, 'submission', event.submissionId),
          definition: { name: { 'en-US': 'Submission' } },
        },
        timestamp: ts,
        context: {
          extensions: {
            courseId: event.courseId,
            assignmentId: event.assignmentId,
            studentId: event.studentId,
          },
        },
      };
    }
  }
}

/** Reject statements that accidentally embed OAuth-style secrets (property test helper). */
export function statementContainsSuspiciousSecret(json: string): boolean {
  const lower = json.toLowerCase();
  return (
    lower.includes('ghp_') ||
    lower.includes('gho_') ||
    lower.includes('github_pat_') ||
    lower.includes('refresh_token') ||
    lower.includes('access_token')
  );
}
