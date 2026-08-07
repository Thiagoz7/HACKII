/**
 * favicon.ts — Dynamic favicon management for Andrómeda.
 *
 * Supports switching between galaxy and default favicons,
 * and generating canvas-based PNG favicons at multiple sizes.
 */

// ── Favicon Themes ─────────────────────────────────────────────────

export type FaviconTheme = 'galaxy' | 'nabla' | 'default';

const GALAXY_SVG = '/favicon.svg';

/**
 * Set the favicon to a predefined theme.
 */
export function setFavicon(theme: FaviconTheme): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  switch (theme) {
    case 'galaxy':
      link.href = GALAXY_SVG;
      link.type = 'image/svg+xml';
      break;
    case 'nabla':
      link.href = generateNablaFavicon();
      link.type = 'image/png';
      break;
    case 'default':
      link.href = GALAXY_SVG;
      link.type = 'image/svg+xml';
      break;
  }

  // Store preference
  try { localStorage.setItem('andromeda-favicon', theme); } catch { /* ignore */ }
}

/**
 * Get the stored favicon preference.
 */
export function getStoredFavicon(): FaviconTheme {
  try {
    const stored = localStorage.getItem('andromeda-favicon') as FaviconTheme;
    if (stored === 'galaxy' || stored === 'nabla' || stored === 'default') return stored;
  } catch { /* ignore */ }
  return 'galaxy';
}

/**
 * Generate a simple ∇ (nabla) PNG favicon using canvas.
 */
function generateNablaFavicon(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return GALAXY_SVG;

  // Background
  const gradient = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
  gradient.addColorStop(0, '#6366f1');
  gradient.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(24, 24, 23, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Nabla symbol
  ctx.fillStyle = '#e0e7ff';
  ctx.font = 'bold 24px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('∇', 24, 26);

  return canvas.toDataURL('image/png');
}

/**
 * Parse a favicon command from the chatbot.
 */
export function parseFaviconCommand(input: string): FaviconTheme | null {
  const lower = input.toLowerCase();

  if (/\b(galaxy|cosmic|space|stars?|universe|nebula)\b/i.test(lower)) return 'galaxy';
  if (/\b(nabla|math|symbol|∇)\b/i.test(lower)) return 'nabla';
  if (/\b(default|original|reset)\b/i.test(lower)) return 'default';

  // Generic "change favicon" without specifying theme → galaxy
  if (/\b(change|update|set|switch)\s+(?:the\s+)?(?:favicon|icon|tab\s+icon)\b/i.test(lower)) return 'galaxy';

  return null;
}
