
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { SUPPORTED_LANGUAGES } from './constants';
import { LanguageLevel, Lesson, QuizQuestion, GameState, AppView, VocabularyItem, PowerUp } from './types';
import { generateNarrativeQuest, generateBossBattle, generateInventoryArt } from './services/geminiService';
import OracleLink from './components/OracleLink';

const POWER_UPS: PowerUp[] = [
  { id: 'shield', name: 'Shield of Polyglot', icon: '🛡️', description: 'Survive one wrong answer in battle.', cost: 30, effect: 'shield' },
  { id: 'xp_boost', name: 'Elixir of Wisdom', icon: '🧪', description: 'Double XP for the next quest.', cost: 50, effect: 'xp_boost' },
  { id: 'extra_time', name: 'Hourglass of Echoes', icon: '⌛', description: 'Slower boss mechanics.', cost: 20, effect: 'extra_time' },
];

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('map');
  const [selectedLang, setSelectedLang] = useState(SUPPORTED_LANGUAGES[0]);
  const [level, setLevel] = useState<LanguageLevel>(LanguageLevel.BEGINNER);
  const [currentQuest, setCurrentQuest] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [combo, setCombo] = useState(0);
  const [qrUrl, setQrUrl] = useState<string>('');
  
  // Persistence with Streak Logic
  const [game, setGame] = useState<GameState>(() => {
    const saved = localStorage.getItem('linguist_ultra_pro_v2');
    const today = new Date().toISOString().split('T')[0];
    
    if (saved) {
      const state = JSON.parse(saved) as GameState;
      const lastLogin = state.lastLoginDate.split('T')[0];
      
      // Streak Logic
      if (lastLogin !== today) {
        const diff = Math.floor((new Date(today).getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          // Increment streak
          const newStreak = state.streak + 1;
          const dayIdx = (new Date().getDay() + 6) % 7; // Normalize Monday as 0
          const newProgress = [...state.streakProgress];
          newProgress[dayIdx] = true;
          return { ...state, streak: newStreak, streakProgress: newProgress, lastLoginDate: today };
        } else if (diff > 1) {
          // Reset streak
          return { ...state, streak: 1, streakProgress: [false, false, false, false, false, false, false], lastLoginDate: today };
        }
      }
      return state;
    }
    
    return {
      hearts: 5, maxHearts: 5, xp: 0, level: 1, gems: 100, streak: 1, 
      streakProgress: [false, false, false, false, false, false, false],
      lastLoginDate: today, inventory: [], unlockedRegions: ['Sector Alpha'], powerups: {}, activeBuffs: []
    };
  });

  useEffect(() => {
    localStorage.setItem('linguist_ultra_pro_v2', JSON.stringify(game));
    QRCode.toDataURL(window.location.href).then(setQrUrl);
  }, [game]);

  const initiateQuest = async (topic: string) => {
    if (game.hearts <= 0) return alert("HEARTS DEPLETED! VISIT THE ARMORY.");
    setLoading(true);
    try {
      const quest = await generateNarrativeQuest(selectedLang.name, level, topic);
      setCurrentQuest(quest);
      setView('quest');
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const startBattle = async () => {
    if (!currentQuest) return;
    setLoading(true);
    try {
      const quiz = await generateBossBattle(selectedLang.name, currentQuest.content);
      setQuizQuestions(quiz);
      setQuizIndex(0);
      setCombo(0);
      setView('battle');
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const handleBattleAnswer = async (answer: string) => {
    const isCorrect = answer === quizQuestions[quizIndex].correctAnswer;
    
    if (isCorrect) {
      setCombo(c => c + 1);
      const earnedXp = 25 + (combo * 5);
      
      if (quizIndex === quizQuestions.length - 1 && currentQuest) {
        const word = currentQuest.vocabulary[0];
        const art = await generateInventoryArt(word.word, selectedLang.name);
        
        // Mark today's streak as complete
        const dayIdx = (new Date().getDay() + 6) % 7;
        const newProgress = [...game.streakProgress];
        newProgress[dayIdx] = true;

        setGame(g => ({
          ...g,
          xp: (g.xp + earnedXp) >= g.level * 250 ? 0 : g.xp + earnedXp,
          level: (g.xp + earnedXp) >= g.level * 250 ? g.level + 1 : g.level,
          gems: g.gems + 25 + (combo * 3),
          streakProgress: newProgress,
          inventory: [...g.inventory, { ...word, imageUrl: art || undefined, mastery: 100 }],
          activeBuffs: []
        }));
        
        setView('map');
      } else {
        setQuizIndex(p => p + 1);
      }
    } else {
      setCombo(0);
      setGame(g => ({ ...g, hearts: Math.max(0, g.hearts - 1) }));
      if (game.hearts <= 1) setView('map');
    }
  };

  const Weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 pb-28 selection:bg-cyan-500/30">
      {/* BACKGROUND DECOR */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-500 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-0 -right-20 w-96 h-96 bg-cyan-500 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      {/* ULTRA NAVIGATION */}
      <nav className="sticky top-0 z-[100] bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
              <span className="text-xl">❤️</span>
              <span className="text-xl font-black text-rose-400">{game.hearts}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
              <span className="text-xl">💎</span>
              <span className="text-xl font-black text-cyan-400">{game.gems}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('streak')}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2 rounded-2xl border border-white/20 shadow-xl animate-bounce-subtle"
            >
              <span className="text-xl">🔥</span>
              <span className="font-black text-white">{game.streak}</span>
            </button>
            
            <div className="relative group">
              <div className="flex bg-slate-800/80 p-2 rounded-2xl border border-white/10 cursor-pointer hover:bg-slate-700 transition-colors">
                <span className="text-2xl mr-2">{selectedLang.flag}</span>
                <span className="font-black uppercase tracking-widest text-xs self-center">{selectedLang.name}</span>
              </div>
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-white/10 rounded-[1.5rem] p-2 hidden group-hover:grid grid-cols-4 gap-2 shadow-2xl z-[110]">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button 
                    key={lang.code} 
                    onClick={() => setSelectedLang(lang)}
                    className={`text-2xl p-2 rounded-xl hover:bg-white/10 transition-all ${selectedLang.code === lang.code ? 'bg-cyan-500/20 shadow-[0_0_10px_cyan]' : ''}`}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setView('share')} className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg hover:bg-indigo-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeWidth={2} /></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-10">

        {/* VIEW: STREAK DASHBOARD */}
        {view === 'streak' && (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in duration-500">
            <div className="bg-slate-800/50 border border-white/10 rounded-[3rem] p-12 text-center backdrop-blur-md relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-500 animate-slide"></div>
               <span className="text-9xl mb-8 inline-block animate-bounce-subtle">🔥</span>
               <h1 className="text-6xl font-black mb-4 tracking-tighter">THE FLAME OF KNOWLEDGE</h1>
               <p className="text-2xl text-slate-400 font-bold mb-12 italic">You've mastered the language for {game.streak} days straight!</p>
               
               <div className="flex justify-center gap-4 mb-16">
                  {Weekdays.map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-3">
                      <div className={`w-14 h-24 rounded-full border-2 flex items-end p-2 transition-all duration-700 ${game.streakProgress[i] ? 'bg-orange-500/20 border-orange-500' : 'bg-slate-700 border-white/5'}`}>
                         <div className={`w-full rounded-full transition-all duration-1000 ${game.streakProgress[i] ? 'h-full bg-orange-500 shadow-[0_0_20px_#f97316]' : 'h-0 bg-slate-600'}`}></div>
                      </div>
                      <span className={`font-black text-sm ${game.streakProgress[i] ? 'text-orange-400' : 'text-slate-600'}`}>{day}</span>
                    </div>
                  ))}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-700/50 p-8 rounded-[2rem] border border-white/5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Current</p>
                    <h3 className="text-3xl font-black">{game.streak} Days</h3>
                  </div>
                  <div className="bg-slate-700/50 p-8 rounded-[2rem] border border-white/5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">XP Bonus</p>
                    <h3 className="text-3xl font-black text-orange-400">+{Math.min(game.streak * 5, 50)}%</h3>
                  </div>
                  <div className="bg-slate-700/50 p-8 rounded-[2rem] border border-white/5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Status</p>
                    <h3 className="text-3xl font-black text-cyan-400">{game.streak > 3 ? 'Elite' : 'Rookie'}</h3>
                  </div>
               </div>
               
               <button onClick={() => setView('map')} className="mt-12 px-12 py-5 bg-white text-slate-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform active:scale-95">CONTINUE JOURNEY</button>
            </div>
          </div>
        )}

        {/* VIEW: WORLD MAP (ALPHA NEXUS) */}
        {view === 'map' && !loading && (
          <div className="animate-in slide-in-from-bottom-8 duration-500 space-y-16">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
              <div>
                <h1 className="text-8xl font-black tracking-tighter italic text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">NEXUS PRIME</h1>
                <p className="text-2xl text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-3">
                  <span className="w-12 h-1 bg-cyan-500 rounded-full"></span> 
                  System: {selectedLang.name.toUpperCase()} CORE
                </p>
              </div>
              <div className="flex bg-slate-800/50 p-2 rounded-3xl border border-white/10 h-fit">
                {Object.values(LanguageLevel).map(l => (
                  <button 
                    key={l} onClick={() => setLevel(l)}
                    className={`px-8 py-3 rounded-2xl font-black text-sm transition-all ${level === l ? 'bg-cyan-500 text-white shadow-[0_0_20px_cyan]' : 'text-slate-500 hover:text-white'}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { topic: 'Neural Greetings', icon: '🧠', color: 'from-cyan-500 to-blue-500' },
                  { topic: 'Survival Protocols', icon: '⛺', color: 'from-rose-500 to-orange-500' },
                  { topic: 'Merchant Logic', icon: '⚖️', color: 'from-emerald-500 to-teal-500' },
                  { topic: 'System Overload', icon: '⚡', color: 'from-violet-500 to-indigo-500' },
                  { topic: 'Data Retrieval', icon: '📂', color: 'from-amber-500 to-yellow-500' },
                  { topic: 'Oracle Whispers', icon: '🔮', color: 'from-fuchsia-500 to-pink-500' },
                ].map((q, idx) => (
                  <button 
                    key={idx}
                    onClick={() => initiateQuest(q.topic)}
                    className="relative group bg-slate-800/40 border border-white/10 rounded-[2.5rem] p-10 text-left overflow-hidden transition-all hover:border-white/40 hover:scale-[1.02] hover:shadow-2xl active:scale-95"
                  >
                    <div className={`absolute -right-10 -bottom-10 w-40 h-40 bg-gradient-to-br ${q.color} opacity-10 group-hover:opacity-30 blur-3xl transition-opacity`}></div>
                    <div className={`w-16 h-16 bg-gradient-to-br ${q.color} rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-xl`}>
                      {q.icon}
                    </div>
                    <h3 className="text-3xl font-black mb-2">{q.topic}</h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Zone: {idx + 1} // Level: {level}</p>
                    <div className="mt-8 flex items-center gap-2">
                       <span className="text-xs font-black text-cyan-400">INITIATE LINK</span>
                       <svg className="w-4 h-4 text-cyan-400 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7l5 5m0 0l-5 5m5-5H6" strokeWidth={3} /></svg>
                    </div>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-4 space-y-10">
                 <div className="bg-slate-800/80 border border-white/10 rounded-[3rem] p-10 backdrop-blur-lg">
                    <h4 className="text-xl font-black mb-8 border-b border-white/5 pb-4 tracking-tighter">PROGRESS ARCHIVE</h4>
                    <div className="space-y-6">
                       <div className="flex justify-between items-end">
                          <span className="text-sm font-black text-slate-400 uppercase">Level Progress</span>
                          <span className="text-xs font-mono text-cyan-400">{game.xp}/{game.level * 250}</span>
                       </div>
                       <div className="h-4 bg-slate-900 rounded-full border border-white/10 overflow-hidden">
                          <div className="h-full bg-cyan-500 transition-all duration-1000 shadow-[0_0_15px_cyan]" style={{ width: `${(game.xp/(game.level*250))*100}%` }}></div>
                       </div>
                    </div>
                    
                    <div className="mt-12 grid grid-cols-2 gap-4">
                       <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase">Mastery</p>
                          <p className="text-2xl font-black">{Math.floor(game.inventory.length * 1.5)}%</p>
                       </div>
                       <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                          <p className="text-[10px] font-black text-slate-500 uppercase">Archive</p>
                          <p className="text-2xl font-black">{game.inventory.length}</p>
                       </div>
                    </div>
                 </div>

                 <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                      <h4 className="text-3xl font-black mb-4">Voice Oracle</h4>
                      <p className="text-indigo-100 font-bold mb-8 italic">Engage in high-fidelity vocal sync with our AI core. Double XP for clear pronunciation.</p>
                      <button 
                        onClick={() => setView('oracle')}
                        className="w-full py-5 bg-white text-indigo-900 rounded-2xl font-black text-xl hover:scale-105 transition-transform"
                      >
                        SYNC NOW 🎙️
                      </button>
                    </div>
                    <div className="absolute top-0 right-0 p-8 opacity-10 scale-[3] group-hover:rotate-12 transition-transform">🛰️</div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* LOADING: ULTRA GENERATION */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-40">
            <div className="relative w-40 h-40">
               <div className="absolute inset-0 border-[10px] border-cyan-500/20 rounded-full"></div>
               <div className="absolute inset-0 border-[10px] border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
               <div className="absolute inset-4 border-[6px] border-rose-500 border-b-transparent rounded-full animate-spin-reverse"></div>
               <div className="absolute inset-0 flex items-center justify-center text-5xl">⚡</div>
            </div>
            <h2 className="text-5xl font-black text-white mt-12 tracking-tighter italic animate-pulse">RECONFIGURING REALITY...</h2>
          </div>
        )}

        {/* VIEW: NARRATIVE QUEST */}
        {view === 'quest' && currentQuest && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-12 duration-500">
            <div className="bg-slate-800/80 border border-white/10 rounded-[4rem] p-16 shadow-2xl backdrop-blur-xl mb-20">
              <div className="flex justify-between items-start mb-12">
                 <span className="px-6 py-2 bg-indigo-500/20 text-indigo-400 rounded-full font-black text-xs uppercase tracking-[0.3em] border border-indigo-500/30">CHAPTER 0{Math.floor(game.level / 2) + 1}</span>
                 <button onClick={() => setView('map')} className="text-slate-500 hover:text-white"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
              </div>

              <h1 className="text-7xl font-black mb-12 tracking-tighter leading-none">{currentQuest.title}</h1>
              
              <div className="p-10 bg-slate-900/50 rounded-[2.5rem] border-l-8 border-cyan-500 mb-16 italic text-slate-300 font-bold text-2xl leading-relaxed">
                "{currentQuest.narrative}"
              </div>

              <div className="space-y-12 mb-20">
                 {currentQuest.content.split('\n').map((p, i) => (
                   <p key={i} className="text-3xl font-medium text-slate-400 leading-snug">{p}</p>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
                <div className="space-y-8">
                   <h3 className="text-2xl font-black text-cyan-400 flex items-center gap-3">
                     <span className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">💎</span> DECODED DATA
                   </h3>
                   <div className="space-y-4">
                      {currentQuest.vocabulary.map((v, i) => (
                        <div key={i} className="p-6 bg-slate-700/30 border border-white/5 rounded-3xl flex items-center justify-between group hover:bg-slate-700/50 transition-all">
                           <div>
                              <p className="text-3xl font-black text-white">{v.word}</p>
                              <p className="text-cyan-500 font-bold uppercase text-[10px] tracking-widest">{v.translation}</p>
                           </div>
                           <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-xl group-hover:scale-125 transition-transform">🎴</div>
                        </div>
                      ))}
                   </div>
                </div>
                <div className="space-y-8">
                   <h3 className="text-2xl font-black text-rose-400 flex items-center gap-3">
                     <span className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center">⚔️</span> SYNC PATTERNS
                   </h3>
                   <div className="space-y-4">
                      {currentQuest.examples.map((ex, i) => (
                        <div key={i} className="p-8 bg-rose-500/5 border border-rose-500/10 rounded-[2rem] relative group overflow-hidden">
                           <p className="text-2xl font-black text-white mb-2">{ex.original}</p>
                           <p className="text-rose-400 font-bold italic text-sm">{ex.translated}</p>
                           <div className="absolute right-0 bottom-0 p-4 opacity-5 translate-y-4 translate-x-4 group-hover:translate-y-0 group-hover:translate-x-0 transition-transform">⚡</div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <button 
                onClick={startBattle}
                className="w-full py-10 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-[3rem] font-black text-4xl shadow-[0_15px_0_0_#312e81] hover:translate-y-[-5px] active:translate-y-[5px] active:shadow-none transition-all"
              >
                ENTER COMBAT ARENA 👹
              </button>
            </div>
          </div>
        )}

        {/* VIEW: BATTLE (HIGH STAKES) */}
        {view === 'battle' && quizQuestions.length > 0 && (
          <div className="max-w-3xl mx-auto pt-10">
            <div className="bg-slate-900 border-[10px] border-rose-600 rounded-[5rem] p-16 shadow-[0_30px_0_0_#9f1239] relative animate-in zoom-in-95 duration-300">
               {combo > 1 && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-10 py-4 bg-orange-500 text-white rounded-full font-black text-3xl shadow-2xl animate-bounce">
                    COMBO x{combo} 🔥
                  </div>
               )}

               <div className="flex justify-between items-center mb-16">
                  <div className="h-4 flex-1 bg-white/5 rounded-full border border-white/10 overflow-hidden mr-6">
                     <div className="h-full bg-rose-500 shadow-[0_0_20px_#f43f5e] transition-all duration-500" style={{ width: `${((quizIndex + 1) / quizQuestions.length) * 100}%` }}></div>
                  </div>
                  <span className="text-2xl font-black text-rose-500 font-mono italic">SYNC {Math.floor(((quizIndex + 1) / quizQuestions.length) * 100)}%</span>
               </div>

               <h2 className="text-5xl font-black mb-20 leading-tight tracking-tight">{quizQuestions[quizIndex].question}</h2>

               <div className="space-y-6">
                  {quizQuestions[quizIndex].options.map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => handleBattleAnswer(opt)}
                      className="group w-full p-10 text-left bg-white/5 border-4 border-white/5 rounded-[2.5rem] transition-all hover:bg-rose-500/10 hover:border-rose-500 hover:scale-[1.02] active:scale-95 flex items-center justify-between"
                    >
                      <span className="text-3xl font-black text-white group-hover:text-rose-400">{opt}</span>
                      <div className="w-12 h-12 bg-white/10 rounded-2xl border-4 border-white/10 group-hover:bg-rose-500 group-hover:border-rose-700 transition-all"></div>
                    </button>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* OTHER VIEWS (ORACLE, ARCHIVE, SHOP) - ALREADY IMPLEMENTED BUT ENHANCED VIA THEME */}
        {view === 'oracle' && (
           <div className="max-w-2xl mx-auto pt-20">
              <OracleLink language={selectedLang.name} level={level} onSuccess={() => setGame(g => ({ ...g, gems: g.gems + 100 }))} />
              <button onClick={() => setView('map')} className="mt-12 w-full text-center font-black text-slate-500 hover:text-white uppercase tracking-widest">Abort Sync Protocol</button>
           </div>
        )}

        {view === 'archive' && (
           <div className="space-y-16 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                 <h1 className="text-7xl font-black tracking-tighter italic">THE ARCHIVE</h1>
                 <button onClick={() => setView('map')} className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black">BACK TO NEXUS</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                 {game.inventory.map((item, idx) => (
                   <div key={idx} className="bg-slate-800/50 border border-white/10 rounded-[3rem] p-6 backdrop-blur-md group hover:scale-105 transition-all">
                      <div className="relative aspect-square rounded-[2rem] overflow-hidden mb-6 bg-slate-900 shadow-inner">
                         {item.imageUrl ? (
                           <img src={item.imageUrl} className="w-full h-full object-cover group-hover:rotate-3 group-hover:scale-110 transition-transform duration-700" alt={item.word} />
                         ) : <div className="w-full h-full flex items-center justify-center text-7xl">💠</div>}
                         <div className="absolute top-4 left-4 px-4 py-1 bg-black/80 rounded-full text-[10px] font-black uppercase tracking-widest text-cyan-400 border border-cyan-500/30">MASTERED</div>
                      </div>
                      <h3 className="text-4xl font-black tracking-tighter mb-1">{item.word}</h3>
                      <p className="text-cyan-500 font-bold uppercase text-xs italic">{item.translation}</p>
                   </div>
                 ))}
                 {game.inventory.length === 0 && (
                   <div className="col-span-full py-40 text-center opacity-30">
                      <span className="text-9xl">📡</span>
                      <p className="text-4xl font-black mt-8">NO SIGNAL DETECTED</p>
                   </div>
                 )}
              </div>
           </div>
        )}

        {view === 'shop' && (
           <div className="max-w-5xl mx-auto space-y-16">
              <div className="text-center">
                 <h1 className="text-8xl font-black tracking-tighter italic mb-4">THE ARMORY</h1>
                 <p className="text-2xl text-slate-400 font-bold tracking-widest">UPGRADE YOUR SYSTEMS</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                 {POWER_UPS.map(p => (
                   <div key={p.id} className="bg-slate-800/80 border border-white/10 rounded-[3.5rem] p-12 text-center shadow-2xl relative overflow-hidden group">
                      <div className="w-24 h-24 bg-slate-900/50 rounded-[2rem] flex items-center justify-center text-5xl mb-8 mx-auto shadow-inner border border-white/5 group-hover:scale-110 transition-transform">{p.icon}</div>
                      <h3 className="text-3xl font-black mb-2 tracking-tight">{p.name}</h3>
                      <p className="text-slate-500 font-bold mb-10 text-sm leading-relaxed">{p.description}</p>
                      <button 
                        onClick={() => {
                           if (game.gems >= p.cost) {
                              setGame(g => ({ ...g, gems: g.gems - p.cost, powerups: { ...g.powerups, [p.id]: (g.powerups[p.id] || 0) + 1 } }));
                              alert("SYSTEM UPGRADED.");
                           } else alert("INSUFFICIENT CREDITS.");
                        }}
                        className="w-full py-6 bg-white text-slate-900 rounded-3xl font-black text-2xl shadow-[0_8px_0_0_#CBD5E1] active:translate-y-1 active:shadow-none transition-all"
                      >
                         {p.cost} 💎
                      </button>
                   </div>
                 ))}
              </div>
              <button onClick={() => setView('map')} className="w-full text-center text-slate-500 font-black hover:text-white transition-colors">ABORT MERCHANT LINK</button>
           </div>
        )}

        {/* PORTAL SHARE OVERLAY */}
        {view === 'share' && (
           <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in fade-in duration-300">
              <div className="max-w-md w-full text-center">
                 <div className="bg-white rounded-[4rem] p-16 relative overflow-hidden shadow-[0_0_100px_rgba(255,255,255,0.2)]">
                    <div className="scan-line"></div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4 italic">PORTAL SYNC</h2>
                    <p className="text-slate-500 font-bold mb-10">Scan to broadcast to other devices.</p>
                    <div className="p-6 bg-slate-100 rounded-[2.5rem] mb-10 border-4 border-slate-50">
                       <img src={qrUrl} className="w-full h-auto" alt="QR" />
                    </div>
                    <button onClick={() => setView('map')} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-2xl">CLOSE PORTAL</button>
                 </div>
              </div>
           </div>
        )}

      </main>

      {/* ULTRA FOOTER NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-2xl border-t border-white/10 px-8 py-6 flex justify-around items-center z-[150]">
        {[
          { icon: '🗺️', label: 'NEXUS', view: 'map' },
          { icon: '⚔️', label: 'ARMORY', view: 'shop' },
          { icon: '🎙️', label: 'ORACLE', view: 'oracle' },
          { icon: '🎒', label: 'ARCHIVE', view: 'archive' },
        ].map(nav => (
          <button 
            key={nav.view}
            onClick={() => setView(nav.view as AppView)}
            className={`flex flex-col items-center gap-1 group transition-all duration-300 ${view === nav.view ? 'scale-125 -translate-y-4' : 'opacity-40 hover:opacity-100 hover:scale-110'}`}
          >
            <span className={`text-4xl drop-shadow-lg transition-transform group-hover:rotate-12`}>{nav.icon}</span>
            <span className={`text-[10px] font-black tracking-[0.2em] ${view === nav.view ? 'text-cyan-400' : 'text-white'}`}>{nav.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes spin-reverse { from { transform: rotate(0deg) } to { transform: rotate(-360deg) } }
        .animate-spin-reverse { animation: spin-reverse 2s linear infinite; }
        .animate-bounce-subtle { animation: bounce-subtle 3s ease-in-out infinite; }
        @keyframes bounce-subtle { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-10px) } }
        @keyframes slide { from { background-position: 0% 0% } to { background-position: 200% 0% } }
        .animate-slide { background-size: 200% 100%; animation: slide 3s linear infinite; }
      `}</style>
    </div>
  );
};

export default App;
