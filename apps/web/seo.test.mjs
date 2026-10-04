import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public SEO documents', () => {
  it('includes one nonempty meta description in the HTML head', () => {
    const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
    const descriptions = [...head.matchAll(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?\s*>/g)];
    expect(descriptions).toHaveLength(1);
    expect(descriptions[0][1].trim().length).toBeGreaterThan(0);
    expect(descriptions[0][1]).toContain('Borneo Marketplace');
  });

  it('publishes plain-text crawling rules rather than an HTML document', () => {
    const robots = readFileSync(new URL('./public/robots.txt', import.meta.url), 'utf8');
    expect(robots).not.toMatch(/<[^>]+>/);
    const rules = robots.trim().split(/\r?\n/);
    expect(rules[0]).toBe('User-agent: *');
    expect(rules).toContain('Allow: /');
    for (const path of ['/api/', '/app', '/login']) {
      expect(rules).toContain(`Disallow: ${path}`);
    }
    expect(rules.every(line => /^(User-agent|Allow|Disallow):\s+\S+$/.test(line))).toBe(true);
  });
});
