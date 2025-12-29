
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Blob } from '@google/genai';

interface LiveTutorProps {
  language: string;
  level: string;
}

const LiveTutor: React.FC<LiveTutorProps> = ({ language, level }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [transcription, setTranscription] = useState<string[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const createBlob = (data: Float32Array): Blob => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startSession = async () => {
    setStatus('connecting');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioContextRef.current = outputAudioCtx;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          setStatus('active');
          setIsActive(true);
          const source = inputAudioCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: createBlob(inputData) });
            });
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputAudioCtx.destination);
        },
        onmessage: async (message) => {
          if (message.serverContent?.outputTranscription) {
            setTranscription(prev => [...prev.slice(-4), `AI: ${message.serverContent!.outputTranscription!.text}`]);
          }
          if (message.serverContent?.inputTranscription) {
            setTranscription(prev => [...prev.slice(-4), `You: ${message.serverContent!.inputTranscription!.text}`]);
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioCtx.currentTime);
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioCtx, 24000, 1);
            const source = outputAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioCtx.destination);
            source.addEventListener('ended', () => sourcesRef.current.delete(source));
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
            sourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          }
        },
        onerror: (e) => {
          console.error('Live API Error:', e);
          setStatus('idle');
          setIsActive(false);
        },
        onclose: () => {
          setStatus('idle');
          setIsActive(false);
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        systemInstruction: `You are a friendly ${language} language tutor for a ${level} level student. Speak clearly, encourage the user, and help them practice conversation. Occasionally correct their grammar in a kind way.`,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    });

    sessionRef.current = await sessionPromise;
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    setIsActive(false);
    setStatus('idle');
  };

  return (
    <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4">
        <div className={`w-3 h-3 rounded-full ${status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></div>
      </div>
      
      <div className="flex flex-col items-center mb-6">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-indigo-600 scale-110' : 'bg-indigo-800'}`}>
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <h3 className="mt-4 text-xl font-bold">AI Voice Tutor</h3>
        <p className="text-indigo-200 text-sm">Practice speaking {language}</p>
      </div>

      <div className="space-y-2 mb-6 h-32 overflow-y-auto custom-scrollbar bg-indigo-950/50 rounded-xl p-3 text-xs font-mono">
        {transcription.length === 0 && <p className="text-indigo-400 italic">Conversations will appear here...</p>}
        {transcription.map((t, i) => (
          <div key={i} className={t.startsWith('You') ? 'text-indigo-300' : 'text-emerald-300'}>{t}</div>
        ))}
      </div>

      <button
        onClick={isActive ? stopSession : startSession}
        disabled={status === 'connecting'}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
          isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'
        } ${status === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {status === 'connecting' ? 'Connecting...' : isActive ? 'End Session' : 'Start Practicing'}
      </button>
    </div>
  );
};

export default LiveTutor;
