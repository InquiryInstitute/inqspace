import { createEmbedSession, verifyEmbedToken, frameAncestorsFromCourse } from './embedSession';
import type { Course } from '../types/models';

describe('embedSession', () => {
  const secret = 'test-secret';

  it('round-trips JWT', () => {
    const { token } = createEmbedSession({
      userId: 'u1',
      courseId: 'c1',
      assignmentId: 'a1',
      secret,
      embedBaseUrl: 'https://app.test',
    });
    const p = verifyEmbedToken(token, secret);
    expect(p?.sub).toBe('u1');
    expect(p?.courseId).toBe('c1');
    expect(p?.assignmentId).toBe('a1');
  });

  it('rejects bad signature', () => {
    const { token } = createEmbedSession({
      userId: 'u1',
      courseId: 'c1',
      secret,
      embedBaseUrl: 'https://app.test',
    });
    expect(verifyEmbedToken(token.slice(0, -3) + 'xxx', secret)).toBeNull();
  });

  it('frameAncestorsFromCourse', () => {
    const course: Course = {
      id: 'c',
      name: 'n',
      instructorId: 'i',
      githubOrgName: 'o',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: {
        embed: { enabled: true, allowedFrameAncestors: ['https://a.com', 'https://b.com'] },
      },
    };
    expect(frameAncestorsFromCourse(course)).toBe('https://a.com https://b.com');
  });
});
