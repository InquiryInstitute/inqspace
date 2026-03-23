import {
  buildStatement,
  buildActor,
  statementContainsSuspiciousSecret,
  statementIdFromKey,
} from './statementBuilder';
import type { XapiDomainEvent } from './xapiEvents';

describe('statementBuilder', () => {
  const t = new Date('2020-01-01T00:00:00.000Z');
  const actor = buildActor('user-1', 'octocat');

  it('builds fork statement with IRIs and timestamp', () => {
    const ev: XapiDomainEvent = {
      type: 'assignment_forked',
      occurredAt: t,
      courseId: 'c1',
      assignmentId: 'a1',
      studentId: 'user-1',
      forkId: 'f1',
      repositoryUrl: 'https://github.com/u/r',
    };
    const s = buildStatement(ev, { primary: actor }, 'https://x.test/act');
    expect(s.actor.account.name).toBe('octocat');
    expect(s.verb.id).toContain('/verbs/forked');
    expect(s.object.id).toBe('https://x.test/act/assignment/a1');
    expect(s.timestamp).toBe(t.toISOString());
  });

  it('statementIdFromKey is stable', () => {
    expect(statementIdFromKey('k')).toBe(statementIdFromKey('k'));
    expect(statementIdFromKey('k')).not.toBe(statementIdFromKey('j'));
  });

  it('detects suspicious secret substrings', () => {
    expect(statementContainsSuspiciousSecret(JSON.stringify({ x: 'ghp_abc' }))).toBe(true);
    expect(statementContainsSuspiciousSecret(JSON.stringify({ ok: true }))).toBe(false);
  });
});
