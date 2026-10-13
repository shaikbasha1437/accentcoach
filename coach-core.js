/* AccentCoach core: normalization, alignment, scoring, tips. Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CoachCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const TENS = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  function numToWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
    if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
    if (n < 1000000) return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    return String(n);
  }
  const CONTRACTIONS = { "i'm": 'i am', "it's": 'it is', "don't": 'do not', "can't": 'cannot', "won't": 'will not', "i've": 'i have', "you're": 'you are', "we're": 'we are', "they're": 'they are', "isn't": 'is not', "doesn't": 'does not', "didn't": 'did not', "i'll": 'i will', "let's": 'let us', "that's": 'that is', "what's": 'what is', "i'd": 'i would', "wasn't": 'was not', "aren't": 'are not', "couldn't": 'could not', "wouldn't": 'would not', "shouldn't": 'should not' };
  /** Normalize one token to comparable form (may expand to several words). */
  function normalizeToken(t) {
    let w = String(t).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9'%&-]/g, '');
    w = w.replace(/^'+|'+$/g, '');
    if (!w) return [];
    if (CONTRACTIONS[w]) return CONTRACTIONS[w].split(' ');
    if (w === '&') return ['and'];
    const pct = w.match(/^(\d+)%$/); if (pct) return (numToWords(+pct[1]) + ' percent').split(' ');
    if (/^\d+$/.test(w)) return numToWords(parseInt(w, 10)).split(' ');
    return w.split('-').filter(Boolean);
  }
  /** Tokenize display text: returns [{text, norm:[...]}] keeping original words for display. */
  function tokenize(text) {
    return String(text || '').split(/\s+/).filter(Boolean)
      .map((raw) => ({ text: raw, norm: normalizeToken(raw) }))
      .filter((t) => t.norm.length);
  }
  function normWords(text) { return tokenize(text).flatMap((t) => t.norm); }
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function similarity(a, b) { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; }
  const HOMOPHONES = [['to','too','two'],['there','their','theyre'],['for','four'],['write','right'],['know','no'],['hear','here'],['by','buy','bye'],['its','it\'s'],['one','won'],['see','sea'],['weather','whether'],['wait','weight'],['meet','meat'],['ok','okay']];
  function sameWord(a, b) { return a === b || HOMOPHONES.some((g) => g.includes(a) && g.includes(b)); }
  /**
   * Word-level alignment (edit distance). Target is array of normalized words.
   * Returns ops: {type:'correct'|'unclear'|'missed'|'extra', target, heard, ti, hi}
   */
  function align(target, heard) {
    const m = target.length, n = heard.length;
    const sub = (i, j) => sameWord(target[i], heard[j]) ? 0 : (similarity(target[i], heard[j]) >= 0.5 ? 0.6 : 1);
    const D = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) D[i][0] = i; for (let j = 0; j <= n; j++) D[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + sub(i - 1, j - 1));
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + sub(i - 1, j - 1))) < 1e-9) {
        ops.push({ type: sub(i - 1, j - 1) === 0 ? 'correct' : 'unclear', target: target[i - 1], heard: heard[j - 1], ti: i - 1, hi: j - 1 }); i--; j--;
      } else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) { ops.push({ type: 'missed', target: target[i - 1], ti: i - 1 }); i--; }
      else { ops.push({ type: 'extra', heard: heard[j - 1], hi: j - 1 }); j--; }
    }
    return ops.reverse();
  }
  /** Score: correct=1, unclear=partial by similarity (max .4), missed=0; extra words cost .25 each. */
  function score(ops, confidence) {
    const t = ops.filter((o) => o.type !== 'extra');
    if (!t.length) return 0;
    let pts = 0;
    for (const o of t) { if (o.type === 'correct') pts += 1; else if (o.type === 'unclear') pts += 0.4 * similarity(o.target, o.heard); }
    const extras = ops.length - t.length;
    let s = Math.max(0, (pts - 0.25 * extras) / t.length) * 100;
    if (typeof confidence === 'number' && confidence > 0 && confidence < 0.6 && s > 0) s *= 0.9 + confidence / 6;
    return Math.round(Math.min(100, s));
  }
  const CONFUSIONS = [
    { re: /th/, alt: /^(d|t|f|s|z)/, tip: '"th": put your tongue lightly between your teeth and blow air (think, three) or add voice (this, that).' },
    { re: /^v|v/, alt: /w|b|f/, tip: '"v": touch your top teeth to your bottom lip and add voice. "w" uses rounded lips with no teeth.' },
    { re: /^w/, alt: /^v|^b/, tip: '"w": round your lips like "oo", then open. Keep your teeth off your lip.' },
    { re: /r/, alt: /l/, tip: '"r": curl the tongue back without touching the roof of your mouth. "l" touches just behind the top teeth.' },
    { re: /l/, alt: /r/, tip: '"l": press the tongue tip just behind your top teeth and let air flow around it.' },
    { re: /(s|z)$/, alt: null, tip: 'Final "s/z" got dropped. Finish the word clearly, especially plurals and verbs ("works", "tests").' },
    { re: /(ed)$/, alt: null, tip: 'Past-tense "-ed" got dropped. Say the ending: /t/ (worked), /d/ (played), or /ɪd/ (tested).' },
    { re: /(t|d)$/, alt: null, tip: 'Final consonant was lost. Release the last "t/d" sound.' },
    { re: /^(p|b)/, alt: /^(b|p)/, tip: '"p" is a puff of air with no voice; "b" has voice. Hold a hand in front of your mouth to feel the puff on "p".' },
    { re: /ee|ea|i/, alt: /i|ee|ea/, tip: 'Watch long "ee" (sheep) vs short "i" (ship). Long "ee" is tense and longer.' },
  ];
  function tipFor(op) {
    if (op.type === 'missed') return 'Not heard. Say "' + op.target + '" a bit louder and don\'t rush past it.';
    if (op.type !== 'unclear') return '';
    const t = op.target, h = op.heard || '';
    for (const c of CONFUSIONS) {
      if (!c.re.test(t)) continue;
      if (c.alt === null) { if (h.length < t.length && t.startsWith(h.slice(0, Math.max(1, h.length - 1)))) return c.tip; continue; }
      const idx = t.search(c.re);
      const hs = h.slice(Math.max(0, idx - 1));
      if (c.alt.test(hs) && !c.re.test(h)) return c.tip;
    }
    if (t.length >= 7) return 'Long word: try it slowly by syllables, then stress the right one (click the word to hear it).';
    return 'Heard "' + h + '". Click the word to hear it, then try again slowly.';
  }
  /** Pick the best alternative transcript by score. alts: [{transcript, confidence}] */
  function evaluate(targetText, alts) {
    const list = (Array.isArray(alts) ? alts : [{ transcript: String(alts || ''), confidence: undefined }]).filter((a) => a && typeof a.transcript === 'string');
    const target = normWords(targetText);
    let best = null;
    for (const a of list.length ? list : [{ transcript: '' }]) {
      const ops = align(target, normWords(a.transcript));
      const s = score(ops, a.confidence);
      if (!best || s > best.score) best = { score: s, ops, transcript: a.transcript, confidence: a.confidence };
    }
    best.ops.forEach((o) => { o.tip = tipFor(o); });
    best.counts = { correct: 0, unclear: 0, missed: 0, extra: 0 };
    best.ops.forEach((o) => best.counts[o.type]++);
    return best;
  }
  /** Map normalized-target-word indices back to displayed tokens. */
  function tokenStatus(targetText, ops) {
    const toks = tokenize(targetText); const status = []; let k = 0;
    const byTi = {}; ops.forEach((o) => { if (o.ti !== undefined) byTi[o.ti] = o; });
    toks.forEach((tk) => {
      const parts = tk.norm.map(() => byTi[k++]).filter(Boolean);
      const rank = { missed: 3, unclear: 2, correct: 1 };
      const worst = parts.reduce((w, o) => (!w || rank[o.type] > rank[w.type] ? o : w), null);
      status.push({ text: tk.text, type: worst ? worst.type : 'correct', op: worst });
    });
    return status;
  }
  return { numToWords, normalizeToken, tokenize, normWords, lev, similarity, align, score, tipFor, evaluate, tokenStatus };
});
