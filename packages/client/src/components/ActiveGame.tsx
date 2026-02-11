import { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import { socket } from '../socket';
import type { Room, MakeMoveDto } from '@territory/shared';

interface ActiveGameProps {
  room: Room;
  grid: (string | null)[][]; 
  onLeave: () => void;
  // isMyTurn ми прибрали з пропсів, бо краще рахувати його тут
}

export const ActiveGame = ({ room, grid, onLeave }: ActiveGameProps) => {
  const [dice, setDice] = useState<[number, number] | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  
  const ROWS = room.settings.boardSize;
  const COLS = room.settings.boardSize;

  // --- ВИПРАВЛЕННЯ ЛОГІКИ ІДЕНТИФІКАЦІЇ ---
  // 1. Знаходимо об'єкт гравця за змінним socket.id
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  
  // 2. Знаходимо індекс гравця за його постійним UUID (id)
  // Це критично важливо, бо сервер використовує саме цей порядок у масиві
  const myIndex = room.players.findIndex(p => p.id === myPlayer?.id);
  
  // 3. Перевіряємо, чи наш хід
  const isMyTurn = room.currentTurnIndex === myIndex;

  // Скидання кубиків при зміні ходу
  useEffect(() => {
     // Якщо хід перейшов до нас (але це не початок гри з пустими кубиками)
     if (isMyTurn) {
         setIsPlacing(false);
         setDice(null);
     }
  }, [room.currentTurnIndex, isMyTurn]);

  // --- ВАЛІДАЦІЯ ---
  const checkValidity = (x: number, y: number, w: number, h: number, playerId: string): boolean => {
    if (y + h > ROWS || x + w > COLS || x < 0 || y < 0) return false;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (grid[y + r][x + c] !== null) return false; 
      }
    }
    const hasTerritory = grid.some(row => row.includes(playerId));
    
    // Перевірка першого ходу (кути)
    if (!hasTerritory) {
      let startX = 0; let startY = 0;
      
      // Використовуємо виправлений myIndex
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
    // Важливо: передаємо myPlayer.id (UUID), а не socket.id
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
         // Передаємо UUID
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
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-900 text-white" onContextMenu={handleRightClick}>
      
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-10">
          <button onClick={onLeave} className="px-3 py-1 bg-slate-800/80 hover:bg-red-600 text-xs rounded text-white border border-slate-600 transition">
             Exit Game
          </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl items-center justify-center h-full">
        {/* MAP */}
        <div className="relative p-2 bg-slate-700 rounded-xl shadow-2xl ring-8 ring-slate-800/50 order-2 lg:order-1 max-w-[90vw] max-h-[80vh] overflow-auto">
          <div className="bg-white rounded shadow-lg overflow-hidden inline-block">
            <GameCanvas 
                grid={grid} 
                players={room.players}
                cellSize={ROWS*COLS <= 400 ? 25 : ROWS*COLS <= 1600 ? 15 : 20}
                activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                onCellClick={handleCellClick}
                // Передаємо правильний UUID у валидацію
                checkValidity={(x, y) => (dice && myPlayer) ? checkValidity(x, y, dice[0], dice[1], myPlayer.id) : false}
            />
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="flex flex-col gap-4 w-full lg:w-80 order-1 lg:order-2">
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col items-center">
                <span className="text-xs text-slate-400 uppercase font-bold mb-3">Current Roll</span>
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
             <div className="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 flex-grow">
                {/* --- ІНФО ПРО КІМНАТУ ТА РЕЖИМ --- */}
                <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Room ID</span>
                        <span className="font-mono text-white text-sm">{room.id}</span>
                    </div>
                </div>
            </div>         
            <div className="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 flex-grow">
              <div className="flex items-center justify-between mb-4 pb-3">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Room ID</span>
                        <span className="font-mono text-white text-sm">{room.id}</span>
                    </div>
                    
                    {room.settings.mode === 'fast' ? (
                        <div className="text-right">
                             <span className="text-[10px] text-blue-400 uppercase font-bold block">Mode</span>
                             <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-700 font-bold flex items-center gap-1">
                                ⚡ FAST GAME
                             </span>
                        </div>
                    ) : (
                        <div className="text-right">
                             <span className="text-[10px] text-slate-500 uppercase font-bold block">Mode</span>
                             <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded border border-slate-600 font-bold">
                                CLASSIC
                             </span>
                        </div>
                    )}
                </div>
                <h3 className="text-xs text-slate-400 uppercase font-bold mb-4 border-b border-slate-700 pb-2">Players</h3>
                <div className="space-y-2">
                    {room.players.map((p, index) => {
                        const isActive = index === room.currentTurnIndex;
                        return (
                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isActive ? "bg-slate-700 border-blue-500/50 shadow-lg scale-[1.02]" : "bg-slate-900/40 border-slate-700/50 opacity-70"}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }}></div>
                                    <span className={`text-sm truncate ${isActive ? "text-white font-bold" : "text-gray-400"}`}>{p.username} {p.socketId === socket.id && "(You)"}</span>
                                </div>
                                {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};