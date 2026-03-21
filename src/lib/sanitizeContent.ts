/**
 * Approval content sanitization — strips dangerous HTML, renders URLs as links.
 * ED-7: Rich content rendering promoted to build-now.
 */
import DOMPurify from 'dompurify';

/** URL regex — matches http(s) URLs */
const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

/**
 * Sanitize approval content for safe rendering.
 * 1. Escapes all HTML in the raw string
 * 2. Converts URLs to clickable <a> links
 * 3. Runs DOMPurify to strip any remaining XSS vectors
 */
export function sanitizeContent(raw: string): string {
  // Step 1: escape HTML entities
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Step 2: convert URLs to links (operating on the escaped string).
  // URLs captured here are HTML-escaped (& → &amp;). The href needs &amp; for valid
  // HTML, but the display text should show & so we decode it for human readability.
  const withLinks = escaped.replace(URL_PATTERN, (escapedUrl) => {
    const displayUrl = escapedUrl.replace(/&amp;/g, '&');
    return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="underline text-amber-400/80 hover:text-amber-400">${displayUrl}</a>`;
  });

  // Step 3: DOMPurify — only allow <a> with safe attributes
  return DOMPurify.sanitize(withLinks, {
    ALLOWED_TAGS: ['a'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}
