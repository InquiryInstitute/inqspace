/**
 * Parses Jupyter Book `_config.yml` and `_toc.yml` (YAML subset).
 */

import { parse as parseYaml } from 'yaml';
import type { IJupyterBookParser } from '../types/services';
import type { JupyterBookProjectMeta } from '../types/models';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export class JupyterBookParser implements IJupyterBookParser {
  parseProjectConfig(yamlContent: string): { meta: JupyterBookProjectMeta; error?: string } {
    if (!yamlContent || !yamlContent.trim()) {
      return { meta: {}, error: 'Empty YAML' };
    }
    try {
      const doc = parseYaml(yamlContent) as unknown;
      const root = asRecord(doc);
      if (!root) {
        return { meta: {}, error: 'Config root must be a mapping' };
      }
      const title = root.title;
      const author = root.author;
      const onlyBuildToc = root.only_build_toc;
      const meta: JupyterBookProjectMeta = {
        title: typeof title === 'string' ? title : undefined,
        author:
          typeof author === 'string' || Array.isArray(author)
            ? (author as string | string[])
            : undefined,
        onlyBuildToc: typeof onlyBuildToc === 'boolean' ? onlyBuildToc : undefined,
      };
      return { meta };
    } catch (e) {
      return { meta: {}, error: (e as Error).message };
    }
  }

  parseTocStructure(yamlContent: string): { rootEntries: number; error?: string } {
    if (!yamlContent || !yamlContent.trim()) {
      return { rootEntries: 0, error: 'Empty YAML' };
    }
    try {
      const doc = parseYaml(yamlContent) as unknown;
      const root = asRecord(doc);
      if (!root) {
        return { rootEntries: 0, error: 'TOC root must be a mapping' };
      }
      const format = root.format;
      if (format === 'jb-book') {
        const sections = root.sections;
        if (Array.isArray(sections)) {
          return { rootEntries: sections.length };
        }
        return { rootEntries: 0 };
      }
      if (format === 'jb-article') {
        return { rootEntries: 1 };
      }
      const rootKeys = Object.keys(root).filter((k) => k !== 'format');
      return { rootEntries: rootKeys.length };
    } catch (e) {
      return { rootEntries: 0, error: (e as Error).message };
    }
  }
}
