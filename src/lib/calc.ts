/**
 * Safe arithmetic evaluator for the calculator and amount field.
 * Supports + - * / × ÷, parentheses, unary minus and decimals.
 * Never uses eval/Function: input is tokenised and parsed by hand.
 */

type Token = { t: 'num'; v: number } | { t: 'op'; v: string };

const MAX_LEN = 200;

function tokenize(src: string): Token[] | null {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '').replace(/\s+/g, '');
  if (s.length > MAX_LEN) return null;
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) || []).length > 1 || raw === '.') return null;
      out.push({ t: 'num', v: parseFloat(raw) });
      i = j;
    } else if ('+-*/()'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

/** Evaluate an expression. Returns null when incomplete or invalid. */
export function evaluate(src: string): number | null {
  const parsed = tokenize(src);
  if (!parsed || parsed.length === 0) return null;
  const tokens: Token[] = parsed;
  let pos = 0;
  let depth = 0;

  const peek = () => tokens[pos];

  function expr(): number {
    let v = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = factor();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = tokens[pos++].v;
      const r = factor();
      if (op === '/' && r === 0) throw new Error('div0');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function factor(): number {
    const tok = tokens[pos++];
    if (!tok) throw new Error('eof');
    if (tok.t === 'num') return tok.v;
    if (tok.v === '-') return -factor();
    if (tok.v === '+') return factor();
    if (tok.v === '(') {
      if (++depth > 20) throw new Error('depth');
      const v = expr();
      const close = tokens[pos++];
      if (!close || close.v !== ')') throw new Error('paren');
      depth--;
      return v;
    }
    throw new Error('unexpected');
  }

  try {
    const v = expr();
    if (pos !== tokens.length || !Number.isFinite(v)) return null;
    return round2(v);
  } catch {
    return null;
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True when the expression contains an operator (so showing "= result" is useful) */
export function hasOperator(src: string): boolean {
  return /[+\-*/×÷−]/.test(src.replace(/^[-−]/, ''));
}
