import { JupyterBookParser } from './JupyterBookParser';

describe('JupyterBookParser', () => {
  const parser = new JupyterBookParser();

  it('parses project title and author from _config-style YAML', () => {
    const yaml = `
title: My Course
author: Ada Lovelace
`;
    const { meta, error } = parser.parseProjectConfig(yaml);
    expect(error).toBeUndefined();
    expect(meta.title).toBe('My Course');
    expect(meta.author).toBe('Ada Lovelace');
  });

  it('returns error for invalid YAML', () => {
    const { error } = parser.parseProjectConfig('title: [unclosed');
    expect(error).toBeDefined();
  });

  it('counts jb-book sections in TOC', () => {
    const toc = `
format: jb-book
root: intro.md
sections:
  - file: chapter1.md
  - file: chapter2.md
`;
    const { rootEntries, error } = parser.parseTocStructure(toc);
    expect(error).toBeUndefined();
    expect(rootEntries).toBe(2);
  });
});
