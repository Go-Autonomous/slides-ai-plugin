import { readFileSync } from 'node:fs';
// @ts-ignore
import Prism from 'prismjs';
import type { CodeRun } from './types.js';

let THEME_MAP: Record<string, string> | undefined;

function loadPrismLanguage(lang: string = 'plaintext'): any {
  const normalized = String(lang || 'plaintext').toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    yml: 'yaml',
    html: 'markup',
    xml: 'markup',
  };
  const id = map[normalized] || normalized;
  if (!Prism.languages[id]) {
    try {
      const componentId = id.replace(/[^a-z0-9-]/g, '');
      require.resolve(`prismjs/components/prism-${componentId}`);
      // @ts-ignore
      import(`prismjs/components/prism-${componentId}`);
    } catch (_e) {
      // Language not found
    }
  }
  return Prism.languages[id] || Prism.languages.plain || {};
}

const FALLBACK_THEME: Record<string, string> = { plain: 'FFFFFF', comment: '999999' };
// Only bundled Prism themes are allowed; anything else never reaches the filesystem.
const THEME_MODULE_RE = /^prismjs\/themes\/prism(?:-[a-z0-9-]+)?\.css$/;

function buildThemeMap(themeCssModule: string = 'prismjs/themes/prism-okaidia.css'): Record<string, string> {
  if (!THEME_MODULE_RE.test(themeCssModule)) return { ...FALLBACK_THEME };
  try {
    const cssPath = require.resolve(themeCssModule);
    const css = readFileSync(cssPath, 'utf8');
    return Object.fromEntries(
      [...css.matchAll(/\.token\.([\w-]+)[^{]*\{[^}]*color:\s*([^;\s]+)[^}]*\}/g)].map(
        ([, t, c]: string[]) => [t, c.replace(/#|!important/g, '').trim()]
      )
    );
  } catch (err) {
    return { ...FALLBACK_THEME };
  }
}

function getThemeMap(): Record<string, string> {
  if (!THEME_MAP) THEME_MAP = buildThemeMap();
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

function tokensToRuns(tokens: any[]): CodeRun[] {
  return tokens.flatMap((t) =>
    typeof t === 'string'
      ? [run(t)]
      : Array.isArray(t.content)
        ? tokensToRuns(t.content)
        : [run(t.content, t.type)]
  );
}

export function codeToRuns(code: string = '', lang: string = 'plaintext'): CodeRun[] {
  const grammar = loadPrismLanguage(lang);
  const lines = String(code || '').split('\n');
  const pad = lines.length.toString().length;
  return lines.flatMap((line, i) => [
    run(`${(i + 1).toString().padStart(pad, ' ')} `, 'comment'),
    ...tokensToRuns(Prism.tokenize(line, grammar)),
    ...(i < lines.length - 1 ? [run('\n')] : []),
  ]);
}

export { buildThemeMap };
