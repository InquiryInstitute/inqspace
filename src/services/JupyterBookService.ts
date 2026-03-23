/**
 * Jupyter Book integration — path merge, course/assignment policy, YAML helpers.
 */

import type { Course, Assignment, JupyterBookAssignmentOptions } from '../types/models';
import {
  DEFAULT_JUPYTER_BOOK_PATHS,
  type JupyterBookPathConfig,
  type JupyterBookEffectiveConfig,
  type CourseJupyterBookIntegration,
} from '../types/models';
import type { IJupyterBookService, JupyterBookParseBundle } from '../types/services';
import type { ICourseRepository, IAssignmentRepository } from '../types/repositories';
import { JupyterBookParser } from './JupyterBookParser';

export class JupyterBookServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JupyterBookServiceError';
  }
}

export class JupyterBookService implements IJupyterBookService {
  private readonly parser: JupyterBookParser;

  constructor(
    private readonly courseRepository: ICourseRepository,
    private readonly assignmentRepository: IAssignmentRepository,
    parser?: JupyterBookParser
  ) {
    this.parser = parser ?? new JupyterBookParser();
  }

  mergePaths(course: Course, assignment: Assignment): JupyterBookPathConfig {
    const merged: JupyterBookPathConfig = { ...DEFAULT_JUPYTER_BOOK_PATHS };
    const cpaths = course.metadata?.jupyterBook?.paths;
    if (cpaths) {
      Object.assign(merged, cpaths);
    }
    const apaths = assignment.configuration?.jupyterBook?.paths;
    if (apaths) {
      Object.assign(merged, apaths);
    }
    return merged;
  }

  async getCourseIntegration(courseId: string): Promise<CourseJupyterBookIntegration | null> {
    const course = await this.courseRepository.findById(courseId);
    if (!course) {
      throw new JupyterBookServiceError(`Course with id ${courseId} not found`);
    }
    return course.metadata?.jupyterBook ?? null;
  }

  async getEffectiveForAssignment(assignmentId: string): Promise<JupyterBookEffectiveConfig> {
    const assignment = await this.assignmentRepository.findById(assignmentId);
    if (!assignment) {
      throw new JupyterBookServiceError(`Assignment with id ${assignmentId} not found`);
    }
    const course = await this.courseRepository.findById(assignment.courseId);
    if (!course) {
      throw new JupyterBookServiceError(`Course with id ${assignment.courseId} not found`);
    }

    const courseJb = course.metadata?.jupyterBook;
    const assignJb = assignment.configuration?.jupyterBook;
    const enabled = this.effectiveEnabled(courseJb, assignJb);
    const paths = this.mergePaths(course, assignment);
    const publishedBookUrl = assignJb?.publishedBookUrl ?? courseJb?.pagesBaseUrl;

    return {
      enabled,
      paths,
      publishedBookUrl,
      courseIntegration: courseJb,
      assignmentOptions: assignJb,
    };
  }

  parseYamlBundle(configYaml: string, tocYaml?: string): JupyterBookParseBundle {
    const errors: string[] = [];
    const cfg = this.parser.parseProjectConfig(configYaml);
    if (cfg.error) {
      errors.push(cfg.error);
    }
    let tocRootEntries: number | undefined;
    if (tocYaml !== undefined) {
      const toc = this.parser.parseTocStructure(tocYaml);
      if (toc.error) {
        errors.push(toc.error);
      }
      tocRootEntries = toc.rootEntries;
    }
    return {
      config: cfg.meta,
      tocRootEntries,
      errors,
    };
  }

  private effectiveEnabled(
    courseJb: CourseJupyterBookIntegration | undefined,
    assignJb: JupyterBookAssignmentOptions | undefined
  ): boolean {
    if (assignJb?.enabled !== undefined) {
      return assignJb.enabled;
    }
    return courseJb?.enabled ?? false;
  }
}
