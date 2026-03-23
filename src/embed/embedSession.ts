/**
 * HS256-signed JWT for embed sessions (no external deps).
 */

import { createHmac, timingSafeEqual } from 'crypto';
import type { Course } from '../types/models';

const AUD = 'inqspace-embed';

function b64urlJson(obj: object): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '');
  return Buffer.from(b64, 'base64');
}

export interface EmbedSessionPayload {
  sub: string;
  courseId: string;
  assignmentId?: string;
  lectureId?: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface CreateEmbedSessionInput {
  userId: string;
  courseId: string;
  assignmentId?: string;
  lectureId?: string;
  ttlSeconds?: number;
  secret: string;
  embedBaseUrl: string;
}

export interface EmbedSessionResult {
  token: string;
  expiresAt: string;
  embedUrl: string;
}

export function createEmbedSession(input: CreateEmbedSessionInput): EmbedSessionResult {
  const ttl = input.ttlSeconds ?? 3600;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttl;
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlJson({
    sub: input.userId,
    courseId: input.courseId,
    assignmentId: input.assignmentId,
    lectureId: input.lectureId,
    aud: AUD,
    iat,
    exp,
  });
  const data = `${header}.${payload}`;
  const sig = createHmac('sha256', input.secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const token = `${data}.${sig}`;
  const base = input.embedBaseUrl.replace(/\/$/, '');
  const embedUrl = `${base}/embed?token=${encodeURIComponent(token)}`;
  return { token, expiresAt: new Date(exp * 1000).toISOString(), embedUrl };
}

export function verifyEmbedToken(token: string, secret: string): EmbedSessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(s, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return null;
    }
  } catch {
    return null;
  }
  let parsed: EmbedSessionPayload;
  try {
    parsed = JSON.parse(b64urlDecode(p).toString('utf8')) as EmbedSessionPayload;
  } catch {
    return null;
  }
  if (parsed.aud !== AUD) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (parsed.exp <= now) {
    return null;
  }
  return parsed;
}

/** CSP `frame-ancestors` value for a course embed policy. */
export function frameAncestorsFromCourse(course: Course): string | null {
  const emb = course.metadata?.embed;
  if (!emb?.enabled || !emb.allowedFrameAncestors?.length) {
    return null;
  }
  return emb.allowedFrameAncestors.join(' ');
}
