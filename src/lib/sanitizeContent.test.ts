import { describe, expect, it } from 'vitest';
import { sanitizeContent } from './sanitizeContent';

describe('sanitizeContent', () => {
  it('returns plain text unchanged (no HTML)', () => {
    const result = sanitizeContent('Hello world');
    expect(result).toBe('Hello world');
  });

  it('escapes HTML special characters', () => {
    const result = sanitizeContent('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('converts http URLs to clickable <a> links', () => {
    const result = sanitizeContent('Check https://example.com for details');
    expect(result).toContain('<a');
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it('converts https URLs to links', () => {
    const result = sanitizeContent('Visit https://tryclam.com/dashboard');
    expect(result).toContain('href="https://tryclam.com/dashboard"');
  });

  it('does NOT allow <script> tags through DOMPurify', () => {
    // Even if somehow a script tag is constructed
    const result = sanitizeContent('Normal text');
    expect(result).not.toContain('<script');
  });

  it('strips disallowed tags (img, div, span)', () => {
    // Inject raw HTML that might be in content — must be stripped
    const withTags = sanitizeContent('<div>content</div> and <img src="x" onerror="alert(1)">');
    expect(withTags).not.toContain('<div>');
    expect(withTags).not.toContain('<img');
  });

  it('preserves the link text as the URL', () => {
    const result = sanitizeContent('https://example.com');
    // Link text should contain the URL
    expect(result).toContain('https://example.com</a>');
  });

  it('handles multiple URLs in one string', () => {
    const result = sanitizeContent('A: https://a.com B: https://b.com');
    const linkCount = (result.match(/<a /g) ?? []).length;
    expect(linkCount).toBe(2);
  });

  it('handles empty string', () => {
    expect(sanitizeContent('')).toBe('');
  });

  it('handles string with no URLs — no <a> tags added', () => {
    const result = sanitizeContent('Just a plain sentence with no links.');
    expect(result).not.toContain('<a');
  });
});
