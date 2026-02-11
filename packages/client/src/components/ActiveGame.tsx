import { useState, useEffect, useMemo } from 'react';
import { GameCanvas } from './GameCanvas';
import { socket } from '../socket';
import type { Room, MakeMoveDto } from '@territory/shared';
import { GameChat } from './GameChat';

interface ActiveGameProps {
  room: Room;
  grid: (string | null)[][]; 
  onLeave: () => void;
}

export const ActiveGame = ({ room, grid, onLeave }: ActiveGameProps) => {
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // --- НОВЕ: Локальна історія результатів ---
  // Ми зберігаємо гравців тут, як тільки гра закінчується.
  // Це гарантує, що вони не зникнуть, навіть якщо вийдуть з кімнати.
  const [finalStandings, setFinalStandings] = useState<any[] | null>(null);

  const ROWS = room.settings.boardSize;
  const COLS = room.settings.boardSize;

  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const myIndex = myPlayer ? room.players.findIndex(p => p.id === myPlayer.id) : -1;
  const isMyTurn = myIndex !== -1 && room.currentTurnIndex === myIndex;
  
  const isFinished = room.status === 'finished';
  const currentPlayerName = room.players[room.currentTurnIndex]?.username || "Unknown";

  // --- 1. ПІДРАХУНОК БАЛІВ (LIVE) ---
  const liveScores = useMemo(() => {
    const counts: Record<string, number> = {};
    // Ініціалізуємо нулями всіх, хто є в кімнаті
    room.players.forEach(p => counts[p.id] = 0);
    
    if (grid) {
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell) counts[cell] = (counts[cell] || 0) + 1;
            });
        });
    }
    return counts;
  }, [grid, room.players]);

  // --- 2. ЕФЕКТ "ЗАМОРОЗКИ" РЕЗУЛЬТАТІВ ---
  useEffect(() => {
    if (isFinished && !finalStandings) {
        // Якщо сервер надіслав gameResult - беремо його
        if (room.gameResult && room.gameResult.players.length > 0) {
             setFinalStandings(room.gameResult.players);
        } 
        // ЯКЩО НІ (Fallback) - просто беремо поточний список і рахунки
        else {
             console.log("Creating local snapshot of results...");
             const snapshot = room.players.map(p => ({
                 id: p.id,
                 username: p.username,
                 color: p.color,
                 score: liveScores[p.id] || 0,
                 isOnline: p.isOnline
             }));
             // Сортуємо за балами
             snapshot.sort((a, b) => b.score - a.score);
             setFinalStandings(snapshot);
        }
    }
    // Якщо почався рематч (статус змінився на playing), очищаємо історію
    if (!isFinished && finalStandings) {
        setFinalStandings(null);
    }
  }, [isFinished, room.gameResult, room.players, liveScores]);

  // --- 3. ВИБІР СПИСКУ ДЛЯ ВІДОБРАЖЕННЯ ---
  // Якщо є заморожений список - показуємо його. Інакше - живих гравців.
  const displayPlayers = finalStandings || room.players;

  // Визначення переможця для заголовка
  const winnerName = useMemo(() => {
    if (!isFinished) return null;
    if (room.winnerId === 'draw') return 'DRAW';
    // Шукаємо ім'я у замороженому списку
    const winner = displayPlayers.find((p: any) => p.id === room.winnerId);
    return winner ? winner.username : 'Unknown';
  }, [isFinished, room.winnerId, displayPlayers]);


  // --- ІНШІ ЕФЕКТИ ---
  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
     if (isMyTurn) {
         setIsPlacing(false);
         setDice(null);
     }
  }, [room.currentTurnIndex, isMyTurn]);

  // --- ЛОГІКА ХОДІВ (Без змін) ---
  const checkValidity = (x: number, y: number, w: number, h: number, playerId: string): boolean => {
    if (y + h > ROWS || x + w > COLS || x < 0 || y < 0) return false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[y + r]?.[x + c] !== null) return false; 
      }
    }
    const hasTerritory = grid.some(row => row.includes(playerId));
    if (!hasTerritory) {
      let startX = 0; let startY = 0;
      if (myIndex === 0) { startX = 0; startY = 0; }
      else if (myIndex === 1) { startX = COLS - 1; startY = ROWS - 1; }
      else if (myIndex === 2) { startX = COLS - 1; startY = 0; }
      else if (myIndex === 3) { startX = 0; startY = ROWS - 1; }
      return (startX >= x && startX < x + w) && (startY >= y && startY < y + h);
    }
    let touchesTerritory = false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const absY = y + r; const absX = x + c;
        if (grid[absY - 1]?.[absX] === playerId || grid[absY + 1]?.[absX] === playerId || grid[absY]?.[absX - 1] === playerId || grid[absY]?.[absX + 1] === playerId) {
          touchesTerritory = true; break;
        }
      }
      if (touchesTerritory) break;
    }
    return touchesTerritory;
  };

  const checkCanPlaceAnywhere = (w: number, h: number, playerId: string): boolean => {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (checkValidity(x, y, w, h, playerId)) return true;
        if (checkValidity(x, y, h, w, playerId)) return true;
      }
    }
    return false;
  };

  const handleCellClick = (x: number, y: number) => {
    if (isFinished) return; 
    if (!isPlacing || !dice || !socket.id || !myPlayer) return;
    if (!isMyTurn) return; 
    
    const [w, h] = dice;
    if (!checkValidity(x, y, w, h, myPlayer.id)) return;
    
    const payload: MakeMoveDto = { roomId: room.id, x, y, w, h };
    socket.emit('makeMove', payload);
    setIsPlacing(false); 
  };

  const rollDice = () => {
    if (isFinished) return;
    if (isRolling || !isMyTurn || !myPlayer) return;
    setIsRolling(true); setIsPlacing(false);
    
    const interval = setInterval(() => {
      setDice([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]);
    }, 50);

    setTimeout(() => {
      clearInterval(interval);
      const d1 = Math.floor(Math.random()*6)+1;
      const d2 = Math.floor(Math.random()*6)+1;
      setDice([d1, d2]);
      setIsRolling(false);

      if (myPlayer) {
         const canMove = checkCanPlaceAnywhere(d1, d2, myPlayer.id);
         if (!canMove) {
            setTimeout(() => {
               const limit = room.players.length * 3; 
               const currentSkips = room.consecutiveSkips;
               const remaining = Math.max(0, limit - currentSkips - 1);

               setNotification(`No moves for ${d1}x${d2}. Skipping... (${remaining} left)`);
               
               socket.emit('skipTurn', { roomId: room.id });
               setDice(null);
            }, 800);
         } else {
            setIsPlacing(true);
         }
      }
    }, 600);
  };

  const rotateDice = () => setDice(prev => prev ? [prev[1], prev[0]] : null);
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPlacing && isMyTurn && !isFinished) rotateDice();
  };

  return (
    <div className="h-screen bg-gray-900 text-white flex p-4 gap-4 overflow-hidden font-sans" onContextMenu={handleRightClick}>
      
      {/* ЛІВА КОЛОНКА */}
      <div className="w-80 flex flex-col gap-2 flex-shrink-0">
          <div className="flex-shrink-0">
            <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-2 w-full justify-center">
                 ← Exit Game
            </button>
          </div>
          <div className="flex-1 min-h-0">
             <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
          </div>
      </div>

      {/* ЦЕНТР */}
      <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col items-center justify-center overflow-auto relative p-4 shadow-inner">
          
          <div className="bg-white rounded shadow-2xl overflow-hidden inline-block ring-8 ring-slate-800 mb-6 transition-all duration-500">
            <div className={isFinished ? "opacity-90 grayscale-[30%]" : ""}>
                <GameCanvas 
                    grid={grid} 
                    players={room.players} 
                    cellSize={ROWS*COLS <= 400 ? 25 : ROWS*COLS <= 1600 ? 18 : 12}
                    activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                    onCellClick={handleCellClick}
                    checkValidity={(x, y) => (dice && myPlayer) ? checkValidity(x, y, dice[0], dice[1], myPlayer.id) : false}
                />
            </div>
          </div>
          
          <div className={`h-12 flex items-center justify-center w-full max-w-lg rounded-full px-6 border shadow-lg backdrop-blur-md transition-all ${isFinished ? "bg-slate-900 border-yellow-500/50 shadow-yellow-900/20" : "bg-slate-900/80 border-slate-600"}`}>
                {isFinished ? (
                    <span className="text-yellow-400 font-bold text-lg flex items-center gap-2 animate-pulse">
                        🏆 GAME OVER! {room.winnerId === 'draw' ? "IT'S A DRAW" : `WINNER: ${winnerName}`}
                    </span>
                ) : notification ? (
                    <span className="text-yellow-400 font-bold animate-pulse text-sm flex items-center gap-2">
                        ⚠️ {notification}
                    </span>
                ) : (
                    <span className={`text-sm font-mono flex items-center gap-2 ${isMyTurn ? "text-green-400 font-bold" : "text-slate-400"}`}>
                        {isMyTurn ? (
                            <>➤ IT'S YOUR TURN ({myPlayer?.username})</>
                        ) : (
                            <>⏳ Waiting for {currentPlayerName}...</>
                        )}
                    </span>
                )}
          </div>

          <div className="absolute top-4 right-4 pointer-events-none opacity-80">
                {room.settings.mode === 'fast' ? (
                    <span className="text-xs bg-blue-900/80 text-blue-400 px-3 py-1.5 rounded border border-blue-500/50 font-bold shadow-lg backdrop-blur-sm">⚡ FAST MODE</span>
                ) : (
                    <span className="text-xs bg-slate-900/80 text-gray-400 px-3 py-1.5 rounded border border-slate-600 font-bold shadow-lg backdrop-blur-sm">CLASSIC</span>
                )}
          </div>
      </div>

      {/* ПРАВА КОЛОНКА */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col items-center">
                <div className="flex justify-between w-full mb-2">
                     <span className="text-xs text-slate-400 uppercase font-bold">Current Roll</span>
                     {isMyTurn && !isFinished && <span className="text-xs text-green-400 font-bold animate-pulse">YOUR TURN!</span>}
                </div>
                
                <div className={`flex items-center justify-center gap-2 text-5xl font-mono font-bold w-full py-6 rounded-xl border transition-all duration-100 bg-slate-900 ${isRolling ? "border-slate-700 blur-[1px]" : "border-slate-600"} ${isFinished ? "opacity-50" : ""}`}>
                    {dice ? (
                      <><span className="text-yellow-400">{dice[0]}</span><span className="text-slate-600 text-3xl">x</span><span className="text-yellow-400">{dice[1]}</span></>
                    ) : (
                      <span className="text-slate-600 text-4xl tracking-widest">? x ?</span>
                    )}
                </div>
                <div className="flex flex-col gap-3 w-full mt-6">
                    <button 
                        onClick={rollDice} 
                        disabled={isFinished || !isMyTurn || isRolling || isPlacing} 
                        className={`w-full py-4 font-bold text-lg rounded-xl transition shadow-lg active:scale-[0.98] ${
                            isFinished ? "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed" :
                            (!isMyTurn) ? "bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed border border-slate-600" : 
                            (isPlacing ? "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20")
                        }`}
                    >
                        {isFinished ? "GAME OVER" : (!isMyTurn ? "WAIT TURN" : (isPlacing ? "PLACE FIGURE" : (isRolling ? "ROLLING..." : "ROLL DICE")))}
                    </button>
                    <button 
                        onClick={rotateDice} 
                        disabled={isFinished || !isMyTurn || !isPlacing} 
                        className="w-full py-3 font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition active:scale-[0.98] disabled:opacity-50 border border-slate-600"
                    >
                        ROTATE <span className="text-slate-400 text-xs font-normal">(R-Click)</span>
                    </button>
                </div>
            </div>

            <div className="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
                    <h3 className="text-xs text-slate-400 uppercase font-bold">{isFinished ? "Final Results" : "Players & Scores"}</h3>
                    <span className="font-mono text-xs text-slate-500">ID: {room.id}</span>
                </div>
                
                <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
                    {displayPlayers.map((p: any) => {
                        const isActive = !isFinished && room.players[room.currentTurnIndex]?.id === p.id;
                        
                        // Беремо рахунок: або з "замороженого" об'єкта, або з живого підрахунку
                        const score = 'score' in p ? p.score : (liveScores[p.id] || 0);
                        const isOnline = 'isOnline' in p ? p.isOnline : true;
                        const isWinner = isFinished && p.id === room.winnerId;
                        
                        return (
                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all 
                                ${isWinner ? "bg-yellow-900/20 border-yellow-500/50 shadow-yellow-900/10" : 
                                  isActive ? "bg-slate-700 border-blue-500/50 shadow-lg scale-[1.02]" : 
                                  "bg-slate-900/40 border-slate-700/50 opacity-70"}`
                            }>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="relative">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }}></div>
                                        {!isFinished && !isOnline && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>}
                                        {isWinner && <span className="absolute -top-2 -left-1 text-xs">👑</span>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-sm truncate leading-none ${isActive || isWinner ? "text-white font-bold" : "text-gray-400"}`}>
                                            {p.username} {p.socketId === socket.id && "(You)"}
                                        </span>
                                        {!isFinished && !isOnline && <span className="text-[9px] text-red-500 font-bold leading-none mt-1">OFFLINE</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded border min-w-[30px] text-center ${isWinner ? "bg-yellow-500 text-black border-yellow-600" : "bg-slate-800 text-white border-slate-600"}`}>
                                        {score}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
      </div>
    </div>
  );
};