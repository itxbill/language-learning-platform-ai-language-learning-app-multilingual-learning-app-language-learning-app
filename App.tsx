
import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { SUPPORTED_LANGUAGES } from './constants';
import { LanguageLevel, Lesson, QuizQuestion, GameState, AppView, VocabularyItem, PowerUp, AIFeedback, Achievement, DailyGoal } from './types';
import { generateNarrativeQuest, generateBossBattle, generateInventoryArt, getTeacherFeedback } from './services/geminiService';
import OracleLink from './components/OracleLink';
import { MiniGames } from './components/MiniGames';

const POWER_UPS: PowerUp[] = [
  { id: 'shield', name: 'Shield of Polyglot', icon: '🛡️', description: 'Survive one wrong answer in battle.', cost: 30, effect: 'shield' },
  { id: 'xp_boost', name: 'Elixir of Wisdom', icon: '🧪', description: 'Double XP for the next quest.', cost: 50, effect: 'xp_boost' },
  { id: 'streak_freeze', name: 'Chronos Freeze', icon: '❄️', description: 'Saves your streak if you miss a day.', cost: 100, effect: 'streak_freeze' },
];

const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_lesson', title: 'First Synapse', icon: '🌱', description: 'Complete your first language mission.', isUnlocked: false },
  { id: 'streak_3', title: 'Fire Starter', icon: '🔥', description: 'Reach a 3-day streak.', isUnlocked: false },
  { id: 'streak_7', title: 'Eternal Flame', icon: '☀️', description: 'Complete a full 7-day streak matrix.', isUnlocked: false },
  { id: 'gem_1000', title: 'Matrix Tycoon', icon: '💰', description: 'Collect 1000 gems.', isUnlocked: false },
];

