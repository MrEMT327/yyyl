// Game information is shown directly; the markup generators may still group it
// with details/summary so convert those groups before they reach the UI.
export function flattenDisclosureMarkup(html) {
  return String(html ?? '')
    .replace(/<details\b([^>]*)>/gi, (_, attrs) => `<section data-flat-section${attrs.replace(/\s+open(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|$)/gi, '')}>`)
    .replace(/<\/details\s*>/gi, '</section>')
    .replace(/<summary\b([^>]*)>/gi, (_, attrs) => `<h3 data-flat-heading${attrs.replace(/\s+tabindex\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')}>`)
    .replace(/<\/summary\s*>/gi, '</h3>');
}
