// Returns a CSS color for a progress score. Tokens are defined in style.css,
// so the palette can be tuned there. `score` undefined = never asked.
export function scoreColor(score) {
  if (score === undefined) return 'var(--never)';
  if (score <= 0) return 'var(--score-zero)';
  return `var(--score-${Math.min(10, Math.round(score))})`;
}
