# AccentCoach

Pronunciation practice that runs entirely in your browser. Pick a sentence, listen to it, say it out loud, and see which words came through clearly.

**Live app:** https://shaikbasha1437.github.io/accentcoach/

## Features
- **Practice sets:** everyday phrases, job interview answers, tech/QA phrases, tricky sounds (th / v / w / r / l), and word stress pairs. Or type your own sentence.
- **Listen:** text-to-speech with voice and rate picker, a slow mode, word highlighting while it reads, and click any word to hear it alone.
- **Speak:** the browser's speech recognition captures your attempt (US, UK, or Indian English models), with live interim text.
- **Compare:** word-level edit-distance alignment between the target and what was heard. Case, punctuation, numbers ("3" = "three"), contractions, and common homophones are normalized. Each word is marked **clear**, **unclear** (heard as something else), or **missed**, and extra words are shown.
- **Score 0–100** plus tips for common sound confusions (th→s/d/f, v↔w, r↔l, dropped final -s/-ed, p/b, ee/i). Recognition alternatives are all scored and the best is kept; low confidence lowers the score slightly.
- **Progress** in localStorage: best score per sentence, daily streak, recent attempts, and a weakest-words list you can drill.
- **Record and play back** your own attempt (MediaRecorder) to compare with the reference voice.
- Installable PWA; the app shell works offline (recognition itself may need a connection).

## Browser support
Speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`) works in **Chrome and Edge**. Safari support is partial and **Firefox doesn't support it**; there the app shows a notice and you can still listen, record, and type a transcript to try scoring.

## Privacy
There is no server. Progress is saved only in your browser. Speech-to-text is done by your browser: in Chrome and Edge, audio may be sent to the browser maker's speech service. Recordings stay in memory and are never uploaded.

## Development
```
npm test        # Node tests for normalization, alignment, scoring, tips
python3 -m http.server   # then open http://localhost:8000
```
Core logic lives in `coach-core.js` (no dependencies, works in Node and the browser).

## License
MIT
