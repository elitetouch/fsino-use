'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isOnline } from '@/lib/offline/network';

/**
 * An in-app microphone button, for the screens where the keyboard has
 * no microphone of its own.
 *
 * READ THIS BEFORE USING IT ANYWHERE ELSE. This is NOT the same thing as
 * the keyboard microphone, and it is the weaker of the two:
 *
 *   Keyboard mic (Gboard, iOS dictation)
 *     - Runs on-device for supported languages on modern Android/iOS.
 *     - No audio leaves the phone. No data cost. Works with no signal.
 *     - We write no code and request no permission.
 *
 *   This hook (Web Speech API)
 *     - Chrome STREAMS THE AUDIO TO GOOGLE'S SERVERS to transcribe it.
 *       Safari uses Apple's. The audio leaves the device.
 *     - Costs the farmer data, and does nothing with no signal.
 *     - Requires a microphone permission prompt.
 *
 * So this exists for desktop and for keyboards with no mic, and the UI
 * must keep pointing phone users at their keyboard. Do not quietly make
 * this the default path on mobile — that would move a farmer from
 * on-device transcription to someone else's server, spend their airtime
 * to do it, and break the offline-first promise, all without telling
 * them.
 *
 * SAFETY PROPERTIES:
 *   - Never starts on its own. Only an explicit user gesture starts it.
 *   - Stops on unmount, so navigating away can never leave a hot mic.
 *   - Hard stop after MAX_LISTEN_MS, so a forgotten tab cannot stream
 *     audio indefinitely.
 *   - No audio is stored, buffered or transmitted by us — we only ever
 *     read the text the browser hands back.
 *   - Requires a secure context; reports why when unavailable rather
 *     than failing silently.
 */

/**
 * Minimal shape of the Web Speech API.
 *
 * Hand-declared because TypeScript's DOM lib still does not ship these,
 * and `any` here would be a hole in exactly the code that touches a
 * device permission.
 */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/**
 * Nigerian English. Chrome ships an en-NG voice model, and it handles
 * local place names and the cadence of Nigerian English markedly better
 * than en-US does. If a browser rejects the tag it falls back on its own
 * default rather than failing, so there is nothing to guard here.
 */
const LANG = 'en-NG';

/**
 * Hard ceiling on one dictation. A farm record is a sentence; anything
 * past this is a tab someone walked away from, and a microphone that
 * stays open because nobody pressed stop is a privacy bug.
 */
const MAX_LISTEN_MS = 30_000;

/**
 * How many guesses to ask the recogniser for.
 *
 * Three is the useful range: the correct reading of a misheard word is
 * usually in the top few, and past that the alternatives degrade into
 * noise that would only give the parser more chances to be wrong.
 */
const MAX_ALTERNATIVES = 3;

export type DictationStatus =
  | 'unsupported'
  | 'insecure-context'
  | 'idle'
  | 'listening'
  | 'denied'
  | 'error';

