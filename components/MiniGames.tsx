
import React, { useState, useEffect } from 'react';

interface MiniGameProps {
  onComplete: (win: boolean) => void;
  type: 'ttt' | 'rps';
}

export const MiniGames: React.FC<MiniGameProps> = ({ onComplete, type }) => {
  // Tic-Tac-Toe Logic
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState<string | null>(null);

  const calculateWinner = (squares: any[]) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
    }
    return squares.every(s => s !== null) ? 'Draw' : null;
  };

  const handleTTTClick = (i: number) => {
    if (board[i] || winner) return;
    const nextBoard = [...board];
    nextBoard[i] = 'X';
    setBoard(nextBoard);
    setIsXNext(false);
  };

  useEffect(() => {
    if (!isXNext && !winner) {
      const timer = setTimeout(() => {
        const empty = board.map((v, idx) => v === null ? idx : null).filter(v => v !== null);
        if (empty.length > 0) {
          const move = empty[Math.floor(Math.random() * empty.length)]!;
          const nextBoard = [...board];
          nextBoard[move] = 'O';
          setBoard(nextBoard);
          setIsXNext(true);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    const win = calculateWinner(board);
    if (win) setWinner(win);
  }, [isXNext, board, winner]);

  useEffect(() => {
    if (winner) {
      setTimeout(() => onComplete(winner === 'X'), 2000);
    }
  }, [winner]);

  // RPS Logic
  const [rpsResult, setRpsResult] = useState<string | null>(null);
  const playRPS = (choice: string) => {
    const options = ['rock', 'paper', 'scissors'];
    const aiChoice = options[Math.floor(Math.random() * 3)];
    if (choice === aiChoice) setRpsResult(`DRAW! Both chose ${choice}`);
    else if (
      (choice === 'rock' && aiChoice === 'scissors') ||
      (choice === 'paper' && aiChoice === 'rock') ||
      (choice === 'scissors' && aiChoice === 'paper')
    ) {
      setRpsResult(`WIN! ${choice} beats ${aiChoice}`);
      setTimeout(() => onComplete(true), 1500);
    } else {
      setRpsResult(`LOSE! ${aiChoice} beats ${choice}`);
      setTimeout(() => onComplete(false), 1500);
    }
  };

  return (
    <div className="bg-slate-900 border-4 border-cyan-500 rounded-[3rem] p-10 text-center text-white shadow-2xl animate-in zoom-in duration-500">
      <h2 className="text-4xl font-black mb-8 uppercase tracking-widest text-cyan-400 italic">BONUS ARENA</h2>
      
      {type === 'rps' ? (
        <div className="space-y-12">
          <p className="text-xl font-bold text-slate-400">DOUBLE YOUR GEMS BY DEFEATING THE AI!</p>
          <div className="flex justify-center gap-6">
            {['🪨', '📄', '✂️'].map((emoji, idx) => (
              <button 
                key={idx}
                onClick={() => playRPS(['rock', 'paper', 'scissors'][idx])}
                className="text-7xl p-8 bg-slate-800 rounded-[2.5rem] hover:bg-cyan-500 hover:scale-110 transition-all active:scale-95 shadow-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
          {rpsResult && <p className="text-3xl font-black text-cyan-400 animate-bounce">{rpsResult}</p>}
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-xl font-bold text-slate-400 mb-6 uppercase">Tic-Tac-Toe: You are X</p>
          <div className="grid grid-cols-3 gap-4 max-w-[320px] mx-auto">
            {board.map((v, i) => (
              <button 
                key={i} 
                onClick={() => handleTTTClick(i)}
                className={`w-24 h-24 rounded-2xl text-5xl font-black flex items-center justify-center border-4 transition-all ${
                  v === 'X' ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 
                  v === 'O' ? 'border-rose-500 text-rose-400 bg-rose-500/10' : 
                  'border-white/5 bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          {winner && <p className="text-3xl font-black text-cyan-400 uppercase mt-8">{winner === 'Draw' ? 'IT IS A DRAW!' : winner === 'X' ? 'VICTORY!' : 'DEFEAT!'}</p>}
        </div>
      )}
    </div>
  );
};
