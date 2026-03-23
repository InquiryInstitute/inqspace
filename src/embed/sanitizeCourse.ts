import type { Course, CourseMetadata } from '../types/models';

function redactMetadata(meta: CourseMetadata): CourseMetadata {
  const m = { ...meta };
  if (m.xapi) {
    m.xapi = {
      ...m.xapi,
      lrsBasicPasswordSecret: m.xapi.lrsBasicPasswordSecret ? '***' : '',
    };
  }
  return m;
}

/** API responses must not expose LRS credentials. */
export function sanitizeCourseForClient(course: Course): Course {
  return {
    ...course,
    metadata: redactMetadata(course.metadata),
  };
}
