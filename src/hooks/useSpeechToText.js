import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * useSpeechToText — the widget composer's mic button.
 *
 * Uses the browser's own SpeechRecognition, which is what gives us the
 * behaviour that matters here: `continuous = false` makes the engine decide
 * on its own when the speaker has finished and end the session, so the
 * visitor never has to remember to press stop. Previously the mic was a
 * decorative toggle that stayed "Listening…" until clicked a second time.
 *
 * Not available everywhere (Firefox has no implementation), so `supported`
 * is reported and the caller can still show the control — an unsupported
 * browser gets a short timed "listening" state that ends by itself rather
 * than a button that appears to hang.
 *
 * onTranscript(text, isFinal) fires as speech is recognised; interim results
 * stream in so the visitor sees words appear while they talk.
 */
const UNSUPPORTED_LISTEN_MS = 4000

export function useSpeechToText({ onTranscript, onStart, onError } = {}) {
  const [recording, setRecording] = useState(false)
  const [supported] = useState(
    () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
  const recRef = useRef(null)
  const timerRef = useRef(null)
  // Callbacks live in a ref so the recognition instance never closes over a
  // stale render's handlers, and so start/stop don't change identity when the
  // caller re-renders.
  const cbRef = useRef({})
  cbRef.current = { onTranscript, onStart, onError }

  const stop = useCallback(() => {
    clearTimeout(timerRef.current)
    const rec = recRef.current
    if (rec) {
      // onend still fires and clears the flag; guard against it throwing if
      // the session already ended on its own.
      try { rec.stop() } catch {}
    }
    setRecording(false)
  }, [])

  const start = useCallback(() => {
    cbRef.current.onStart?.()

    if (!supported) {
      // Keep the affordance honest: show the listening state briefly, then
      // end it by itself rather than leaving it stuck on.
      setRecording(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setRecording(false), UNSUPPORTED_LISTEN_MS)
      return
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    // The whole point: end the session once the speaker stops, instead of
    // listening until told otherwise.
    rec.continuous = false
    rec.interimResults = true
    rec.lang = typeof navigator !== 'undefined' ? (navigator.language || 'en-US') : 'en-US'

    rec.onresult = e => {
      let text = ''
      let isFinal = false
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript
        if (e.results[i].isFinal) isFinal = true
      }
      cbRef.current.onTranscript?.(text.trim(), isFinal)
    }
    // Fired when the engine decides the speaker has finished — including
    // after a silence — which is what stops the UI without a second click.
    rec.onend = () => { recRef.current = null; setRecording(false) }
    rec.onerror = e => {
      recRef.current = null
      setRecording(false)
      cbRef.current.onError?.(e?.error || 'speech-error')
    }

    try {
      rec.start()
      recRef.current = rec
      setRecording(true)
    } catch {
      // start() throws if a session is somehow already running.
      setRecording(false)
    }
  }, [supported])

  const toggle = useCallback(() => {
    if (recording) stop()
    else start()
  }, [recording, start, stop])

  // Never leave a live microphone session behind when the widget unmounts.
  useEffect(() => () => {
    clearTimeout(timerRef.current)
    try { recRef.current?.abort?.() } catch {}
  }, [])

  return { recording, supported, start, stop, toggle }
}
