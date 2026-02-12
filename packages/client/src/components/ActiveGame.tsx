import { useState, useEffect, useMemo } from 'react';
import { GameCanvas } from './GameCanvas';
import { socket } from '../socket';
import type { Room} from '@territory/shared';
import { GameChat } from './GameChat';
import { GameOverModal } from './GameOverModal';

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
  const [finalStandings, setFinalStandings] = useState<any[] | null>(null);

  // Mobile & Phantom State
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [phantomPos, setPhantomPos] = useState<{x: number, y: number} | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState<'players' | 'chat' | null>(null);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 1024);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ROWS = room.settings.boardSize;
  const COLS = room.settings.boardSize;
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const myIndex = myPlayer ? room.players.findIndex(p => p.id === myPlayer.id) : -1;
  const isMyTurn = myIndex !== -1 && room.currentTurnIndex === myIndex;
  const isFinished = room.status === 'finished';
  const currentPlayerName = room.players[room.currentTurnIndex]?.username || "Unknown";

  const liveScores = useMemo(() => {
    const counts: Record<string, number> = {};
    room.players.forEach(p => counts[p.id] = 0);
    if (grid) { grid.forEach(r => r.forEach(c => { if (c) counts[c] = (counts[c] || 0) + 1; })); }
    return counts;
  }, [grid, room.players]);

  useEffect(() => {
    if (isFinished && !finalStandings) {
        if (room.gameResult && room.gameResult.players.length > 0) {
             setFinalStandings(room.gameResult.players);
        } else {
             const snapshot = room.players.map(p => ({
                 id: p.id, username: p.username, color: p.color, score: liveScores[p.id] || 0, isOnline: p.isOnline
             })).sort((a, b) => b.score - a.score);
             setFinalStandings(snapshot);
        }
    }
    if (!isFinished && finalStandings) setFinalStandings(null);
  }, [isFinished, room.gameResult, room.players, liveScores]);

  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
     if (isMyTurn) {
         setIsPlacing(false);
         setDice(null);
         setPhantomPos(null); // Скидаємо фантом при зміні ходу
     }
  }, [room.currentTurnIndex, isMyTurn]);

  // --- ВАЛІДАЦІЯ ---
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
    if (isFinished || !isPlacing || !dice || !myPlayer || !isMyTurn) return;

    if (isMobile) {
        setPhantomPos({ x, y });
    } else {
        // На ПК: Можна ходити відразу
        if (checkValidity(x, y, dice[0], dice[1], myPlayer.id)) {
            socket.emit('makeMove', { roomId: room.id, x, y, w: dice[0], h: dice[1] });
            setIsPlacing(false);
        }
    }
  };

  const handleConfirmMove = () => {
      if (!phantomPos || !dice || !myPlayer) return;
      if (checkValidity(phantomPos.x, phantomPos.y, dice[0], dice[1], myPlayer.id)) {
          socket.emit('makeMove', { roomId: room.id, x: phantomPos.x, y: phantomPos.y, w: dice[0], h: dice[1] });
          setIsPlacing(false);
          setPhantomPos(null);
      }
  };

  const rollDice = () => {
    if (isFinished) return;
    if (isRolling || !isMyTurn || !myPlayer) return;
    setIsRolling(true); setIsPlacing(false); setPhantomPos(null);
    
    const interval = setInterval(() => setDice([Math.floor(Math.random()*6)+1, Math.floor(Math.random()*6)+1]), 50);
    setTimeout(() => {
      clearInterval(interval);
      const d1 = Math.floor(Math.random()*6)+1;
      const d2 = Math.floor(Math.random()*6)+1;
      setDice([d1, d2]);
      setIsRolling(false);
      if (myPlayer) {
         if (!checkCanPlaceAnywhere(d1, d2, myPlayer.id)) {
            setTimeout(() => {
               const limit = room.players.length * 3;
               const currentSkips = room.consecutiveSkips || 0;
               const remaining = Math.max(0, limit - currentSkips - 1);
               setNotification(`No moves for ${d1}x${d2}. Skipping... (${remaining} left until Game Over)`);
               socket.emit('skipTurn', { roomId: room.id });
               setDice(null);
            }, 800);
         } else {
            setIsPlacing(true);
         }
      }
    }, 600);
  };

  const rotateDice = () => {
      setDice(prev => prev ? [prev[1], prev[0]] : null);
      setPhantomPos(null);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPlacing && isMyTurn && !isFinished) rotateDice();
  };

  const displayPlayers = finalStandings || room.players;
  const winnerName = useMemo(() => {
    if (!isFinished) return null;
    if (room.winnerId === 'draw') return 'DRAW';
    const winner = displayPlayers.find((p: any) => p.id === room.winnerId);
    return winner ? winner.username : 'Unknown';
  }, [isFinished, room.winnerId, displayPlayers]);

  const PlayersList = () => (
    <div className="space-y-2 pr-1">
        {displayPlayers.map((p: any) => {
            const isActive = !isFinished && room.players[room.currentTurnIndex]?.id === p.id;
            const score = 'score' in p ? p.score : (liveScores[p.id] || 0);
            const isOnline = 'isOnline' in p ? p.isOnline : true;
            const isWinner = isFinished && p.id === room.winnerId;
            return (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all 
                    ${isWinner ? "bg-yellow-900/20 border-yellow-500/50" : 
                      isActive ? "bg-slate-700 border-blue-500/50 scale-[1.02]" : 
                      "bg-slate-900/40 border-slate-700/50 opacity-70"}`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="relative">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                            {!isOnline && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                        </div>
                        <span className={`text-sm truncate ${isActive || isWinner ? "text-white font-bold" : "text-gray-400"}`}>
                            {p.username} {p.socketId === socket.id && "(You)"}
                        </span>
                    </div>
                    <span className="font-bold">{score}</span>
                </div>
            );
        })}
    </div>
  );

  // --- MOBILE LAYOUT ---
  if (isMobile) {
      const isPhantomValid = phantomPos && dice && myPlayer && checkValidity(phantomPos.x, phantomPos.y, dice[0], dice[1], myPlayer.id);

      return (
        <div className="h-screen w-full bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <div className="h-14 bg-slate-800 flex items-center justify-between px-4 border-b border-slate-700 z-20 flex-shrink-0">
                <button onClick={onLeave} className="bg-slate-700 px-3 py-1 rounded text-sm hover:bg-slate-600">Exit</button>
                <div className="flex gap-2">
                    <button onClick={() => setShowMobileMenu('players')} className="bg-slate-700 px-3 py-1 rounded text-sm">👥</button>
                    <button onClick={() => setShowMobileMenu('chat')} className="bg-slate-700 px-3 py-1 rounded text-sm">💬</button>
                </div>
            </div>

            {/* Mobile Status Bar (NEW: Above Canvas) */}
            <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 p-2 flex justify-center z-10">
                 <div className={`px-4 py-1 rounded-full border shadow-sm backdrop-blur-md transition-all w-auto ${isFinished ? "bg-slate-900 border-yellow-500/50" : "bg-slate-800 border-slate-600"}`}>
                    {isFinished ? (
                        <span className="text-yellow-400 font-bold text-xs flex items-center gap-2 animate-pulse">
                            🏆 {room.winnerId === 'draw' ? "DRAW" : `WINNER: ${winnerName}`}
                        </span>
                    ) : notification ? (
                        <span className="text-yellow-400 font-bold animate-pulse text-xs flex items-center gap-2">⚠️ {notification}</span>
                    ) : (
                        <span className={`text-xs font-mono flex items-center gap-2 ${isMyTurn ? "text-green-400 font-bold" : "text-slate-400"}`}>
                            {isMyTurn ? <>➤ YOUR TURN</> : <>⏳ Wait: {currentPlayerName}</>}
                        </span>
                    )}
                 </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative bg-slate-900 overflow-hidden">
                <GameCanvas 
                    grid={grid} players={room.players} cellSize={25} 
                    activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                    onCellClick={handleCellClick}
                    checkValidity={(x, y) => (dice && myPlayer) ? checkValidity(x, y, dice[0], dice[1], myPlayer.id) : false}
                    phantomPos={phantomPos}
                />

                {/* Confirm Button (Floating at bottom is still good for thumb reach) */}
                {isPhantomValid && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 animate-bounce-small">
                        <button onClick={handleConfirmMove} className="px-8 py-3 bg-green-500 text-black font-black text-xl rounded-full shadow-2xl border-4 border-green-600 active:scale-95">
                            ✅ CONFIRM
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile Controls */}
            <div className="bg-slate-800 p-4 flex gap-3 items-center z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] border-t border-slate-700 flex-shrink-0">
                <div className={`bg-slate-900 px-4 py-2 rounded-lg border font-mono font-bold text-2xl flex items-center justify-center min-w-[80px] ${isRolling ? "border-slate-600 text-slate-400" : "border-slate-500 text-yellow-400"}`}>
                    {dice ? `${dice[0]}x${dice[1]}` : "?x?"}
                </div>
                
                <button 
                    onClick={rollDice} 
                    disabled={!isMyTurn || isRolling || isPlacing} 
                    className={`flex-1 py-3 font-bold rounded-lg text-lg transition-colors shadow-lg
                        ${!isMyTurn 
                            ? "bg-slate-700 text-slate-500 cursor-not-allowed border border-slate-600" 
                            : isPlacing 
                                ? "bg-slate-600 text-white border border-slate-500 animate-pulse" 
                                : "bg-blue-600 text-white active:scale-95 hover:bg-blue-500 shadow-blue-900/20"
                        }`}
                >
                    {!isMyTurn ? "WAIT..." : (isPlacing ? "PLACE" : "ROLL")}
                </button>

                <button 
                    onClick={rotateDice} 
                    disabled={!isMyTurn || !isPlacing} 
                    className={`px-4 py-3 rounded-lg font-bold border ${!isMyTurn || !isPlacing ? "bg-slate-700 text-slate-500 border-slate-600" : "bg-slate-600 text-white border-slate-500 active:scale-95"}`}
                >
                    ↻
                </button>
            </div>

            {showMobileMenu && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowMobileMenu(null)}>
                    <div className="bg-slate-800 w-full max-w-sm h-[70vh] rounded-2xl flex flex-col border border-slate-600 overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between p-4 bg-slate-900 border-b border-slate-700">
                            <h3 className="font-bold uppercase text-white">{showMobileMenu}</h3>
                            <button onClick={() => setShowMobileMenu(null)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <div className="flex-1 overflow-hidden p-2 bg-slate-800">
                            {showMobileMenu === 'players' ? <div className="overflow-y-auto h-full"><PlayersList /></div> : <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />}
                        </div>
                    </div>
                </div>
            )}
             {isFinished && <GameOverModal room={room} grid={grid} onLeave={onLeave} />}
        </div>
      );
  }

  // --- PC LAYOUT ---
  return (
    <div className="h-screen bg-slate-900 text-white flex p-4 gap-4 overflow-hidden font-sans" onContextMenu={handleRightClick}>
      
      {/* ЛІВА КОЛОНКА (Чат) */}
      <div className="w-80 flex flex-col gap-2 flex-shrink-0">
          <div className="flex-shrink-0">
            <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-2 w-full justify-center">
                 ← Exit Game
            </button>
          </div>
          <div className="flex-1 min-h-0 border border-slate-700 rounded-xl overflow-hidden bg-slate-800">
             <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
          </div>
      </div>

      {/* ЦЕНТР (ІГРОВЕ ПОЛЕ + СТАТУС) */}
      <div className="flex-1 flex flex-col relative bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shadow-inner p-2">
          
          {/* СТАТУС БАР */}
          <div className="flex-shrink-0 mb-2 flex justify-center">
             <div className={`h-10 flex items-center justify-center rounded-full px-6 border shadow-sm backdrop-blur-md transition-all w-auto ${isFinished ? "bg-slate-900 border-yellow-500/50 shadow-yellow-900/20" : "bg-slate-900/90 border-slate-600"}`}>
                {isFinished ? (
                    <span className="text-yellow-400 font-bold text-sm flex items-center gap-2 animate-pulse">
                        🏆 {room.winnerId === 'draw' ? "DRAW" : `WINNER: ${winnerName}`}
                    </span>
                ) : notification ? (
                    <span className="text-yellow-400 font-bold animate-pulse text-sm flex items-center gap-2">⚠️ {notification}</span>
                ) : (
                    <span className={`text-sm font-mono flex items-center gap-2 ${isMyTurn ? "text-green-400 font-bold" : "text-slate-400"}`}>
                        {isMyTurn ? <>➤ YOUR TURN</> : <>⏳ Wait: {currentPlayerName}</>}
                    </span>
                )}
             </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 w-full relative overflow-hidden rounded-lg border border-slate-700/50">
                <GameCanvas 
                    grid={grid} players={room.players} 
                    cellSize={25} 
                    activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                    onCellClick={handleCellClick}
                    checkValidity={(x, y) => (dice && myPlayer) ? checkValidity(x, y, dice[0], dice[1], myPlayer.id) : false}
                />
          </div>
      </div>

      {/* ПРАВА КОЛОНКА (Управління) */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col items-center">
                <div className="flex justify-between w-full mb-2">
                     <span className="text-xs text-slate-400 uppercase font-bold">Current Roll</span>
                     {isMyTurn && !isFinished && <span className="text-xs text-green-400 font-bold animate-pulse">YOUR TURN!</span>}
                </div>
                <div className={`flex items-center justify-center gap-2 text-5xl font-mono font-bold w-full py-6 rounded-xl border bg-slate-900 ${isRolling ? "border-slate-700 blur-[1px]" : "border-slate-600"} ${isFinished ? "opacity-50" : ""}`}>
                    {dice ? <><span className="text-yellow-400">{dice[0]}</span><span className="text-slate-600 text-3xl">x</span><span className="text-yellow-400">{dice[1]}</span></> : <span className="text-slate-600 text-4xl tracking-widest">? x ?</span>}
                </div>
                <div className="flex flex-col gap-3 w-full mt-6">
                    <button onClick={rollDice} disabled={isFinished || !isMyTurn || isRolling || isPlacing} className={`w-full py-4 font-bold text-lg rounded-xl transition shadow-lg active:scale-[0.98] ${isFinished ? "bg-slate-800 text-slate-600 cursor-not-allowed" : (!isMyTurn) ? "bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed" : (isPlacing ? "bg-green-600 hover:bg-green-500 text-white" : "bg-blue-600 hover:bg-blue-500 text-white")}`}>
                        {isFinished ? "GAME OVER" : (!isMyTurn ? "WAIT TURN" : (isPlacing ? "PLACE FIGURE" : (isRolling ? "ROLLING..." : "ROLL DICE")))}
                    </button>
                    <button onClick={rotateDice} disabled={isFinished || !isMyTurn || !isPlacing} className="w-full py-3 font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition active:scale-[0.98] disabled:opacity-50 border border-slate-600">
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
                    <PlayersList />
                </div>
            </div>
      </div>
      {isFinished && <GameOverModal room={room} grid={grid} onLeave={onLeave} />}
    </div>
  );
};