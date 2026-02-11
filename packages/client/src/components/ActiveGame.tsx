import { useState, useEffect } from 'react';
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
  
  const ROWS = room.settings.boardSize;
  const COLS = room.settings.boardSize;

  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const myIndex = room.players.findIndex(p => p.id === myPlayer?.id);
  const isMyTurn = room.currentTurnIndex === myIndex;

  useEffect(() => {
     if (isMyTurn) {
         setIsPlacing(false);
         setDice(null);
     }
  }, [room.currentTurnIndex, isMyTurn]);

  // --- ВАЛІДАЦІЯ (без змін) ---
  const checkValidity = (x: number, y: number, w: number, h: number, playerId: string): boolean => {
    if (y + h > ROWS || x + w > COLS || x < 0 || y < 0) return false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[y + r][x + c] !== null) return false; 
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
    if (!isPlacing || !dice || !socket.id || !myPlayer) return;
    if (!isMyTurn) return; 
    
    const [w, h] = dice;
    if (!checkValidity(x, y, w, h, myPlayer.id)) return;
    
    const payload: MakeMoveDto = { roomId: room.id, x, y, w, h };
    socket.emit('makeMove', payload);
    setIsPlacing(false); 
  };

  const rollDice = () => {
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
               alert(`No moves for ${d1}x${d2}. Skipping...`);
               socket.emit('skipTurn', { roomId: room.id });
               setDice(null);
            }, 500);
         } else {
            setIsPlacing(true);
         }
      }
    }, 600);
  };

  const rotateDice = () => setDice(prev => prev ? [prev[1], prev[0]] : null);
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isPlacing && isMyTurn) rotateDice();
  };

  return (
    // ГОЛОВНИЙ КОНТЕЙНЕР: h-screen (на весь екран), overflow-hidden (щоб не було скролу сторінки)
    <div className="h-screen bg-gray-900 text-white flex p-4 gap-4 overflow-hidden font-sans" onContextMenu={handleRightClick}>
      
      {/* --- ЛІВА КОЛОНКА: ЧАТ --- */}
      <div className="w-80 flex flex-col gap-2 flex-shrink-0">
          <div className="flex-shrink-0">
            <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-2 w-full justify-center">
                 ← Exit Game
            </button>
          </div>
          
          {/* Чат займає всю решту висоти лівої колонки */}
          <div className="flex-1 min-h-0">
             <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
          </div>
      </div>

      {/* --- ЦЕНТРАЛЬНА КОЛОНКА: КАРТА --- */}
      {/* flex-1 дозволяє карті займати весь вільний простір по центру */}
      <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-center overflow-auto relative p-4 shadow-inner">
          <div className="bg-white rounded shadow-2xl overflow-hidden inline-block ring-8 ring-slate-800">
            <GameCanvas 
                grid={grid} 
                players={room.players}
                // Динамічний розмір клітинки, щоб карта влазила
                cellSize={ROWS*COLS <= 400 ? 25 : ROWS*COLS <= 1600 ? 18 : 12}
                activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                onCellClick={handleCellClick}
                checkValidity={(x, y) => (dice && myPlayer) ? checkValidity(x, y, dice[0], dice[1], myPlayer.id) : false}
            />
          </div>
          
          {/* Інфо про режим гри (плаваючий бейдж) */}
          <div className="absolute top-4 right-4 pointer-events-none opacity-80">
                {room.settings.mode === 'fast' ? (
                    <span className="text-xs bg-blue-900/80 text-blue-400 px-3 py-1.5 rounded border border-blue-500/50 font-bold shadow-lg backdrop-blur-sm">
                    ⚡ FAST MODE
                    </span>
                ) : (
                    <span className="text-xs bg-slate-900/80 text-gray-400 px-3 py-1.5 rounded border border-slate-600 font-bold shadow-lg backdrop-blur-sm">
                    CLASSIC
                    </span>
                )}
          </div>
      </div>

      {/* --- ПРАВА КОЛОНКА: УПРАВЛІННЯ ТА СПИСОК ГРАВЦІВ --- */}
      <div className="w-80 flex flex-col gap-4 flex-shrink-0">
            
            {/* Блок Кубиків (Фіксована висота) */}
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col items-center">
                <div className="flex justify-between w-full mb-2">
                     <span className="text-xs text-slate-400 uppercase font-bold">Current Roll</span>
                     {isMyTurn && <span className="text-xs text-green-400 font-bold animate-pulse">YOUR TURN!</span>}
                </div>
                
                <div className={`flex items-center justify-center gap-2 text-5xl font-mono font-bold w-full py-6 rounded-xl border transition-all duration-100 bg-slate-900 ${isRolling ? "border-slate-700 blur-[1px]" : "border-slate-600"}`}>
                    {dice ? (
                      <><span className="text-yellow-400">{dice[0]}</span><span className="text-slate-600 text-3xl">x</span><span className="text-yellow-400">{dice[1]}</span></>
                    ) : (
                      <span className="text-slate-600 text-4xl tracking-widest">? x ?</span>
                    )}
                </div>
                <div className="flex flex-col gap-3 w-full mt-6">
                    <button onClick={rollDice} disabled={!isMyTurn || isRolling || isPlacing} className={`w-full py-4 font-bold text-lg rounded-xl transition shadow-lg active:scale-[0.98] ${(!isMyTurn) ? "bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed border border-slate-600" : (isPlacing ? "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20")}`}>
                        {!isMyTurn ? "WAIT TURN" : (isPlacing ? "PLACE FIGURE" : (isRolling ? "ROLLING..." : "ROLL DICE"))}
                    </button>
                    <button onClick={rotateDice} disabled={!isMyTurn || !isPlacing} className="w-full py-3 font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition active:scale-[0.98] disabled:opacity-50 border border-slate-600">
                        ROTATE <span className="text-slate-400 text-xs font-normal">(R-Click)</span>
                    </button>
                </div>
            </div>

            {/* Список гравців (Займає решту місця) */}
            <div className="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
                    <h3 className="text-xs text-slate-400 uppercase font-bold">Players</h3>
                    <span className="font-mono text-xs text-slate-500">ID: {room.id}</span>
                </div>
                
                <div className="space-y-2 overflow-y-auto custom-scrollbar pr-1">
                    {room.players.map((p, index) => {
                        const isActive = index === room.currentTurnIndex;
                        return (
                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isActive ? "bg-slate-700 border-blue-500/50 shadow-lg scale-[1.02]" : "bg-slate-900/40 border-slate-700/50 opacity-70"}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="relative">
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }}></div>
                                        {!p.isOnline && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-slate-900"></span>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-sm truncate leading-none ${isActive ? "text-white font-bold" : "text-gray-400"}`}>
                                            {p.username} {p.socketId === socket.id && "(You)"}
                                        </span>
                                        {!p.isOnline && <span className="text-[9px] text-red-500 font-bold leading-none mt-1">OFFLINE</span>}
                                    </div>
                                </div>
                                {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_#3b82f6]"></div>}
                            </div>
                        );
                    })}
                </div>
            </div>
      </div>
    </div>
  );
};