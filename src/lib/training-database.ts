/**
 * training-database.ts — Persistent training database for Andrómeda.
 *
 * Stores user queries, imported functions, solved equations, mechanical parts,
 * and extracted PDF content in localStorage for continuous improvement.
 * Provides pattern matching against the database for smarter responses.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface TrainingEntry {
  id: string;
  timestamp: number;
  category: 'query' | 'function' | 'equation' | 'part' | 'pdf_content' | 'note';
  content: string;
  metadata?: Record<string, string>;
  tags: string[];
}

export interface TrainingDatabase {
  version: number;
  entries: TrainingEntry[];
  stats: {
    totalQueries: number;
    totalFunctions: number;
    totalEquations: number;
    totalParts: number;
    totalPDFs: number;
    lastUpdated: number;
  };
}

// ── Constants ──────────────────────────────────────────────────────

const STORAGE_KEY = 'andromeda-training-db';
const DB_VERSION = 1;
const MAX_ENTRIES = 5000;

// ── Database Management ────────────────────────────────────────────

/**
 * Load the training database from localStorage.
 */
export function loadDatabase(): TrainingDatabase {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const db = JSON.parse(stored) as TrainingDatabase;
      if (db.version === DB_VERSION) return db;
    }
  } catch { /* fresh start */ }

  return createEmptyDatabase();
}

/**
 * Save the training database to localStorage.
 */
export function saveDatabase(db: TrainingDatabase): void {
  try {
    // Trim if over max
    if (db.entries.length > MAX_ENTRIES) {
      db.entries = db.entries.slice(-MAX_ENTRIES);
    }
    db.stats.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full — trim aggressively
    db.entries = db.entries.slice(-1000);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch { /* give up */ }
  }
}

function createEmptyDatabase(): TrainingDatabase {
  return {
    version: DB_VERSION,
    entries: [],
    stats: { totalQueries: 0, totalFunctions: 0, totalEquations: 0, totalParts: 0, totalPDFs: 0, lastUpdated: Date.now() },
  };
}

// ── Adding Entries ─────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Record a user query for training.
 */
export function addQuery(db: TrainingDatabase, query: string, intentType: string): void {
  db.entries.push({
    id: generateId(),
    timestamp: Date.now(),
    category: 'query',
    content: query,
    metadata: { intentType },
    tags: extractTags(query),
  });
  db.stats.totalQueries++;
}

/**
 * Record an imported function.
 */
export function addFunction(db: TrainingDatabase, expression: string, name?: string): void {
  db.entries.push({
    id: generateId(),
    timestamp: Date.now(),
    category: 'function',
    content: expression,
    metadata: name ? { name } : undefined,
    tags: extractTags(expression),
  });
  db.stats.totalFunctions++;
}

/**
 * Record a solved equation.
 */
export function addEquation(db: TrainingDatabase, equation: string, solutions: string[]): void {
  db.entries.push({
    id: generateId(),
    timestamp: Date.now(),
    category: 'equation',
    content: equation,
    metadata: { solutions: solutions.join('; ') },
    tags: extractTags(equation),
  });
  db.stats.totalEquations++;
}

/**
 * Record a mechanical part creation/edit.
 */
export function addPart(db: TrainingDatabase, partType: string, params: Record<string, number>): void {
  db.entries.push({
    id: generateId(),
    timestamp: Date.now(),
    category: 'part',
    content: `${partType}: ${JSON.stringify(params)}`,
    metadata: { partType },
    tags: [partType, ...Object.keys(params)],
  });
  db.stats.totalParts++;
}

/**
 * Add extracted PDF content to the database.
 */
export function addPDFContent(db: TrainingDatabase, filename: string, extractedItems: ExtractedItem[]): void {
  for (const item of extractedItems) {
    db.entries.push({
      id: generateId(),
      timestamp: Date.now(),
      category: 'pdf_content',
      content: item.content,
      metadata: { filename, type: item.type },
      tags: [...extractTags(item.content), filename],
    });
  }
  db.stats.totalPDFs++;
}

/**
 * Add a custom note/entry to the database.
 */
export function addNote(db: TrainingDatabase, content: string, tags: string[] = []): void {
  db.entries.push({
    id: generateId(),
    timestamp: Date.now(),
    category: 'note',
    content,
    tags: tags.length > 0 ? tags : extractTags(content),
  });
}

// ── Querying the Database ──────────────────────────────────────────

/**
 * Search the database for entries matching a query.
 */
