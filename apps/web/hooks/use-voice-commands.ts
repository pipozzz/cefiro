"use client";

import { useEffect, useRef, useState } from "react";

export type VoiceCommand = {
  /** Lower-case phrases; a command fires when the transcript contains one. */
  phrases: string[];
  action: () => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") {
    return null;
  }

  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };

  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Hands-free voice commands via the Web Speech API. Listens continuously
 * while `enabled` (auto-restarting through the browser's silence timeout) and
 * fires the first command whose phrase appears in a final transcript. Degrades
 * silently: on a browser without SpeechRecognition, `supported` is false and
 * nothing runs. Speech recognition itself is a device/browser capability — the
 * caller shows the toggle only when `supported`.
 */
export function useVoiceCommands({
  enabled,
  commands,
  lang = "sk-SK",
}: {
  enabled: boolean;
  commands: VoiceCommand[];
  lang?: string;
}): { supported: boolean; listening: boolean } {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  // Keep the latest commands without restarting recognition on every render.
  const commandsRef = useRef(commands);

  commandsRef.current = commands;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const Ctor = getRecognitionCtor();

    if (!Ctor) {
      return;
    }

    const recognition = new Ctor();

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    let stopped = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        if (!result?.isFinal) {
          continue;
        }

        const transcript = (result[0]?.transcript ?? "").toLowerCase().trim();

        if (!transcript) {
          continue;
        }

        const match = commandsRef.current.find((command) =>
          command.phrases.some((phrase) => transcript.includes(phrase))
        );

        match?.action();
      }
    };

    recognition.onend = () => {
      // Chrome ends the session after a silence; keep listening while enabled.
      if (stopped) {
        setListening(false);

        return;
      }

      try {
        recognition.start();
      } catch {
        setListening(false);
      }
    };

    recognition.onerror = () => {
      // "no-speech"/"aborted" fire routinely; onend handles the restart.
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }

    return () => {
      stopped = true;

      try {
        recognition.stop();
      } catch {
        // already stopped
      }

      setListening(false);
    };
  }, [enabled, lang]);

  return { supported, listening };
}
