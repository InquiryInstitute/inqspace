import { XapiPipeline } from './xapiPipeline';
import { InMemoryCourseRepository } from '../repositories/AssignmentRepository';
import { InMemoryUserRepository } from '../repositories';
import type { Course, User } from '../types/models';
import { LrsClient } from './lrsClient';

describe('XapiPipeline', () => {
  it('does not call LRS when xAPI disabled', async () => {
    const posts: unknown[] = [];
    const fetchMock: typeof fetch = async () => {
      posts.push(true);
      return new Response('{}', { status: 200 });
    };
    const courseRepo = new InMemoryCourseRepository();
    const userRepo = new InMemoryUserRepository();
    const course: Course = {
      id: 'c1',
      name: 'C',
      instructorId: 'i1',
      githubOrgName: 'o',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: { xapi: { enabled: false, lrsBaseUrl: 'https://lrs', lrsBasicUsername: 'u', lrsBasicPasswordSecret: 'p' } },
    };
    await courseRepo.create(course);
    const user: User = {
      id: 's1',
      email: 's@test',
      name: 'S',
      role: 'student',
      githubUsername: 'stu',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      enrollments: [],
    };
    await userRepo.create(user);

    const pipeline = new XapiPipeline(courseRepo, userRepo, new LrsClient(fetchMock));
    pipeline.emit({
      type: 'assignment_forked',
      occurredAt: new Date(),
      courseId: 'c1',
      assignmentId: 'a1',
      studentId: 's1',
      forkId: 'f1',
    });

    await new Promise((r) => setImmediate(r));
    expect(posts).toHaveLength(0);
  });

  it('posts when xAPI enabled', async () => {
    const posts: string[] = [];
    const fetchMock: typeof fetch = async (_url, init) => {
      posts.push((init?.body as string) || '');
      return new Response(JSON.stringify(['id']), { status: 200 });
    };
    const courseRepo = new InMemoryCourseRepository();
    const userRepo = new InMemoryUserRepository();
    const course: Course = {
      id: 'c1',
      name: 'C',
      instructorId: 'i1',
      githubOrgName: 'o',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: {
        xapi: {
          enabled: true,
          lrsBaseUrl: 'https://lrs.example',
          lrsBasicUsername: 'key',
          lrsBasicPasswordSecret: 'secret',
          activityBaseIri: 'https://act.test',
        },
      },
    };
    await courseRepo.create(course);
    await userRepo.create({
      id: 's1',
      email: 's@test',
      name: 'S',
      role: 'student',
      githubUsername: 'stu',
      createdAt: new Date(),
      lastLoginAt: new Date(),
      enrollments: [],
    });

    const pipeline = new XapiPipeline(courseRepo, userRepo, new LrsClient(fetchMock));
    pipeline.emit({
      type: 'assignment_forked',
      occurredAt: new Date(),
      courseId: 'c1',
      assignmentId: 'a1',
      studentId: 's1',
      forkId: 'f1',
    });

    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setTimeout(r, 50));
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(posts[0]!);
    expect(body.actor.objectType).toBe('Agent');
  });
});
