(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const C = window.CoachCore, SETS = window.PRACTICE_SETS;
  const KEY = 'accentcoach.v1';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let store; try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { store = {}; }
  store.history ||= []; store.words ||= {}; store.days ||= []; store.prefs ||= {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} };

  // ---------- Sentence picking ----------
  let currentSet = store.prefs.set && SETS[store.prefs.set] ? store.prefs.set : Object.keys(SETS)[0];
  const setSel = $('set');
  Object.keys(SETS).forEach((k) => setSel.add(new Option(k, k)));
  setSel.value = currentSet;
  function best(sentence) { const h = store.history.filter((x) => x.sentence === sentence); return h.length ? Math.max(...h.map((x) => x.score)) : null; }
  function renderSentences() {
    $('sentences').innerHTML = SETS[currentSet].map((s, i) => { const b = best(s); return `<button class="chip${s === $('target').value ? ' active' : ''}" data-i="${i}">${esc(s)}${b !== null ? `<span class="s">best ${b}</span>` : ''}</button>`; }).join('');
  }
  $('sentences').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setTarget(SETS[currentSet][+b.dataset.i]); });
  setSel.addEventListener('change', () => { currentSet = setSel.value; store.prefs.set = currentSet; save(); setTarget(SETS[currentSet][0]); });
  $('shuffle').addEventListener('click', () => { const l = SETS[currentSet]; setTarget(l[Math.floor(Math.random() * l.length)]); });
  $('next').addEventListener('click', () => { const l = SETS[currentSet]; const i = l.indexOf($('target').value); setTarget(l[(i + 1) % l.length]); });
  $('target').addEventListener('input', () => { renderWords(); renderSentences(); hideResult(); });
  function setTarget(s) { $('target').value = s; renderWords(); renderSentences(); hideResult(); }
  function renderWords() {
    $('words').innerHTML = C.tokenize($('target').value).map((t) => `<button class="w" data-w="${esc(t.text)}">${esc(t.text)}</button>`).join('');
  }
  document.addEventListener('click', (e) => { const w = e.target.closest('.w[data-w]'); if (w) speak(w.dataset.w.replace(/[^\w'’-]/g, ''), 0.75); });

  // ---------- Listen (speechSynthesis) ----------
  const synth = window.speechSynthesis; let voices = [];
  function loadVoices() {
    if (!synth) return; voices = synth.getVoices().filter((v) => /^en/i.test(v.lang));
    const sel = $('voice'), prev = sel.value || store.prefs.voice;
    sel.innerHTML = voices.length ? voices.map((v, i) => `<option value="${i}">${esc(v.name)} (${esc(v.lang)})</option>`).join('') : '<option value="">Default voice</option>';
    const i = voices.findIndex((v) => v.name === prev || String(voices.indexOf(v)) === prev);
    if (i >= 0) sel.value = String(i);
    else { const m = voices.findIndex((v) => v.lang.replace('_', '-') === $('lang').value); if (m >= 0) sel.value = String(m); }
  }
  if (synth) { loadVoices(); synth.addEventListener?.('voiceschanged', loadVoices); }
  $('voice').addEventListener('change', () => { const v = voices[+$('voice').value]; store.prefs.voice = v ? v.name : ''; save(); });
  const rate = $('rate'); rate.value = store.prefs.rate || 0.95; $('rateVal').textContent = rate.value;
  rate.addEventListener('input', () => { $('rateVal').textContent = rate.value; store.prefs.rate = rate.value; save(); });
  function speak(text, mult = 1, onBoundary) {
    if (!synth || !text) return; synth.cancel();
    const u = new SpeechSynthesisUtterance(text); const v = voices[+$('voice').value];
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = $('lang').value;
    u.rate = Math.max(0.3, +rate.value * mult);
    if (onBoundary) { u.onboundary = onBoundary; u.onend = () => onBoundary(null); }
    synth.speak(u);
  }
  function highlightSpeak(mult) {
    const text = $('target').value; const btns = [...$('words').children];
    const starts = []; let pos = 0; text.split(/(\s+)/).forEach((p) => { if (p.trim() && C.normalizeToken(p).length) starts.push(pos); pos += p.length; });
    speak(text, mult, (e) => { btns.forEach((b) => b.classList.remove('speaking')); if (!e) return; let k = starts.findIndex((s, i) => e.charIndex >= s && (i === starts.length - 1 || e.charIndex < starts[i + 1])); if (btns[k]) btns[k].classList.add('speaking'); });
  }
  $('listen').addEventListener('click', () => highlightSpeak(1));
  $('slow').addEventListener('click', () => highlightSpeak(0.65));

  // ---------- Speak (SpeechRecognition) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const ua = navigator.userAgent; const isFirefox = /firefox/i.test(ua);
  const sup = $('support');
  if (!SR) {
    sup.hidden = false; sup.classList.add('warn');
    sup.innerHTML = `<strong>Speech recognition isn't available in this browser${isFirefox ? ' (Firefox doesn\'t support it)' : ''}.</strong> Open AccentCoach in <b>Chrome</b> or <b>Edge</b> on desktop or Android to score your speaking (Safari support is partial). You can still listen to sentences, click words to hear them, record yourself, and type a transcript below to try the scoring.`;
    $('speak').disabled = true; $('speak').textContent = '🎙️ Not supported here';
  } else {
    sup.hidden = false;
    sup.innerHTML = '<strong>Works best in Chrome or Edge.</strong> Safari support is partial and Firefox has none. Allow microphone access when asked, and speak at a normal pace in a quiet room.' + (synth ? '' : ' Text-to-speech is unavailable here, so the Listen buttons will do nothing.');
  }
  $('lang').value = store.prefs.lang || 'en-US';
  $('lang').addEventListener('change', () => { store.prefs.lang = $('lang').value; save(); });
  let rec = null, listening = false, finalAlts = [], finalText = '';
  function startListening() {
    if (!SR) return;
    synth && synth.cancel();
    rec = new SR(); rec.lang = $('lang').value; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 5;
    finalAlts = []; finalText = '';
    rec.onresult = (e) => {
      let interim = ''; finalText = ''; const altSets = [];
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { finalText += r[0].transcript + ' '; altSets.push([...Array(r.length)].map((_, k) => ({ transcript: r[k].transcript, confidence: r[k].confidence }))); }
        else interim += r[0].transcript;
      }
      // Build whole-utterance alternatives: top of every segment, swapping one segment's alternative at a time.
      if (altSets.length) {
        const tops = altSets.map((a) => a[0]);
        const conf = (arr) => { const c = arr.map((a) => a.confidence).filter((x) => x > 0); return c.length ? c.reduce((s, x) => s + x, 0) / c.length : undefined; };
        finalAlts = [{ transcript: tops.map((a) => a.transcript).join(' '), confidence: conf(tops) }];
        altSets.forEach((a, si) => a.slice(1).forEach((alt) => { const t = tops.slice(); t[si] = alt; finalAlts.push({ transcript: t.map((x) => x.transcript).join(' '), confidence: conf(t) }); }));
      }
      $('live').innerHTML = esc(finalText) + (interim ? `<span class="interim">${esc(interim)}</span>` : '') || '<span class="muted">Listening…</span>';
    };
    rec.onerror = (e) => {
      const msg = { 'not-allowed': 'Microphone access was blocked. Allow the mic for this site and try again.', 'no-speech': "I didn't hear anything. Try again a little closer to the mic.", network: 'The browser\'s speech service couldn\'t be reached. Check your connection.', 'audio-capture': 'No microphone was found.' }[e.error] || ('Speech recognition error: ' + e.error);
      $('live').innerHTML = `<span class="muted">${esc(msg)}</span>`;
    };
    rec.onend = () => { setListening(false); stopRecording(); if (finalAlts.length) grade(finalAlts); };
    try { rec.start(); setListening(true); $('live').innerHTML = '<span class="muted">Listening… say the sentence now.</span>'; if ($('recordOpt').checked) startRecording(); }
    catch (err) { $('live').textContent = 'Could not start: ' + err.message; }
  }
  function setListening(on) { listening = on; $('speak').classList.toggle('rec', on); $('speak').textContent = on ? '⏹ Stop' : '🎙️ Start speaking'; }
  $('speak').addEventListener('click', () => { if (listening) rec && rec.stop(); else startListening(); });
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); $('speak').click(); } });
  $('again').addEventListener('click', () => { hideResult(); if (SR) startListening(); });

  // ---------- Optional recording ----------
  let mr = null, chunks = [], audioURL = null, stream = null;
  async function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = [];
      mr = new MediaRecorder(stream); mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = () => { if (audioURL) URL.revokeObjectURL(audioURL); audioURL = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType })); $('playback').hidden = false; stream.getTracks().forEach((t) => t.stop()); };
      mr.start();
      if (!listening) stopRecording();
    } catch { /* mic denied; recognition handles messaging */ }
  }
  function stopRecording() { if (mr && mr.state === 'recording') mr.stop(); }
  $('playback').addEventListener('click', () => { if (audioURL) new Audio(audioURL).play(); });
  if (!window.MediaRecorder) $('recordOpt').parentElement.hidden = true;
  $('recordOpt').checked = !!store.prefs.record;
  $('recordOpt').addEventListener('change', () => { store.prefs.record = $('recordOpt').checked; save(); });

  // ---------- Manual transcript (testing / no mic) ----------
  $('manualGo').addEventListener('click', () => { const t = $('manual').value.trim(); if (t) { $('live').textContent = t; grade([{ transcript: t }]); } });
  $('manual').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('manualGo').click(); });

  // ---------- Compare & score ----------
  function hideResult() { $('resultCard').hidden = true; }
  function grade(alts) {
    const target = $('target').value.trim(); if (!target) return null;
    const r = C.evaluate(target, alts);
    const st = C.tokenStatus(target, r.ops);
    const sc = $('score'); sc.textContent = r.score; sc.className = 'score ' + (r.score >= 85 ? 'good' : r.score >= 60 ? 'mid' : 'bad');
    $('scoreLbl').textContent = r.score >= 95 ? 'Excellent, crystal clear!' : r.score >= 85 ? 'Great, almost perfect' : r.score >= 60 ? 'Good, a few words to polish' : 'Keep going, try it slowly';
    $('counts').textContent = `${r.counts.correct} clear · ${r.counts.unclear} unclear · ${r.counts.missed} missed · ${r.counts.extra} extra` + (typeof r.confidence === 'number' && r.confidence > 0 ? ` · confidence ${Math.round(r.confidence * 100)}%` : '');
    $('heard').innerHTML = 'Heard: “' + esc(r.transcript.trim()) + '”';
    const extras = r.ops.filter((o) => o.type === 'extra').map((o) => `<span class="w extra" title="Extra word heard">${esc(o.heard)}</span>`);
    $('resultWords').innerHTML = st.map((s) => `<button class="w ${s.type}" data-w="${esc(s.text)}" title="${s.type === 'unclear' ? 'Heard: ' + esc(s.op.heard) : s.type}">${esc(s.text)}</button>`).join('') + extras.join('');
    const seen = new Set();
    $('tips').innerHTML = r.ops.filter((o) => (o.type === 'unclear' || o.type === 'missed') && !seen.has(o.target) && seen.add(o.target)).slice(0, 6)
      .map((o) => `<li class="${o.type}"><b>${esc(o.target)}</b>${o.type === 'unclear' ? ` <span class="h">heard “${esc(o.heard)}”</span>` : ''}<br>${esc(o.tip)}</li>`).join('')
      || '<li style="border-left-color:var(--ok)">Every word came through. Try a faster rate or the next sentence.</li>';
    $('resultCard').hidden = false;
    record(target, r);
    return r;
  }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function record(sentence, r) {
    store.history.unshift({ sentence, score: r.score, t: Date.now() }); store.history = store.history.slice(0, 300);
    const d = today(); if (!store.days.includes(d)) store.days.push(d);
    r.ops.forEach((o) => { if (o.ti === undefined) return; const w = (store.words[o.target] ||= { ok: 0, bad: 0 }); o.type === 'correct' ? w.ok++ : w.bad++; });
    save(); renderProgress(); renderSentences();
  }
  function streak() {
    const set = new Set(store.days); let n = 0; const d = new Date();
    if (!set.has(today())) d.setDate(d.getDate() - 1);
    for (;;) { const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (!set.has(k)) break; n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const STOP = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'in', 'on', 'i', 'is', 'it', 'for']);
  function weakest() { return Object.entries(store.words).filter(([w, s]) => s.bad > 0 && !STOP.has(w)).map(([w, s]) => ({ w, rate: s.bad / (s.ok + s.bad), n: s.bad })).sort((a, b) => b.rate - a.rate || b.n - a.n).slice(0, 12); }
  function renderProgress() {
    $('streak').textContent = streak(); $('attempts').textContent = store.history.length;
    const recent = store.history.slice(0, 20); $('avg').textContent = recent.length ? Math.round(recent.reduce((s, x) => s + x.score, 0) / recent.length) : '–';
    const wk = weakest();
    $('weak').innerHTML = wk.length ? wk.map((x) => `<button class="chip w" data-w="${esc(x.w)}" title="Missed ${x.n}×">${esc(x.w)}<span class="s">${Math.round(x.rate * 100)}%</span></button>`).join('') : '<span class="muted small">None yet. Practice a few sentences.</span>';
    $('drill').hidden = wk.length < 2;
    $('history').innerHTML = store.history.slice(0, 15).map((h) => `<li><span class="hs" style="color:${h.score >= 85 ? '#86efac' : h.score >= 60 ? '#fcd34d' : '#fca5a5'}">${h.score}</span><span class="ht" title="${esc(h.sentence)}">${esc(h.sentence)}</span></li>`).join('') || '<li class="muted">No attempts yet.</li>';
  }
  $('drill').addEventListener('click', () => { const w = weakest().slice(0, 6).map((x) => x.w); setTarget(w.join(' ')); });
  $('clear').addEventListener('click', () => { if (confirm('Clear all practice history and weak words?')) { store.history = []; store.words = {}; store.days = []; save(); renderProgress(); renderSentences(); } });

  setTarget(store.prefs.lastTarget || SETS[currentSet][0]);
  $('target').addEventListener('change', () => { store.prefs.lastTarget = $('target').value; save(); });
  renderProgress();
  window.AccentCoach = { grade }; // test hook
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
