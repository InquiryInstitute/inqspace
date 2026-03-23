/**
 * This deployment’s GitHub repo (owner/name).
 * CI sets PUBLIC_IDE_DEMO_REPO to github.repository so each fork/course repo gets its own site + demo defaults.
 */
const FALLBACK = 'InquiryInstitute/inqspace';

export const siteGithubRepo =
  (import.meta.env.PUBLIC_IDE_DEMO_REPO ?? '').trim() || FALLBACK;

export const siteGithubUrl = `https://github.com/${siteGithubRepo}`;
export const siteGithubIssuesUrl = `${siteGithubUrl}/issues`;
