// Returns a CSS color for a progress score. Tokens are defined in style.css,
// so the colors adapt to light and dark mode. `score` undefined = never asked.
export function scoreColor(score) {
  if (score === undefined) return 'var(--never)';
  if (score <= 0) return 'var(--score-zero)';
  const hue = ((score - 1) / 9) * 120;
  return `hsl(${hue}, 70%, var(--score-lightness))`;
}
