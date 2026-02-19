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
  const lastProcessedIndex = useRef(-1); // 🔥 Håll koll på vilket index vi senast tog emot

  // 🔥 NY: Ref för att kunna starta om sig själv inifrån onend
  const startListeningRef = useRef<() => void>(() => {});
  // 🔥 NY: Skydd mot oändliga loopar vid fel (t.ex. NO_SPACE)
  const restartCount = useRef(0);
  const lastStartTime = useRef(0);

  useEffect(() => {
    setHasSupport(
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
  }, []);

  // Städning vid unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isStoppedManually.current = true; // 🔥 Markera som manuellt stopp vid unmount för att undvika fel
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Återställ räknare om det var länge sedan vi startade (stabil session > 5s)
    if (Date.now() - lastStartTime.current > 5000) {
      restartCount.current = 0;
    }
    lastStartTime.current = Date.now();

    // 1. Döda eventuell gammal instans för att garantera en "fresh start"
    if (recognitionRef.current) {
      isStoppedManually.current = true; // 🔥 Markera som manuellt stopp innan vi dödar den
      const oldRec = recognitionRef.current;
      recognitionRef.current = null; // 🔥 Koppla bort ref direkt så onend ignorerar den
      oldRec.abort();
    }

    isStoppedManually.current = false; // Vi vill lyssna nu
    lastProcessedIndex.current = -1; // Nollställ index för ny session

    // 2. Skapa en ny instans varje gång vi startar
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "sv-SE";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResultIndex = event.results.length - 1;
      const lastResult = event.results[lastResultIndex];

      // 🔥 FIX: Kolla att vi inte redan behandlat detta index
      if (lastResult.isFinal && lastResultIndex > lastProcessedIndex.current) {
        const text = lastResult[0].transcript;
        console.log("🎤 Mottog text:", text);
        lastProcessedIndex.current = lastResultIndex;
        setTranscript(text);
      }
    };

    recognition.onend = () => {
      // 🔥 FIX: Ignorera onend från gamla instanser för att undvika loopar
      if (recognition !== recognitionRef.current) {
        return;
      }

      // 🔥 FIX: Om vi inte stoppade manuellt, starta igen direkt!
      if (isStoppedManually.current) {
        console.log("🛑 Lyssning avslutad (manuellt)");
        setIsListening(false);
      } else {
        console.log("⚠️ Webbläsaren avbröt sessionen.");

        // Försök starta om om vi inte kraschar för ofta (max 10 ggr på kort tid)
        if (restartCount.current < 10) {
          console.log("🔄 Startar om sessionen automatiskt...");
          restartCount.current += 1;
          startListeningRef.current();
        } else {
          console.error("❌ För många omstarter (troligen fel), stoppar.");
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

  // 🔥 NY: Uppdatera ref så den pekar på senaste startListening
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

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
