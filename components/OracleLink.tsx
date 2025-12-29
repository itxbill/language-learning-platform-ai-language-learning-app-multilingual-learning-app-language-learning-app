
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, Blob } from '@google/genai';

interface OracleLinkProps {
  language: string;
  level: string;
  onSuccess: () => void;
}

const OracleLink: React.FC<OracleLinkProps> = ({ language, level, onSuccess }) => {
  const [status, setStatus] = useState<'idle' | 'linking' | 'online'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const sessionRef = useRef<any>(null);

  const startOracleSession = async () => {
    setStatus('linking');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const inputAudioCtx = new AudioContext({ sampleRate: 16000 });
    const outputAudioCtx = new AudioContext({ sampleRate: 24000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          setStatus('online');
          const source = inputAudioCtx.createMediaStreamSource(stream);
          const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            let binary = '';
            const bytes = new Uint8Array(int16.buffer);
            for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
            sessionPromise.then(s => s.sendRealtimeInput({ media: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(processor);
          processor.connect(inputAudioCtx.destination);
        },
        onmessage: async (msg) => {
          if (msg.serverContent?.outputTranscription) setLogs(p => [...p.slice(-5), `Oracle: ${msg.serverContent!.outputTranscription!.text}`]);
          if (msg.serverContent?.inputTranscription) setLogs(p => [...p.slice(-5), `User: ${msg.serverContent!.inputTranscription!.text}`]);
          
          const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audioBase64) {
            const binaryString = atob(audioBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const int16 = new Int16Array(bytes.buffer);
            const buffer = outputAudioCtx.createBuffer(1, int16.length, 24000);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < int16.length; i++) data[i] = int16[i] / 32768.0;
            const source = outputAudioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioCtx.destination);
            source.start();
          }
        },
        onerror: () => setStatus('idle'),
        onclose: () => setStatus('idle')
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `You are the "Linguist Oracle". You speak ${language}. Challenge the user with a 2-minute conversation appropriate for ${level} level. If they do well, say "ACCESS GRANTED".`,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      }
    });
    sessionRef.current = await sessionPromise;
  };

  return (
    <div className="bg-[#0F172A] border-4 border-cyan-500 rounded-[2.5rem] p-8 shadow-[0_0_30px_rgba(6,182,212,0.3)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/20">
        <div className={`h-full bg-cyan-400 transition-all duration-1000 ${status === 'online' ? 'w-full shadow-[0_0_15px_cyan]' : 'w-0'}`}></div>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${status === 'online' ? 'border-cyan-400 shadow-[0_0_30px_cyan] animate-pulse' : 'border-slate-700'}`}>
          <svg className={`w-12 h-12 ${status === 'online' ? 'text-cyan-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="mt-4 text-2xl font-black text-white tracking-widest uppercase">Oracle Link</h3>
        <p className="text-cyan-400 font-bold text-xs">COMMUNICATION PROTOCOL: {status.toUpperCase()}</p>
      </div>

      <div className="bg-black/50 border-2 border-slate-800 rounded-2xl p-4 h-40 overflow-y-auto mb-8 font-mono text-xs space-y-2">
        {logs.map((log, i) => (
          <div key={i} className={log.startsWith('Oracle') ? 'text-cyan-400' : 'text-white'}>{log}</div>
        ))}
        {status === 'idle' && <div className="text-slate-600 animate-pulse">TERMINAL READY. AWAITING CONNECTION...</div>}
      </div>

      <button
        onClick={status === 'online' ? () => sessionRef.current?.close() : startOracleSession}
        className={`w-full py-5 rounded-[1.5rem] font-black text-xl transition-all ${
          status === 'online' ? 'bg-rose-600 hover:bg-rose-700 shadow-[0_6px_0_0_#9F1239]' : 'bg-cyan-500 hover:bg-cyan-600 shadow-[0_6px_0_0_#0891B2]'
        } text-white active:translate-y-[4px] active:shadow-none`}
      >
        {status === 'linking' ? 'INITIATING...' : status === 'online' ? 'TERMINATE LINK' : 'INITIATE ORACLE LINK'}
      </button>
    </div>
  );
};

export default OracleLink;
