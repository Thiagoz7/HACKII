/**
 * i18n.ts — Internationalization system for Andrómeda.
 *
 * Provides: locale management, UI string dictionaries, chatbot response
 * translation, and command normalization across languages.
 */

import { createContext, useContext } from 'react';

// ── Supported Languages ────────────────────────────────────────────

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'ja' | 'zh';

export const SUPPORTED_LOCALES: { code: Locale; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

// ── Context ────────────────────────────────────────────────────────

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function useI18n() {
  return useContext(I18nContext);
}

// ── Translation Function ───────────────────────────────────────────

export function translate(key: string, locale: Locale): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.en;
  return dict[key] ?? DICTIONARIES.en[key] ?? key;
}

// ── Command Normalization ──────────────────────────────────────────

/**
 * Normalize a user command from any supported language to English
 * for internal processing. Preserves mathematical expressions intact.
 */
export function normalizeCommand(input: string, locale: Locale): string {
  if (locale === 'en') return input;

  const cmdMap = COMMAND_MAPS[locale];
  if (!cmdMap) return input;

  let normalized = input;
  for (const [foreign, english] of Object.entries(cmdMap)) {
    const regex = new RegExp(`\\b${escapeRegex(foreign)}\\b`, 'gi');
    normalized = normalized.replace(regex, english);
  }
  return normalized;
}

/**
 * Translate a chatbot response from English to the target locale.
 * Preserves mathematical notation (anything inside backticks or with math symbols).
 */
