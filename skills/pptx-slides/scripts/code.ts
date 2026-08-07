import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// @ts-ignore
import Prism from 'prismjs';
import type { CodeRun } from './types.js';

const nodeRequire = createRequire(import.meta.url);
const loadLanguages = nodeRequire('prismjs/components/') as (
  languages: string[]
) => void;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
};

const LANGUAGE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const THEME_MODULE_RE =
  /^prismjs\/themes\/prism(?:-[a-z0-9-]+)?\.css$/;

const FALLBACK_THEME: Record<string, string> = {
  plain: 'FFFFFF',
  comment: '999999',
};

let THEME_MAP: Record<string, string> | undefined;

function getPrismLanguage(id: string): any | undefined {
  return Object.prototype.hasOwnProperty.call(Prism.languages, id)
    ? Prism.languages[id]
    : undefined;
}

function getPlainLanguage(): any {
  return (
    getPrismLanguage('plain') ||
    getPrismLanguage('plaintext') ||
    {}
  );
}

function loadPrismLanguage(lang: string = 'plaintext'): any {
  const normalized = String(lang || 'plaintext')
    .trim()
    .toLowerCase();

  const id = LANGUAGE_ALIASES[normalized] || normalized;

  if (!LANGUAGE_ID_RE.test(id)) {
    return getPlainLanguage();
  }

  if (!getPrismLanguage(id)) {
    try {
      loadLanguages([id]);
    } catch {
      // Unsupported language; fall back to plain text.
    }
  }

  return getPrismLanguage(id) || getPlainLanguage();
}

function buildThemeMap(
  themeCssModule: string = 'prismjs/themes/prism-okaidia.css'
): Record<string, string> {
  if (!THEME_MODULE_RE.test(themeCssModule)) {
    return { ...FALLBACK_THEME };
  }

  try {
    const cssPath = nodeRequire.resolve(themeCssModule);
    const css = readFileSync(cssPath, 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );

    const theme: Record<string, string> = {
      ...FALLBACK_THEME,
    };

    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selectors = match[1];
      const declarations = match[2];

      const colorMatch = declarations.match(
        /(?:^|;)\s*color\s*:\s*([^;}]+)/i
      );

      if (!colorMatch) {
        continue;
      }

      const color = colorMatch[1]
        .replace(/\s*!important\s*$/i, '')
        .trim()
        .replace(/^#/, '');

      if (!color) {
        continue;
      }

      for (const tokenMatch of selectors.matchAll(
        /\.token\.([\w-]+)/g
      )) {
        theme[tokenMatch[1]] = color;
      }
    }

    return theme;
  } catch {
    return { ...FALLBACK_THEME };
  }
}

function getThemeMap(): Record<string, string> {
  if (!THEME_MAP) {
    THEME_MAP = buildThemeMap();
  }

  return THEME_MAP;
}

function run(text: string, type: string = 'plain'): CodeRun {
  const theme = getThemeMap();

  return {
    text,
    options: {
      fontFace: 'Consolas',
      color: (theme[type] || theme.plain || 'FFFFFF') as any,
      fontSize: 14,
    },
  };
}

function tokensToRuns(
  tokens: any[],
  inheritedType: string = 'plain'
): CodeRun[] {
  return tokens.flatMap((token) => {
    if (typeof token === 'string') {
      return [run(token, inheritedType)];
    }

    const type =
      typeof token?.type === 'string'
        ? token.type
        : inheritedType;

    if (Array.isArray(token?.content)) {
      return tokensToRuns(token.content, type);
    }

    if (typeof token?.content === 'string') {
      return [run(token.content, type)];
    }

    if (token?.content && typeof token.content === 'object') {
      return tokensToRuns([token.content], type);
    }

    return [];
  });
}

export function codeToRuns(
  code: string = '',
  lang: string = 'plaintext'
): CodeRun[] {
  const grammar = loadPrismLanguage(lang);
  const lines = String(code || '').split('\n');
  const pad = lines.length.toString().length;

  return lines.flatMap((line, index) => [
    run(
      `${(index + 1).toString().padStart(pad, ' ')} `,
      'comment'
    ),
    ...tokensToRuns(Prism.tokenize(line, grammar)),
    ...(index < lines.length - 1 ? [run('\n')] : []),
  ]);
}

export { buildThemeMap };
