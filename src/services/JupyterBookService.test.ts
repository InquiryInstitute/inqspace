import { JupyterBookService } from './JupyterBookService';
import { InMemoryCourseRepository, InMemoryAssignmentRepository } from '../repositories/AssignmentRepository';
import type { Course, Assignment } from '../types/models';
import { DEFAULT_JUPYTER_BOOK_PATHS } from '../types/models';

describe('JupyterBookService', () => {
  const courseRepo = new InMemoryCourseRepository();
  const assignmentRepo = new InMemoryAssignmentRepository();
  const service = new JupyterBookService(courseRepo, assignmentRepo);

  beforeEach(() => {
    courseRepo.clear();
    assignmentRepo.clear();
  });

  it('mergePaths applies course then assignment overrides', async () => {
    const course: Course = {
      id: 'c1',
      name: 'Test',
      instructorId: 'i1',
      githubOrgName: 'org',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: {
        jupyterBook: {
          enabled: true,
          paths: { contentRoot: 'src/book' },
        },
      },
    };
    await courseRepo.create(course);

    const assignment: Assignment = {
      id: 'a1',
      courseId: 'c1',
      name: 'Lab',
      repositoryName: 'lab',
      repositoryUrl: 'https://github.com/org/lab',
      devcontainerPath: '.devcontainer/devcontainer.json',
      visibility: 'private',
      allowLateSubmissions: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: {
        autoGrading: false,
        requiredFiles: [],
        starterCode: true,
        jupyterBook: {
          enabled: true,
          paths: { buildOutputDir: 'site' },
        },
      },
    };
    await assignmentRepo.create(assignment);

    const paths = service.mergePaths(course, assignment);
    expect(paths.contentRoot).toBe('src/book');
    expect(paths.buildOutputDir).toBe('site');
    expect(paths.configFile).toBe(DEFAULT_JUPYTER_BOOK_PATHS.configFile);
  });

  it('getEffectiveForAssignment respects assignment.enabled over course default', async () => {
    const course: Course = {
      id: 'c1',
      name: 'Test',
      instructorId: 'i1',
      githubOrgName: 'org',
      githubOrgId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
      archived: false,
      metadata: {
        jupyterBook: { enabled: true, pagesBaseUrl: 'https://example.com/course/' },
      },
    };
    await courseRepo.create(course);

    const assignment: Assignment = {
      id: 'a1',
      courseId: 'c1',
      name: 'Code only',
      repositoryName: 'lab',
      repositoryUrl: 'https://github.com/org/lab',
      devcontainerPath: '.devcontainer/devcontainer.json',
      visibility: 'private',
      allowLateSubmissions: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      configuration: {
        autoGrading: false,
        requiredFiles: [],
        starterCode: true,
        jupyterBook: { enabled: false },
      },
    };
    await assignmentRepo.create(assignment);

    const eff = await service.getEffectiveForAssignment('a1');
    expect(eff.enabled).toBe(false);
    expect(eff.publishedBookUrl).toBe('https://example.com/course/');
  });
});
