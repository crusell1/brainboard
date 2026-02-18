import { useState, useEffect, useRef, useCallback } from "react";

// TypeScript-definitioner för Web Speech API (som saknas i standard-lib)
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Utöka Window-objektet
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [hasSupport, setHasSupport] = useState(false);
  const isStoppedManually = useRef(false); // 🔥 Håll koll på om VI stoppade den

  useEffect(() => {
    setHasSupport(
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  // Städning vid unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // 1. Döda eventuell gammal instans för att garantera en "fresh start"
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    isStoppedManually.current = false; // Vi vill lyssna nu

    // 2. Skapa en ny instans varje gång vi startar
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "sv-SE";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResultIndex = event.results.length - 1;
      const lastResult = event.results[lastResultIndex];

      if (lastResult.isFinal) {
        const text = lastResult[0].transcript;
        console.log("🎤 Mottog text:", text);
        setTranscript(text);
      }
    };

    recognition.onend = () => {
      // 🔥 FIX: Om vi inte stoppade manuellt, starta igen direkt!
      if (isStoppedManually.current) {
        console.log("🛑 Lyssning avslutad (manuellt)");
        setIsListening(false);
      } else {
        console.log("🔄 Webbläsaren avbröt - startar om automatiskt...");
        try {
          recognition.start();
        } catch (e) {
          console.error("Kunde inte återstarta:", e);
          setIsListening(false);
        }
      }
    };

    recognition.onerror = (event) => {
      // Om användaren nekat åtkomst eller tjänsten är nere, ge upp
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        isStoppedManually.current = true;
        setIsListening(false);
      }
      console.error("⚠️ Speech recognition error:", event.error);
    };

    try {
      console.log("🎤 Startar ny lyssnings-session...");
      recognition.start();
      setIsListening(true);
      recognitionRef.current = recognition;
    } catch (error) {
      console.error("Kunde inte starta röstigenkänning:", error);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    console.log("🛑 Stoppar lyssning...");
    isStoppedManually.current = true; // Markera att detta är ett manuellt stopp
    setIsListening(false);
    recognitionRef.current?.stop();
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport,
  };
}