export interface UseDictation {
  readonly status: DictationStatus;
  /** Words recognised but not yet final. Display only — never saved. */
  readonly interim: string;
  /** Human-readable reason, set alongside 'denied' and 'error'. */
  readonly message: string | null;
  readonly start: () => void;
  readonly stop: () => void;
  readonly isAvailable: boolean;
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * @param onText Called with each FINAL result as a list of the
 *               recogniser's ALTERNATIVES, best-guess first. Interim
 *               results never reach it — a farmer should not watch a
 *               number rewrite itself as the recogniser changes its
 *               mind.
 *
 *               The caller is expected to parse each alternative and
 *               keep whichever yields a real record. This is the main
 *               defence against a recogniser trained on American
 *               English mishearing Nigerian speech: when "three crates"
 *               comes back as "three grits", the correct words are
 *               often sitting in alternative two or three, and the
 *               parser can tell which one is a farm record when the
 *               recogniser cannot.
 */
export function useDictation(onText: (alternatives: string[]) => void): UseDictation {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kept in a ref so the recogniser's handlers always call the latest
  // closure without us tearing down and rebuilding the recogniser.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Resolved after mount: on the server there is no window, and
  // rendering a mic button that vanishes on hydration is worse than
  // rendering it a frame late.
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (getCtor() === null) {
      setStatus('unsupported');
      return;
    }
    // getUserMedia and the Speech API both require a secure context.
    // Saying so beats a permission prompt that silently never appears.
    if (!window.isSecureContext) {
      setStatus('insecure-context');
      return;
    }
    setAvailable(true);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    setInterim('');
    const rec = recognitionRef.current;
    if (rec) {
      // Detach before stopping so a late event cannot set state on a
      // component that is already on its way out.
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        // Already stopped. Nothing to do, and nothing worth surfacing.
      }
      recognitionRef.current = null;
    }
    setStatus((s) => (s === 'listening' ? 'idle' : s));
  }, [clearTimer]);

  // The important cleanup: leaving the page must close the microphone.
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (Ctor === null || !available) return;
    if (recognitionRef.current !== null) return; // already listening

    // Say it before opening the microphone, not after it fails.
    //
    // Browser speech recognition is not done on the device — the audio
    // goes to the browser vendor's servers — so with no signal there
    // is nothing to try. Starting anyway lights the button, asks for
    // the microphone, listens at a farmer who is talking to their
    // phone, and only then reports a network error. Checking first
    // costs them nothing and tells them what will actually work.
    if (!isOnline()) {
      setStatus('error');
      setMessage(
        'Voice typing needs a connection, because your phone sends what you say away to be written out. Type it here instead, or use the microphone on your keyboard, which works offline. Saving works either way.',
      );
      return;
    }

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      setStatus('error');
      setMessage('Could not start the microphone on this device.');
      return;
    }

    rec.lang = LANG;
    // One utterance, not an open channel. `continuous` would keep the
    // microphone live between sentences, which is both a privacy
    // posture we do not want and a way to run up someone's data.
    rec.continuous = false;
    rec.interimResults = true;
    // Several guesses, not one. The recogniser ranks by acoustic
    // likelihood against a model that has not heard much Nigerian
    // English; we re-rank by "which of these is actually a farm
    // record", which is a judgement it cannot make and we can.
    rec.maxAlternatives = MAX_ALTERNATIVES;

    rec.onstart = () => {
      setStatus('listening');
      setMessage(null);
    };

    rec.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) {
          // Hand up every alternative, best-guess first, de-duplicated
          // and trimmed. The caller decides which one is a record.
          const alternatives: string[] = [];
          for (let a = 0; a < result.length && a < MAX_ALTERNATIVES; a += 1) {
            const t = (result[a]?.transcript ?? '').trim();
            if (t !== '' && !alternatives.includes(t)) alternatives.push(t);
          }
          if (alternatives.length > 0) onTextRef.current(alternatives);
        } else {
          pending += result[0]?.transcript ?? '';
        }
      }
      setInterim(pending);
    };

    rec.onerror = (event) => {
      clearTimer();
      setInterim('');
      recognitionRef.current = null;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('denied');
        setMessage('Microphone blocked. Allow it in your browser settings, or just type.');
        return;
      }
      if (event.error === 'no-speech') {
        setStatus('idle');
        setMessage('Didn’t catch that. Try again, or type it.');
        return;
      }
      if (event.error === 'aborted') {
        setStatus('idle');
        return;
      }
      if (event.error === 'network') {
        // A `network` error WHILE ONLINE does not mean the network.
        //
        // Browser speech recognition is not done on the device — it is
        // a service the browser vendor provides, and some browsers do
        // not provide one. Brave ships without Google's, so it reports
        // `network` the instant you press the button, however good the
        // connection is. Telling a farmer with four bars that voice
        // "needs a connection" sends them to go and find signal they
        // already have.
        setStatus('error');
        setMessage(
          isOnline()
            ? 'This browser can’t do voice typing. Use Chrome for the microphone, or just type it here. Everything else works normally.'
            : 'Voice needs a connection. Type it instead, and saving still works offline.',
        );
        return;
      }

      setStatus('error');
      setMessage('The microphone stopped unexpectedly. Try again, or type it.');
    };

    rec.onend = () => {
      clearTimer();
      setInterim('');
      recognitionRef.current = null;
      setStatus((s) => (s === 'listening' ? 'idle' : s));
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setStatus('error');
      setMessage('Could not start the microphone. Try again, or type it.');
      return;
    }

    timerRef.current = setTimeout(stop, MAX_LISTEN_MS);
  }, [available, clearTimer, stop]);

  return { status, interim, message, start, stop, isAvailable: available };
}
