/**
 * Loads course xAPI config, builds statements, posts to LRS without blocking callers.
 */

import type { IXapiEventSink } from './xapiSinkTypes';
import type { ICourseRepository, IUserRepository } from '../types/repositories';
import type { XapiDomainEvent } from './xapiEvents';
import { buildActor, buildStatement, statementContainsSuspiciousSecret } from './statementBuilder';
import { LrsClient, basicAuthHeader } from './lrsClient';

interface QueuedStatement {
  statement: object;
  lrsBaseUrl: string;
  authHeader: string;
  attempts: number;
}

const MAX_ATTEMPTS = 4;
const RETRY_MS = [0, 500, 2000, 8000];

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof (t as NodeJS.Timeout).unref === 'function') {
      (t as NodeJS.Timeout).unref();
    }
  });
}

export class XapiPipeline implements IXapiEventSink {
  private readonly queue: QueuedStatement[] = [];
  private processing = false;

  constructor(
    private readonly courseRepository: ICourseRepository,
    private readonly userRepository: IUserRepository,
    private readonly lrsClient: LrsClient = new LrsClient()
  ) {}

  emit(event: XapiDomainEvent): void {
    setImmediate(() => {
      void this.handleEvent(event);
    });
  }

  private async handleEvent(event: XapiDomainEvent): Promise<void> {
    const course = await this.courseRepository.findById(event.courseId);
    const cfg = course?.metadata?.xapi;
    if (!cfg?.enabled || !cfg.lrsBaseUrl || !cfg.lrsBasicUsername) {
      return;
    }

    const actorUserId =
      event.type === 'submission_graded' || event.type === 'feedback_added'
        ? event.type === 'submission_graded'
          ? event.gradedByUserId
          : event.authorId
        : event.studentId;

    const user = await this.userRepository.findById(actorUserId);
    const actor = buildActor(actorUserId, user?.githubUsername);

    const stmt = buildStatement(event, { primary: actor }, cfg.activityBaseIri || '');
    const json = JSON.stringify(stmt);
    if (statementContainsSuspiciousSecret(json)) {
      console.error('xAPI: refusing statement that matches secret heuristics');
      return;
    }

    const authHeader = basicAuthHeader(cfg.lrsBasicUsername, cfg.lrsBasicPasswordSecret);
    this.enqueue({
      statement: stmt,
      lrsBaseUrl: cfg.lrsBaseUrl,
      authHeader,
      attempts: 0,
    });
  }

  private enqueue(item: QueuedStatement): void {
    this.queue.push(item);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0]!;
        const delay = RETRY_MS[Math.min(item.attempts, RETRY_MS.length - 1)]!;
        if (delay > 0) {
          await delayMs(delay);
        }
        const result = await this.lrsClient.postStatement(
          item.lrsBaseUrl,
          item.authHeader,
          item.statement
        );
        if (result.ok) {
          this.queue.shift();
          continue;
        }
        if (result.status === 401 || result.status === 403) {
          console.error('xAPI: LRS auth error', result.status, result.body?.slice(0, 200));
          this.queue.shift();
          continue;
        }
        item.attempts += 1;
        if (item.attempts >= MAX_ATTEMPTS) {
          console.error('xAPI: giving up after retries', result.status, result.body?.slice(0, 200));
          this.queue.shift();
          continue;
        }
        await delayMs(2000);
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        void this.pump();
      }
    }
  }
}