const INITIAL_DAILY_GOALS: DailyGoal[] = [
  { id: 'quest_1', text: 'Complete 1 Quest', isCompleted: false, rewardGems: 20 },
  { id: 'battle_1', text: 'Win 1 Boss Battle', isCompleted: false, rewardGems: 30 },
  { id: 'gems_50', text: 'Collect 50 Gems', isCompleted: false, rewardGems: 50 },
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
  
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  
  const [showHealthAlert, setShowHealthAlert] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(60);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const [game, setGame] = useState<GameState>(() => {
    const saved = localStorage.getItem('linguist_v5_ultra_master');
    const today = new Date().toISOString().split('T')[0];
    
    if (saved) {
      const state = JSON.parse(saved) as GameState;
      const lastLogin = state.lastLoginDate.split('T')[0];
      
      if (lastLogin !== today) {
        const diff = Math.floor((new Date(today).getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24));
        let newStreak = state.streak;
        let newProgress = [...state.streakProgress];

        if (diff === 1) {
          newStreak += 1;
        } else if (diff > 1 && (state.powerups['streak_freeze'] || 0) > 0) {
          // Protected by streak freeze
          state.powerups['streak_freeze'] -= 1;
        } else {
          newStreak = 1;
          newProgress = [false, false, false, false, false, false, false];
        }

        const dayIdx = (new Date().getDay() + 6) % 7;
        newProgress[dayIdx] = true;
        
        return { 
          ...state, 
          streak: newStreak, 
          streakProgress: newProgress, 
          lastLoginDate: today,
          dailyGoals: INITIAL_DAILY_GOALS // Reset daily goals
        };
      }
      return state;
    }
    
    const dayIdx = (new Date().getDay() + 6) % 7;
    const initialProgress = [false, false, false, false, false, false, false];
    initialProgress[dayIdx] = true;

    return {
      hearts: 5, maxHearts: 5, xp: 0, level: 1, gems: 100, streak: 1, 
      streakProgress: initialProgress,
      lastLoginDate: today, inventory: [], unlockedRegions: ['Nexus Alpha'], powerups: {}, activeBuffs: [],
      achievements: INITIAL_ACHIEVEMENTS,
      dailyGoals: INITIAL_DAILY_GOALS
    };
  });

  useEffect(() => {
    localStorage.setItem('linguist_v5_ultra_master', JSON.stringify(game));
    QRCode.toDataURL(window.location.href).then(setQrUrl);
  }, [game]);

  const initiateQuest = async (topic: string) => {
    if (game.hearts <= 0) return alert("HEARTS DEPLETED! VISIT ARMORY.");
    setLoading(true);
    try {
      const quest = await generateNarrativeQuest(selectedLang.name, level, topic);
      setCurrentQuest(quest);
      setView('quest');
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const startRecovery = () => {
    setShowHealthAlert(true);
    setCooldownTime(60);
    setView('cooldown');
    cooldownRef.current = setInterval(() => {
      setCooldownTime(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          setView('minigame');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeGoal = (goalId: string) => {
    setGame(prev => {
      const goal = prev.dailyGoals.find(g => g.id === goalId);
      if (goal && !goal.isCompleted) {
        return {
          ...prev,
          gems: prev.gems + goal.rewardGems,
          dailyGoals: prev.dailyGoals.map(g => g.id === goalId ? { ...g, isCompleted: true } : g)
        };
      }
      return prev;
    });
  };

  const unlockAchievement = (id: string) => {
    setGame(prev => {
      if (prev.achievements.find(a => a.id === id)?.isUnlocked) return prev;
      return {
        ...prev,
        achievements: prev.achievements.map(a => a.id === id ? { ...a, isUnlocked: true } : a)
      };
    });
  };

  const handleBattleAnswer = async (answer: string) => {
    const isCorrect = answer === quizQuestions[quizIndex].correctAnswer;
    if (isCorrect) {
      setCombo(c => c + 1);
      if (quizIndex === quizQuestions.length - 1) {
        completeGoal('battle_1');
        unlockAchievement('first_lesson');
        if (game.streak >= 3) unlockAchievement('streak_3');
        if (game.streak >= 7) unlockAchievement('streak_7');
        
        setGame(g => ({ ...g, gems: g.gems + 20, xp: g.xp + 50 }));
        startRecovery();
      } else setQuizIndex(p => p + 1);
    } else {
      setCombo(0);
      setGame(g => ({ ...g, hearts: Math.max(0, g.hearts - 1) }));
      if (game.hearts <= 1) setView('map');
    }
  };

  const getBiomeColor = (category?: string) => {
    switch (category) {
      case 'geology': return 'from-orange-600/20 to-rose-900/40 border-orange-500 shadow-orange-500/20';
      case 'biology': return 'from-emerald-600/20 to-teal-900/40 border-emerald-500 shadow-emerald-500/20';
      case 'astronomy': return 'from-indigo-600/20 to-slate-900/40 border-indigo-500 shadow-indigo-500/20';
      default: return 'from-cyan-600/20 to-slate-900/40 border-cyan-500 shadow-cyan-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 pb-28 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      {/* AMBIENT BACKGROUND ELEMENTS */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500 rounded-full blur-[150px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500 rounded-full blur-[150px] animate-pulse delay-1000"></div>
      </div>

      {/* HYDRATION OVERLAY */}
      {showHealthAlert && (
        <div className="fixed inset-0 z-[200] bg-cyan-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="text-center text-white max-w-lg bg-slate-900/80 p-12 rounded-[3rem] border-4 border-white/10 shadow-[0_0_100px_rgba(34,211,238,0.2)]">
              <span className="text-9xl mb-8 block animate-bounce">💧</span>
              <h2 className="text-5xl font-black mb-6 tracking-tighter italic uppercase">Water Sync</h2>
              <p className="text-xl font-bold mb-10 text-cyan-100 leading-relaxed">System notice: Your biology requires H2O for optimal synaptic firing. Take a break and drink water now.</p>
              <button onClick={() => setShowHealthAlert(false)} className="w-full py-6 bg-cyan-500 text-white rounded-3xl font-black text-2xl shadow-2xl hover:bg-cyan-400 transition-all">HYDRATED & READY</button>
           </div>
        </div>
      )}

      {/* TOP NAV: MASTER HUD */}
      <nav className="sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="group relative">
               <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-white/10 cursor-help">
                 <span className="text-lg">❤️</span>
                 <span className="text-xl font-black text-rose-500">{game.hearts}</span>
               </div>
               <div className="absolute top-full mt-2 hidden group-hover:block bg-slate-800 border border-white/10 p-3 rounded-lg text-[10px] w-32 z-50">Hearts replenish every 2 hours or in the Armory.</div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-white/10">
              <span className="text-lg">💎</span>
              <span className="text-xl font-black text-cyan-400">{game.gems}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button onClick={() => setView('streak')} className="group flex items-center gap-3 bg-gradient-to-r from-orange-500 to-rose-600 px-5 py-2 rounded-xl shadow-lg hover:scale-105 transition-all">
               <span className="text-lg group-hover:animate-bounce">🔥</span>
               <span className="font-black text-lg">{game.streak}d</span>
             </button>
             <div className="hidden md:flex bg-slate-900 p-1 rounded-xl border border-white/10">
               {SUPPORTED_LANGUAGES.slice(0, 6).map(lang => (
                 <button key={lang.code} onClick={() => setSelectedLang(lang)} className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${selectedLang.code === lang.code ? 'bg-white/10 scale-110 shadow-inner' : 'opacity-40 hover:opacity-100'}`}>
                   <span className="text-xl">{lang.flag}</span>
                 </button>
               ))}
               <button onClick={() => setView('share')} className="w-10 h-10 flex items-center justify-center opacity-40 hover:opacity-100">🌍</button>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 mt-8">

        {/* VIEW: WORLD MAP (BIOMES) */}
        {view === 'map' && !loading && (
          <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700">
             <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="relative">
                   <h1 className="text-7xl font-black tracking-tighter italic leading-none">CORE MATRIX</h1>
                   <div className="flex items-center gap-3 mt-4">
                     <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-[10px] font-black text-cyan-400 tracking-[0.2em] uppercase">Sector: {selectedLang.name}</div>
                     <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase">Difficulty: {level}</div>
                   </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                   {Object.values(LanguageLevel).map(l => (
                     <button key={l} onClick={() => setLevel(l)} className={`px-6 py-2 rounded-xl font-black text-xs uppercase border transition-all ${level === l ? 'bg-cyan-500 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-slate-900 border-white/5 text-slate-500'}`}>{l}</button>
                   ))}
                </div>
             </header>

             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* LEFT COLUMN: DAILY GOALS & ACHIEVEMENTS */}
                <div className="lg:col-span-1 space-y-8">
                   <section className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-md">
                      <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6 flex items-center justify-between">
                         Daily Protocols
                         <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                      </h4>
                      <div className="space-y-4">
                         {game.dailyGoals.map(goal => (
                           <div key={goal.id} className={`p-4 rounded-2xl border transition-all ${goal.isCompleted ? 'bg-emerald-500/10 border-emerald-500/30 opacity-60' : 'bg-white/5 border-white/5'}`}>
                              <div className="flex items-center justify-between mb-2">
                                 <span className={`text-[10px] font-black ${goal.isCompleted ? 'line-through text-emerald-400' : 'text-slate-300'}`}>{goal.text}</span>
                                 {goal.isCompleted && <span className="text-xs">✅</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${goal.isCompleted ? 'w-full bg-emerald-500' : 'w-0'}`}></div>
                                 </div>
                                 <span className="text-[10px] font-black text-cyan-400">+{goal.rewardGems}💎</span>
                              </div>
                           </div>
                         ))}
                      </div>
                   </section>

                   <section className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-md">
                      <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-6">Archive Badges</h4>
                      <div className="grid grid-cols-4 gap-3">
                         {game.achievements.map(a => (
                           <div key={a.id} className={`aspect-square rounded-xl flex items-center justify-center text-xl border-2 transition-all group relative cursor-help ${a.isUnlocked ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-slate-800 border-white/5 grayscale opacity-30'}`}>
                              {a.icon}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 border border-white/10 p-2 rounded text-[8px] w-24 z-50 text-center">{a.title}</div>
                           </div>
                         ))}
                      </div>
                   </section>
                </div>

                {/* MAIN GRID: EXPEDITIONS */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                   {[
                     { topic: 'Volcano Core Physics', icon: '🌋', cat: 'geology' },
                     { topic: 'Neural Botany', icon: '🌳', cat: 'biology' },
                     { topic: 'Stellar Syntax', icon: '✨', cat: 'astronomy' },
                     { topic: 'Abyssal Dialects', icon: '🐋', cat: 'biology' },
                     { topic: 'Tectonic Grammar', icon: '🗻', cat: 'geology' },
                     { topic: 'Exoplanet Culture', icon: '👽', cat: 'astronomy' },
                   ].map((q, i) => (
                     <button 
                       key={i} onClick={() => initiateQuest(q.topic)}
                       className={`group relative overflow-hidden border-2 rounded-[2.5rem] p-8 text-left transition-all hover:scale-[1.02] active:scale-95 bg-gradient-to-br ${getBiomeColor(q.cat)}`}
                     >
                       <div className="absolute top-[-20%] right-[-10%] text-9xl opacity-5 group-hover:rotate-12 transition-transform">{q.icon}</div>
                       <div className="w-16 h-16 bg-slate-950/60 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-xl border border-white/5 group-hover:scale-110 transition-all">
                         {q.icon}
                       </div>
                       <h3 className="text-3xl font-black mb-2 tracking-tight italic group-hover:text-white transition-colors">{q.topic}</h3>
                       <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">Module {i + 1} // Biome: {q.cat}</p>
                       <div className="mt-8 flex items-center justify-between">
                          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden mr-4">
                             <div className="h-full bg-white/20 w-1/4 group-hover:w-full transition-all duration-1000"></div>
                          </div>
                          <span className="text-[10px] font-black uppercase text-cyan-400 group-hover:translate-x-1 transition-transform">Start →</span>
                       </div>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* VIEW: STREAK MATRIX */}
        {view === 'streak' && (
           <div className="max-w-4xl mx-auto pt-4 animate-in zoom-in duration-500">
             <div className="bg-slate-900/80 border-4 border-orange-500 rounded-[4rem] p-12 text-center backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-rose-500 to-orange-500 animate-slide"></div>
                
                <div className="mb-10">
                   <span className="text-8xl mb-6 block animate-bounce-subtle">🔥</span>
                   <h2 className="text-6xl font-black tracking-tighter italic mb-2">STREAK CORE</h2>
                   <p className="text-xl text-orange-400 font-black uppercase tracking-[0.4em]">7-Day Synchronicity Matrix</p>
                </div>

                <div className="flex justify-center gap-4 mb-12 flex-wrap">
                  {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-3">
                       <div className={`w-14 h-24 rounded-3xl border-2 flex items-end p-1.5 transition-all duration-1000 ${game.streakProgress[i] ? 'border-orange-500 bg-orange-500/20' : 'border-slate-800 bg-slate-950/50'}`}>
                          <div className={`w-full rounded-2xl transition-all duration-1000 shadow-[0_0_20px_orange] ${game.streakProgress[i] ? 'h-full bg-gradient-to-t from-orange-600 to-orange-400' : 'h-0'}`}></div>
                       </div>
                       <span className={`font-black text-[10px] tracking-widest ${game.streakProgress[i] ? 'text-orange-500' : 'text-slate-600'}`}>{day}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                   <div className="bg-slate-950/60 p-8 rounded-3xl border border-white/5">
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Total Power</p>
                      <p className="text-5xl font-black">{game.streak}<span className="text-xl ml-1">DAYS</span></p>
                   </div>
                   <div className="bg-slate-950/60 p-8 rounded-3xl border border-white/5 relative">
                      {game.powerups['streak_freeze'] > 0 && <span className="absolute top-4 right-4 text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-lg">ACTIVE</span>}
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Streak Protection</p>
                      <p className="text-5xl font-black text-cyan-400">{game.powerups['streak_freeze'] || 0}<span className="text-xl ml-1">❄️</span></p>
                   </div>
                   <div className="bg-slate-950/60 p-8 rounded-3xl border border-white/5">
                      <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Reward Multiplier</p>
                      <p className="text-5xl font-black text-rose-500">x{(1 + game.streak * 0.1).toFixed(1)}</p>
                   </div>
                </div>

                <button onClick={() => setView('map')} className="w-full py-6 bg-white text-slate-900 rounded-[2rem] font-black text-2xl hover:scale-105 transition-transform active:scale-95 shadow-[0_10px_0_0_#CBD5E1]">SYNC COMPLETE</button>
             </div>
           </div>
        )}

        {/* LOADING OVERLAY */}
        {loading && (
          <div className="fixed inset-0 z-[300] bg-slate-950/90 flex flex-col items-center justify-center p-10 backdrop-blur-sm">
             <div className="relative w-48 h-48">
                <div className="absolute inset-0 border-[10px] border-cyan-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-[10px] border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-8 border-[6px] border-indigo-500 border-b-transparent rounded-full animate-spin-reverse opacity-50"></div>
                <div className="absolute inset-0 flex items-center justify-center text-6xl animate-pulse">🌌</div>
             </div>
             <div className="mt-12 text-center">
                <h2 className="text-6xl font-black text-white italic tracking-tighter animate-pulse mb-4">OPTIMIZING SYNAPSES</h2>
                <p className="text-cyan-400 font-bold tracking-[0.5em] text-xs uppercase">Connecting to AI Neural Grid...</p>
             </div>
          </div>
        )}

        {/* TEACHER MODE, SHOP, ARCHIVE (LEVERAGING PREVIOUS STYLES) */}
        {view === 'teacher' && (
           <div className="max-w-3xl mx-auto animate-in fade-in zoom-in duration-500">
              <div className="bg-slate-900/80 border-4 border-indigo-500 rounded-[4rem] p-12 backdrop-blur-xl shadow-2xl relative">
                 <h2 className="text-5xl font-black mb-4 tracking-tighter italic text-center">AI MASTER TUTOR</h2>
                 <p className="text-lg text-indigo-300 font-bold text-center mb-10">Real-time analysis of your linguistic input.</p>
                 
                 <textarea 
                   value={userInput}
                   onChange={(e) => setUserInput(e.target.value)}
                   className="w-full h-48 bg-slate-950/60 border-2 border-white/5 rounded-[2.5rem] p-8 text-xl focus:border-indigo-400 outline-none transition-all placeholder:text-slate-800"
                   placeholder="Type or paste text in any language..."
                 />

                 <button 
                   onClick={async () => {
                      setLoading(true);
                      try {
                         const f = await getTeacherFeedback(selectedLang.name, userInput);
                         setFeedback(f);
                      } catch (e) {} finally { setLoading(false); }
                   }}
                   className="w-full py-6 bg-white text-indigo-900 rounded-[2rem] font-black text-2xl mt-8 shadow-[0_8px_0_0_#CBD5E1] active:translate-y-[8px] active:shadow-none transition-all"
                 >
                   ANALYZE SYNTAX 🧠
                 </button>

                 {feedback && (
                   <div className="mt-12 space-y-8 animate-in slide-in-from-bottom-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-6">
                         <span className="text-6xl font-black text-white">{feedback.score}<span className="text-xl ml-1 text-indigo-500">%</span></span>
                         <span className="text-xl font-mono text-cyan-400">/{feedback.phonetics}/</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                            <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Grammar Trace</h5>
                            <p className="text-sm leading-relaxed">{feedback.grammar}</p>
                         </div>
                         <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                            <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Natural Flow</h5>
                            <p className="text-sm leading-relaxed">{feedback.naturalness}</p>
                         </div>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        )}

        {/* REST OF THE VIEWS (SHOP, QUEST, BATTLE, MINIGAME) INTEGRATED WITH NEW STYLE */}
        {view === 'shop' && (
           <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-500">
              <div className="text-center">
                 <h1 className="text-7xl font-black tracking-tighter italic mb-2">THE ARMORY</h1>
                 <p className="text-xl text-slate-500 font-bold tracking-[0.4em]">ENHANCE YOUR MATRIX</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {POWER_UPS.map(p => (
                   <div key={p.id} className="bg-slate-900/60 border border-white/10 rounded-[3rem] p-10 text-center hover:scale-105 transition-all relative group">
                      <div className="w-20 h-20 bg-slate-950 rounded-3xl flex items-center justify-center text-4xl mb-6 mx-auto shadow-inner group-hover:rotate-12 transition-transform">{p.icon}</div>
                      <h3 className="text-2xl font-black mb-2">{p.name}</h3>
                      <p className="text-xs text-slate-500 font-bold mb-8 h-8">{p.description}</p>
                      <button 
                        onClick={() => {
                           if (game.gems >= p.cost) {
                              setGame(g => ({ ...g, gems: g.gems - p.cost, powerups: { ...g.powerups, [p.id]: (g.powerups[p.id] || 0) + 1 } }));
                           } else alert("Insufficient Gems.");
                        }}
                        className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-xl shadow-[0_5px_0_0_#CBD5E1] active:translate-y-1 active:shadow-none transition-all"
                      >
                         {p.cost} 💎
                      </button>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {/* QUEST VIEW (RETAINED FROM PREVIOUS VERSION BUT STYLED) */}
        {view === 'quest' && currentQuest && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-12 duration-500">
             <div className="bg-slate-900 border-4 border-white/5 rounded-[4rem] p-12 shadow-2xl relative">
                <h1 className="text-6xl font-black mb-8 italic">{currentQuest.title}</h1>
                <div className="p-8 bg-indigo-500/10 rounded-[2rem] border-l-8 border-indigo-500 mb-10 text-xl italic text-slate-300 leading-relaxed italic">"{currentQuest.narrative}"</div>
                
                <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2rem] p-6 mb-10 flex gap-6 items-center">
                   <div className="text-5xl">📖</div>
                   <div>
                      <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.3em] mb-2">Master Science Education</h4>
                      <p className="text-lg font-bold text-emerald-100">{currentQuest.educationalFact?.fact}</p>
                   </div>
                </div>

                <div className="space-y-8 mb-16 text-2xl font-medium text-slate-400 leading-relaxed">
                   {currentQuest.content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>

                <button 
                  onClick={async () => {
                     setLoading(true);
                     try {
                        const q = await generateBossBattle(selectedLang.name, currentQuest.content);
                        setQuizQuestions(q);
                        setQuizIndex(0);
                        setView('battle');
                     } catch (e) {} finally { setLoading(false); }
                  }}
                  className="w-full py-8 bg-cyan-600 text-white rounded-[2.5rem] font-black text-3xl shadow-[0_10px_0_0_#0891b2] active:translate-y-[10px] active:shadow-none transition-all"
                >
                  START BATTLE 👹
                </button>
             </div>
          </div>
        )}

        {/* BATTLE & MINIGAME VIEWS (RETAINED & STYLED) */}
        {view === 'battle' && quizQuestions.length > 0 && (
          <div className="max-w-3xl mx-auto pt-6">
             <div className="bg-slate-900 border-[10px] border-rose-600 rounded-[4rem] p-12 shadow-[0_30px_0_0_#9f1239] animate-in zoom-in duration-300 relative">
                {combo > 1 && <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-8 py-3 bg-orange-500 text-white rounded-full font-black text-2xl shadow-xl animate-bounce">COMBO x{combo} 🔥</div>}
                <h2 className="text-4xl font-black mb-16 leading-tight">{quizQuestions[quizIndex].question}</h2>
                <div className="space-y-4">
                   {quizQuestions[quizIndex].options.map((opt, i) => (
                     <button key={i} onClick={() => handleBattleAnswer(opt)} className="group w-full p-8 text-left bg-white/5 border-2 border-white/5 rounded-3xl transition-all hover:bg-rose-500/10 hover:border-rose-500 flex items-center justify-between">
                       <span className="text-2xl font-black">{opt}</span>
                       <div className="w-10 h-10 bg-white/5 rounded-xl border-2 border-white/5 group-hover:bg-rose-500 transition-all"></div>
                     </button>
                   ))}
                </div>
             </div>
          </div>
        )}

        {view === 'minigame' && (
           <div className="max-w-xl mx-auto pt-16">
              <MiniGames 
                type={Math.random() > 0.5 ? 'ttt' : 'rps'} 
                onComplete={(win) => {
                   if (win) {
                      setGame(g => ({ ...g, gems: g.gems + 50 }));
                      completeGoal('gems_50');
                   }
                   setView('map');
                }} 
              />
           </div>
        )}

        {view === 'archive' && (
           <div className="space-y-12 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                 <h1 className="text-6xl font-black italic tracking-tighter">DATA ARCHIVE</h1>
                 <button onClick={() => setView('map')} className="px-6 py-2 bg-white text-slate-900 rounded-xl font-black text-xs">BACK TO MATRIX</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                 {game.inventory.map((item, idx) => (
                   <div key={idx} className="bg-slate-900/60 border border-white/5 rounded-3xl p-4 text-center hover:scale-105 transition-all">
                      <div className="aspect-square bg-slate-950 rounded-2xl mb-4 flex items-center justify-center text-4xl overflow-hidden">
                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : '💠'}
                      </div>
                      <h4 className="text-sm font-black truncate">{item.word}</h4>
                      <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest">{item.translation}</p>
                   </div>
                 ))}
                 {game.inventory.length === 0 && <div className="col-span-full py-32 text-center opacity-20 italic">No artifacts collected yet.</div>}
              </div>
           </div>
        )}

      </main>

      {/* GLOBAL FOOTER NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-2xl border-t border-white/5 p-6 flex justify-around items-center z-[150]">
        {[
          { icon: '🗺️', label: 'MATRIX', view: 'map' },
          { icon: '🧠', label: 'MASTER', view: 'teacher' },
          { icon: '🎒', label: 'ARCHIVE', view: 'archive' },
          { icon: '🛒', label: 'ARMORY', view: 'shop' },
        ].map(nav => (
          <button 
            key={nav.view}
            onClick={() => setView(nav.view as AppView)}
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${view === nav.view ? 'scale-110 -translate-y-2 text-cyan-400' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}
          >
            <span className="text-3xl drop-shadow-lg">{nav.icon}</span>
            <span className="text-[9px] font-black tracking-widest uppercase">{nav.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes spin-reverse { from { transform: rotate(0deg) } to { transform: rotate(-360deg) } }
        .animate-spin-reverse { animation: spin-reverse 3s linear infinite; }
        @keyframes bounce-subtle { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        .animate-bounce-subtle { animation: bounce-subtle 4s ease-in-out infinite; }
        @keyframes slide { 0% { background-position: 0% 50% } 50% { background-position: 100% 50% } 100% { background-position: 0% 50% } }
        .animate-slide { background-size: 200% 200%; animation: slide 3s ease infinite; }
      `}</style>
    </div>
  );
};

export default App;