export function translateResponse(response: string, locale: Locale): string {
  if (locale === 'en') return response;

  const responseMap = RESPONSE_MAPS[locale];
  if (!responseMap) return response;

  let translated = response;

  // Protect math expressions (backtick code, formulas)
  const protected_: string[] = [];
  translated = translated.replace(/`[^`]+`/g, (match) => {
    protected_.push(match);
    return `__MATH_${protected_.length - 1}__`;
  });
  // Protect expressions with math symbols
  translated = translated.replace(/\b[\d.]+\s*[+\-*/^=<>]+\s*[\d.x]+/g, (match) => {
    protected_.push(match);
    return `__MATH_${protected_.length - 1}__`;
  });

  // Translate known phrases
  for (const [english, foreign] of Object.entries(responseMap)) {
    const regex = new RegExp(escapeRegex(english), 'gi');
    translated = translated.replace(regex, foreign);
  }

  // Restore protected math
  translated = translated.replace(/__MATH_(\d+)__/g, (_, idx) => protected_[parseInt(idx)]);

  return translated;
}

// ── Language Detection ─────────────────────────────────────────────

/**
 * Detect if the user is requesting a language change.
 */
export function detectLanguageCommand(input: string): Locale | null {
  const lower = input.toLowerCase();

  // "Translate to X", "Switch to X", "Respond in X", "Change language to X"
  const patterns = [
    /(?:translate|switch|change|set)\s+(?:to|the\s+language\s+to|interface\s+to)\s+(\w+)/i,
    /(?:respond|answer|reply)\s+in\s+(\w+)/i,
    /(?:accept\s+commands?\s+in|use)\s+(\w+)/i,
    /(?:idioma|langue|sprache|lingua|idioma|言語|语言)\s*[:=]?\s*(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      const lang = match[1].toLowerCase();
      return resolveLocale(lang);
    }
  }

  // Direct language names in their own language
  if (/\bespañol\b/.test(lower)) return 'es';
  if (/\bfrançais\b/.test(lower)) return 'fr';
  if (/\bdeutsch\b/.test(lower)) return 'de';
  if (/\bportuguês\b/.test(lower) || /\bportugues\b/.test(lower)) return 'pt';
  if (/\bitaliano\b/.test(lower)) return 'it';
  if (/\b日本語\b/.test(lower)) return 'ja';
  if (/\b中文\b/.test(lower)) return 'zh';

  return null;
}

function resolveLocale(name: string): Locale | null {
  const map: Record<string, Locale> = {
    english: 'en', en: 'en', inglés: 'en', inglese: 'en', anglais: 'en', englisch: 'en',
    spanish: 'es', es: 'es', español: 'es', espagnol: 'es', spanisch: 'es', spagnolo: 'es',
    french: 'fr', fr: 'fr', français: 'fr', francés: 'fr', französisch: 'fr', francese: 'fr',
    german: 'de', de: 'de', deutsch: 'de', alemán: 'de', allemand: 'de', tedesco: 'de',
    portuguese: 'pt', pt: 'pt', português: 'pt', portugués: 'pt', portugais: 'pt',
    italian: 'it', it: 'it', italiano: 'it', italien: 'it', italienisch: 'it',
    japanese: 'ja', ja: 'ja', japonés: 'ja', japonais: 'ja', japanisch: 'ja',
    chinese: 'zh', zh: 'zh', chino: 'zh', chinois: 'zh', chinesisch: 'zh',
  };
  return map[name] ?? null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Persistence ────────────────────────────────────────────────────

const LOCALE_STORAGE_KEY = 'andromeda-locale';

export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale;
    if (stored && SUPPORTED_LOCALES.some(l => l.code === stored)) return stored;
  } catch { /* ignore */ }
  return 'en';
}

export function storeLocale(locale: Locale): void {
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* ignore */ }
}


// ── UI String Dictionaries ─────────────────────────────────────────

type Dict = Record<string, string>;

const DICTIONARIES: Record<Locale, Dict> = {
  en: {
    'app.title': 'Andrómeda',
    'calc.title': 'Calculator',
    'calc.placeholder': 'Enter expression...',
    'calc.calculus': 'Calculus',
    'chat.placeholder': 'Ask ∇ — calculate, plot, analyze...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Vector Calculus Engine',
    'chat.assistant': 'Assistant',
    'chat.welcome': 'Your vector calculus & engineering companion.',
    'mode.2d': '2D',
    'mode.3d': '3D',
    'theme.toggle': 'Toggle theme',
    'fn.add': 'Add function',
    'fn.none': 'No functions yet',
    'fn.placeholder': 'f(x) = ...',
    'anim.title': 'Animations',
    'anim.play': 'Play',
    'anim.pause': 'Pause',
    'anim.stop': 'Stop',
    'anim.reset': 'Reset',
    'anim.finalize': 'Finalize',
    'anim.speed': 'Speed',
    'export.pdf': 'Export PDF',
    'export.csv': 'Export CSV',
    'lang.switched': 'Interface switched to English.',
    'tooltip.root': 'Root',
    'tooltip.yint': 'Y-intercept',
    'tooltip.max': 'Maximum',
    'tooltip.min': 'Minimum',
    'tooltip.inflection': 'Inflection',
  },
  es: {
    'app.title': 'Andrómeda',
    'calc.title': 'Calculadora',
    'calc.placeholder': 'Ingrese expresión...',
    'calc.calculus': 'Cálculo',
    'chat.placeholder': 'Pregunta a ∇ — calcular, graficar, analizar...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Motor de Cálculo Vectorial',
    'chat.assistant': 'Asistente',
    'chat.welcome': 'Tu compañero de cálculo vectorial e ingeniería.',
    'mode.2d': '2D',
    'mode.3d': '3D',
    'theme.toggle': 'Cambiar tema',
    'fn.add': 'Agregar función',
    'fn.none': 'Sin funciones aún',
    'fn.placeholder': 'f(x) = ...',
    'anim.title': 'Animaciones',
    'anim.play': 'Reproducir',
    'anim.pause': 'Pausar',
    'anim.stop': 'Detener',
    'anim.reset': 'Reiniciar',
    'anim.finalize': 'Finalizar',
    'anim.speed': 'Velocidad',
    'export.pdf': 'Exportar PDF',
    'export.csv': 'Exportar CSV',
    'lang.switched': 'Interfaz cambiada a Español. Las respuestas del chatbot serán traducidas.',
    'tooltip.root': 'Raíz',
    'tooltip.yint': 'Intersección Y',
    'tooltip.max': 'Máximo',
    'tooltip.min': 'Mínimo',
    'tooltip.inflection': 'Inflexión',
  },
  fr: {
    'app.title': 'Andrómeda',
    'calc.title': 'Calculatrice',
    'calc.placeholder': 'Entrer une expression...',
    'calc.calculus': 'Calcul',
    'chat.placeholder': 'Demandez à ∇ — calculer, tracer, analyser...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Moteur de Calcul Vectoriel',
    'chat.assistant': 'Assistant',
    'chat.welcome': 'Votre compagnon de calcul vectoriel et d\'ingénierie.',
    'mode.2d': '2D',
    'mode.3d': '3D',
    'theme.toggle': 'Changer le thème',
    'fn.add': 'Ajouter fonction',
    'fn.none': 'Aucune fonction',
    'fn.placeholder': 'f(x) = ...',
    'anim.title': 'Animations',
    'anim.play': 'Lire',
    'anim.pause': 'Pause',
    'anim.stop': 'Arrêter',
    'anim.reset': 'Réinitialiser',
    'anim.finalize': 'Finaliser',
    'anim.speed': 'Vitesse',
    'export.pdf': 'Exporter PDF',
    'export.csv': 'Exporter CSV',
    'lang.switched': 'Interface basculée en Français. Les réponses du chatbot seront traduites.',
    'tooltip.root': 'Racine',
    'tooltip.yint': 'Ordonnée à l\'origine',
    'tooltip.max': 'Maximum',
    'tooltip.min': 'Minimum',
    'tooltip.inflection': 'Inflexion',
  },
  de: {
    'app.title': 'Andrómeda',
    'calc.title': 'Rechner',
    'calc.placeholder': 'Ausdruck eingeben...',
    'calc.calculus': 'Analysis',
    'chat.placeholder': 'Fragen an ∇ — berechnen, zeichnen, analysieren...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Vektorkalkül-Engine',
    'chat.assistant': 'Assistent',
    'chat.welcome': 'Ihr Begleiter für Vektorkalkül und Ingenieurwesen.',
    'mode.2d': '2D',
    'mode.3d': '3D',
    'theme.toggle': 'Thema wechseln',
    'fn.add': 'Funktion hinzufügen',
    'fn.none': 'Noch keine Funktionen',
    'fn.placeholder': 'f(x) = ...',
    'anim.title': 'Animationen',
    'anim.play': 'Abspielen',
    'anim.pause': 'Pause',
    'anim.stop': 'Stopp',
    'anim.reset': 'Zurücksetzen',
    'anim.finalize': 'Finalisieren',
    'anim.speed': 'Geschwindigkeit',
    'export.pdf': 'PDF exportieren',
    'export.csv': 'CSV exportieren',
    'lang.switched': 'Oberfläche auf Deutsch umgestellt. Chatbot-Antworten werden übersetzt.',
    'tooltip.root': 'Nullstelle',
    'tooltip.yint': 'Y-Achsenabschnitt',
    'tooltip.max': 'Maximum',
    'tooltip.min': 'Minimum',
    'tooltip.inflection': 'Wendepunkt',
  },
  pt: {
    'app.title': 'Andrómeda',
    'calc.title': 'Calculadora',
    'calc.placeholder': 'Insira expressão...',
    'calc.calculus': 'Cálculo',
    'chat.placeholder': 'Pergunte ao ∇ — calcular, plotar, analisar...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Motor de Cálculo Vetorial',
    'chat.assistant': 'Assistente',
    'chat.welcome': 'Seu companheiro de cálculo vetorial e engenharia.',
    'mode.2d': '2D',
    'mode.3d': '3D',
    'theme.toggle': 'Alternar tema',
    'fn.add': 'Adicionar função',
    'fn.none': 'Sem funções ainda',
    'fn.placeholder': 'f(x) = ...',
    'anim.title': 'Animações',
    'anim.play': 'Reproduzir',
    'anim.pause': 'Pausar',
    'anim.stop': 'Parar',
    'anim.reset': 'Reiniciar',
    'anim.finalize': 'Finalizar',
    'anim.speed': 'Velocidade',
    'export.pdf': 'Exportar PDF',
    'export.csv': 'Exportar CSV',
    'lang.switched': 'Interface alterada para Português. As respostas do chatbot serão traduzidas.',
    'tooltip.root': 'Raiz',
    'tooltip.yint': 'Intercepto Y',
    'tooltip.max': 'Máximo',
    'tooltip.min': 'Mínimo',
    'tooltip.inflection': 'Inflexão',
  },
  it: {
    'app.title': 'Andrómeda',
    'calc.title': 'Calcolatrice',
    'calc.placeholder': 'Inserisci espressione...',
    'calc.calculus': 'Calcolo',
    'chat.placeholder': 'Chiedi a ∇ — calcolare, tracciare, analizzare...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'Motore di Calcolo Vettoriale',
    'chat.assistant': 'Assistente',
    'chat.welcome': 'Il tuo compagno di calcolo vettoriale e ingegneria.',
    'lang.switched': 'Interfaccia cambiata in Italiano. Le risposte del chatbot saranno tradotte.',
    'tooltip.root': 'Radice',
    'tooltip.max': 'Massimo',
    'tooltip.min': 'Minimo',
    'tooltip.inflection': 'Inflessione',
  },
  ja: {
    'app.title': 'Andrómeda',
    'calc.title': '計算機',
    'calc.placeholder': '式を入力...',
    'calc.calculus': '微積分',
    'chat.placeholder': '∇に聞く — 計算、プロット、分析...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': 'ベクトル解析エンジン',
    'chat.assistant': 'アシスタント',
    'chat.welcome': 'ベクトル解析とエンジニアリングのパートナー。',
    'lang.switched': 'インターフェースが日本語に変更されました。チャットボットの応答も翻訳されます。',
    'tooltip.root': '根',
    'tooltip.max': '極大',
    'tooltip.min': '極小',
    'tooltip.inflection': '変曲点',
  },
  zh: {
    'app.title': 'Andrómeda',
    'calc.title': '计算器',
    'calc.placeholder': '输入表达式...',
    'calc.calculus': '微积分',
    'chat.placeholder': '问∇ — 计算、绘图、分析...',
    'chat.title': 'Andrómeda',
    'chat.subtitle': '向量微积分引擎',
    'chat.assistant': '助手',
    'chat.welcome': '你的向量微积分与工程伙伴。',
    'lang.switched': '界面已切换为中文。聊天机器人的回复将被翻译。',
    'tooltip.root': '根',
    'tooltip.max': '极大值',
    'tooltip.min': '极小值',
    'tooltip.inflection': '拐点',
  },
};

// ── Command Maps (foreign → English) ──────────────────────────────

const COMMAND_MAPS: Partial<Record<Locale, Record<string, string>>> = {
  es: {
    'graficar': 'plot', 'dibujar': 'draw', 'calcular': 'calculate', 'derivar': 'differentiate',
    'integrar': 'integrate', 'resolver': 'solve', 'analizar': 'analyze', 'animar': 'animate',
    'exportar': 'export', 'guardar': 'save', 'límite': 'limit', 'derivada': 'derivative',
    'integral': 'integral', 'función': 'function', 'ecuación': 'equation',
    'momento flector': 'bending moment', 'fuerza cortante': 'shear force', 'deflexión': 'deflection',
    'engranaje': 'gear', 'eje': 'shaft', 'polea': 'pulley', 'rodamiento': 'bearing',
    'resorte': 'spring', 'leva': 'cam', 'viga': 'beam',
  },
  fr: {
    'tracer': 'plot', 'dessiner': 'draw', 'calculer': 'calculate', 'dériver': 'differentiate',
    'intégrer': 'integrate', 'résoudre': 'solve', 'analyser': 'analyze', 'animer': 'animate',
    'exporter': 'export', 'sauvegarder': 'save', 'limite': 'limit', 'dérivée': 'derivative',
    'intégrale': 'integral', 'fonction': 'function', 'équation': 'equation',
    'moment fléchissant': 'bending moment', 'effort tranchant': 'shear force', 'flèche': 'deflection',
    'engrenage': 'gear', 'arbre': 'shaft', 'poulie': 'pulley', 'roulement': 'bearing',
    'ressort': 'spring', 'came': 'cam', 'poutre': 'beam',
  },
  de: {
    'zeichnen': 'plot', 'berechnen': 'calculate', 'ableiten': 'differentiate',
    'integrieren': 'integrate', 'lösen': 'solve', 'analysieren': 'analyze', 'animieren': 'animate',
    'exportieren': 'export', 'speichern': 'save', 'grenzwert': 'limit', 'ableitung': 'derivative',
    'integral': 'integral', 'funktion': 'function', 'gleichung': 'equation',
    'biegemoment': 'bending moment', 'querkraft': 'shear force', 'durchbiegung': 'deflection',
    'zahnrad': 'gear', 'welle': 'shaft', 'riemenscheibe': 'pulley', 'lager': 'bearing',
    'feder': 'spring', 'nocken': 'cam', 'balken': 'beam',
  },
  pt: {
    'plotar': 'plot', 'desenhar': 'draw', 'calcular': 'calculate', 'derivar': 'differentiate',
    'integrar': 'integrate', 'resolver': 'solve', 'analisar': 'analyze', 'animar': 'animate',
    'exportar': 'export', 'salvar': 'save', 'limite': 'limit', 'derivada': 'derivative',
    'integral': 'integral', 'função': 'function', 'equação': 'equation',
    'momento fletor': 'bending moment', 'força cortante': 'shear force', 'deflexão': 'deflection',
    'engrenagem': 'gear', 'eixo': 'shaft', 'polia': 'pulley', 'rolamento': 'bearing',
    'mola': 'spring', 'came': 'cam', 'viga': 'beam',
  },
  it: {
    'tracciare': 'plot', 'disegnare': 'draw', 'calcolare': 'calculate', 'derivare': 'differentiate',
    'integrare': 'integrate', 'risolvere': 'solve', 'analizzare': 'analyze', 'animare': 'animate',
    'esportare': 'export', 'salvare': 'save', 'limite': 'limit', 'derivata': 'derivative',
    'integrale': 'integral', 'funzione': 'function', 'equazione': 'equation',
    'momento flettente': 'bending moment', 'taglio': 'shear force', 'deflessione': 'deflection',
    'ingranaggio': 'gear', 'albero': 'shaft', 'puleggia': 'pulley', 'cuscinetto': 'bearing',
    'molla': 'spring', 'camma': 'cam', 'trave': 'beam',
  },
};

// ── Response Translation Maps (English → foreign) ─────────────────

const RESPONSE_MAPS: Partial<Record<Locale, Record<string, string>>> = {
  es: {
    'Plotting': 'Graficando', 'Animation started': 'Animación iniciada',
    'Derivative': 'Derivada', 'Integral': 'Integral', 'Limit': 'Límite',
    'Result': 'Resultado', 'Step-by-step': 'Paso a paso', 'Solving': 'Resolviendo',
    'Critical Points': 'Puntos Críticos', 'Maximum': 'Máximo', 'Minimum': 'Mínimo',
    'Root': 'Raíz', 'Inflection': 'Inflexión', 'Shear Force': 'Fuerza Cortante',
    'Bending Moment': 'Momento Flector', 'Deflection': 'Deflexión',
    'Auto-created': 'Creado automáticamente', 'Exported': 'Exportado',
    'Try': 'Intenta', 'I can help': 'Puedo ayudar',
  },
  fr: {
    'Plotting': 'Traçage', 'Animation started': 'Animation démarrée',
    'Derivative': 'Dérivée', 'Integral': 'Intégrale', 'Limit': 'Limite',
    'Result': 'Résultat', 'Step-by-step': 'Étape par étape', 'Solving': 'Résolution',
    'Critical Points': 'Points Critiques', 'Maximum': 'Maximum', 'Minimum': 'Minimum',
    'Root': 'Racine', 'Inflection': 'Inflexion', 'Shear Force': 'Effort Tranchant',
    'Bending Moment': 'Moment Fléchissant', 'Deflection': 'Flèche',
    'Auto-created': 'Créé automatiquement', 'Exported': 'Exporté',
    'Try': 'Essayez', 'I can help': 'Je peux aider',
  },
  de: {
    'Plotting': 'Zeichne', 'Animation started': 'Animation gestartet',
    'Derivative': 'Ableitung', 'Integral': 'Integral', 'Limit': 'Grenzwert',
    'Result': 'Ergebnis', 'Step-by-step': 'Schritt für Schritt', 'Solving': 'Löse',
    'Critical Points': 'Kritische Punkte', 'Maximum': 'Maximum', 'Minimum': 'Minimum',
    'Root': 'Nullstelle', 'Inflection': 'Wendepunkt', 'Shear Force': 'Querkraft',
    'Bending Moment': 'Biegemoment', 'Deflection': 'Durchbiegung',
    'Auto-created': 'Automatisch erstellt', 'Exported': 'Exportiert',
    'Try': 'Versuchen Sie', 'I can help': 'Ich kann helfen',
  },
  pt: {
    'Plotting': 'Plotando', 'Animation started': 'Animação iniciada',
    'Derivative': 'Derivada', 'Integral': 'Integral', 'Limit': 'Limite',
    'Result': 'Resultado', 'Step-by-step': 'Passo a passo', 'Solving': 'Resolvendo',
    'Critical Points': 'Pontos Críticos', 'Maximum': 'Máximo', 'Minimum': 'Mínimo',
    'Root': 'Raiz', 'Inflection': 'Inflexão', 'Shear Force': 'Força Cortante',
    'Bending Moment': 'Momento Fletor', 'Deflection': 'Deflexão',
    'Auto-created': 'Criado automaticamente', 'Exported': 'Exportado',
    'Try': 'Tente', 'I can help': 'Posso ajudar',
  },
};