export function searchDatabase(db: TrainingDatabase, query: string, limit = 10): TrainingEntry[] {
  const queryTags = extractTags(query);
  const queryLower = query.toLowerCase();

  // Score each entry
  const scored = db.entries.map(entry => {
    let score = 0;
    // Tag overlap
    for (const tag of queryTags) {
      if (entry.tags.includes(tag)) score += 2;
    }
    // Content substring match
    if (entry.content.toLowerCase().includes(queryLower)) score += 3;
    // Partial word matches
    const words = queryLower.split(/\s+/);
    for (const word of words) {
      if (entry.content.toLowerCase().includes(word)) score += 1;
    }
    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

/**
 * Get database statistics summary.
 */
export function getDatabaseStats(db: TrainingDatabase): string {
  return [
    `**Training Database Statistics:**`,
    `  Total entries: ${db.entries.length}`,
    `  Queries: ${db.stats.totalQueries}`,
    `  Functions: ${db.stats.totalFunctions}`,
    `  Equations: ${db.stats.totalEquations}`,
    `  Parts: ${db.stats.totalParts}`,
    `  PDFs imported: ${db.stats.totalPDFs}`,
    `  Last updated: ${new Date(db.stats.lastUpdated).toLocaleString()}`,
  ].join('\n');
}

// ── PDF Extraction ─────────────────────────────────────────────────

export interface ExtractedItem {
  type: 'expression' | 'equation' | 'text' | 'parameter';
  content: string;
}

/**
 * Extract mathematical content from raw text (e.g., PDF text content).
 * Identifies expressions, equations, and technical parameters.
 */
export function extractMathFromText(text: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;

    // Equations (contains =)
    if (/[a-zA-Z]\s*\(?\s*[a-zA-Z]\s*\)?\s*=/.test(trimmed) && /[+\-*/^]/.test(trimmed)) {
      items.push({ type: 'equation', content: trimmed });
      continue;
    }

    // Mathematical expressions (has math operators and variables)
    if (/\b(sin|cos|tan|log|ln|exp|sqrt|lim|∫|∂|∇)\b/i.test(trimmed) ||
        (/[a-zA-Z]/.test(trimmed) && /[\^*/+\-]/.test(trimmed) && /\d/.test(trimmed))) {
      items.push({ type: 'expression', content: trimmed });
      continue;
    }

    // Parameters (key = value patterns)
    if (/^\w+\s*[:=]\s*[\d.]+/.test(trimmed)) {
      items.push({ type: 'parameter', content: trimmed });
      continue;
    }

    // General technical text (if it contains math-related keywords)
    if (/\b(derivative|integral|function|equation|matrix|vector|force|moment|stress|strain|torque|beam|gear|shaft)\b/i.test(trimmed)) {
      items.push({ type: 'text', content: trimmed });
    }
  }

  return items;
}

/**
 * Read a text file and extract content.
 */
export function processUploadedFile(file: File): Promise<{ filename: string; items: ExtractedItem[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        reject(new Error('Could not read file'));
        return;
      }
      const items = extractMathFromText(text);
      resolve({ filename: file.name, items });
    };

    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

// ── NL Parser ──────────────────────────────────────────────────────

export interface ParsedTrainingCommand {
  action: 'import_pdf' | 'add_to_db' | 'search_db' | 'show_stats' | 'clear_db';
  content?: string;
}

export function parseTrainingCommand(input: string): ParsedTrainingCommand | null {
  const lower = input.toLowerCase();

  if (/\b(import|upload)\s+(?:this\s+)?(?:pdf|file|document)\b/i.test(lower)) {
    return { action: 'import_pdf' };
  }

  if (/\b(add|store|save)\s+(?:to\s+)?(?:the\s+)?(?:training\s+)?(?:database|db|data\s*set)\b/i.test(lower)) {
    const content = input.replace(/\b(add|store|save)\s+(?:to\s+)?(?:the\s+)?(?:training\s+)?(?:database|db|data\s*set)\s*/i, '').trim();
    return { action: 'add_to_db', content: content || undefined };
  }

  if (/\b(update|enrich)\s+(?:the\s+)?(?:training\s+)?(?:set|database|db)\b/i.test(lower)) {
    return { action: 'add_to_db', content: input };
  }

  if (/\b(search|find|look\s*up)\s+(?:in\s+)?(?:the\s+)?(?:training\s+)?(?:database|db)\b/i.test(lower)) {
    const content = input.replace(/.*(?:database|db)\s*/i, '').trim();
    return { action: 'search_db', content: content || undefined };
  }

  if (/\b(show|display|view)\s+(?:training\s+)?(?:database|db)\s*(?:stats|statistics|info)?\b/i.test(lower)) {
    return { action: 'show_stats' };
  }

  if (/\b(clear|reset|wipe)\s+(?:the\s+)?(?:training\s+)?(?:database|db)\b/i.test(lower)) {
    return { action: 'clear_db' };
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();

  // Math functions
  const mathFns = ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'abs'];
  for (const fn of mathFns) {
    if (lower.includes(fn)) tags.push(fn);
  }

  // Calculus terms
  const calcTerms = ['derivative', 'integral', 'limit', 'series', 'taylor'];
  for (const term of calcTerms) {
    if (lower.includes(term)) tags.push(term);
  }

  // Mechanics terms
  const mechTerms = ['gear', 'shaft', 'pulley', 'bearing', 'beam', 'torsion', 'moment', 'shear'];
  for (const term of mechTerms) {
    if (lower.includes(term)) tags.push(term);
  }

  // Variables
  if (/\bx\b/.test(lower)) tags.push('x');
  if (/\by\b/.test(lower)) tags.push('y');
  if (/\bz\b/.test(lower)) tags.push('z');

  return [...new Set(tags)];
}
