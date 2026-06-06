'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Ditado por voz (Web Speech API). Transcreve fala em pt-BR para texto.
 * Gratuito. A estruturação automática por IA virá em fase futura (Plus).
 */
export function VoiceDictationButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result) text += result[0].transcript;
      }
      if (text) onTranscript(text.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast.error('Não foi possível captar o áudio.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [onTranscript]);

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      try {
        recognition.start();
        setListening(true);
      } catch {
        /* já iniciado */
      }
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        listening
          ? 'border-rose-400/40 bg-rose-500/15 text-rose-300'
          : 'border-line text-fg-soft hover:bg-surface-2'
      }`}
      title="Ditar por voz"
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4 text-primary" />}
      {listening ? 'Ouvindo… toque para parar' : 'Ditar por voz'}
    </button>
  );
}
