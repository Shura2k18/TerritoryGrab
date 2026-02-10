import { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import type { Room, MakeMoveDto } from '@territory/shared'; 
import { socket } from '../socket'; 

interface GameRoomProps {
  room: Room;
}

type CellOwner = string | null;

export const GameRoom = ({ room: initialRoom }: GameRoomProps) => {
  const [room, setRoom] = useState<Room>(initialRoom);
  
  const ROWS = room.settings.boardSize;
  const COLS = room.settings.boardSize;

  const generateEmptyGrid = (r: number, c: number) => 
    Array(r).fill(null).map(() => Array(c).fill(null));

  const [grid, setGrid] = useState<CellOwner[][]>(
    (room.board as CellOwner[][]) || generateEmptyGrid(ROWS, COLS)
  );

  const [dice, setDice] = useState<[number, number] | null>(null);
  const [isPlacing, setIsPlacing] = useState(false); 
  const [isRolling, setIsRolling] = useState(false);

  const myIndex = room.players.findIndex(p => p.id === socket.id);
  const isMyTurn = room.currentTurnIndex === myIndex;
  
  // Визначаємо, чи я хост
  const isHost = room.hostId === socket.id;

  // --- СЛУХАЧ ОНОВЛЕНЬ ---
  useEffect(() => {
    const onGameUpdate = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.board) setGrid(updatedRoom.board as CellOwner[][]);

      const newMyIndex = updatedRoom.players.findIndex(p => p.id === socket.id);
      if (updatedRoom.currentTurnIndex === newMyIndex) {
         setIsPlacing(false);
         setDice(null); 
      }
    };

    socket.on('gameUpdated', onGameUpdate);
    return () => { socket.off('gameUpdated', onGameUpdate); };
  }, []);

  // --- ЛОГІКА ВАЛІДАЦІЇ ---
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

  // --- ОБРОБНИКИ ---
  const handleCellClick = (x: number, y: number) => {
    if (!isPlacing || !dice || !socket.id) return;
    if (!isMyTurn) return; // Silent return for UX
    const [w, h] = dice;
    if (!checkValidity(x, y, w, h, socket.id)) return;
    socket.emit('makeMove', { roomId: room.id, x, y, w, h });
    setIsPlacing(false); 
  };

  const rollDice = () => {
    if (isRolling || !isMyTurn) return;
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

      if (socket.id) {
         const canMove = checkCanPlaceAnywhere(d1, d2, socket.id);
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

  // --- LOBBY ACTIONS ---
  const toggleReady = () => socket.emit('toggleReady', { roomId: room.id });
  
  const handleStartGame = () => {
      if (!isHost) return;
      socket.emit('startGame', { roomId: room.id });
  };

  const calculateScores = () => {
    const scores: Record<string, number> = {};
    
    // 1. Ініціалізуємо нулями
    room.players.forEach(p => scores[p.id] = 0);

    const size = room.settings.boardSize;

    // 2. Рахуємо явно зайняті клітинки (Фігури)
    for(let y=0; y < size; y++) {
        for(let x=0; x < size; x++) {
            const ownerId = grid[y][x];
            // Перевіряємо, чи є власник і чи є він у списку гравців (щоб уникнути помилок з типом)
            if (ownerId && scores[ownerId] !== undefined) {
                scores[ownerId]++;
            }
        }
    }

    // 3. Рахуємо захоплені території (Flood Fill / Заливка)
    // Матриця відвіданих клітинок, щоб не рахувати одну й ту ж дірку двічі
    const visited = Array(size).fill(false).map(() => Array(size).fill(false));

    // Допоміжна функція: отримати сусідів (верх, низ, ліво, право)
    const getNeighbors = (r: number, c: number) => {
        const neighbors = [];
        if (r > 0) neighbors.push([r - 1, c]);
        if (r < size - 1) neighbors.push([r + 1, c]);
        if (c > 0) neighbors.push([r, c - 1]);
        if (c < size - 1) neighbors.push([r, c + 1]);
        return neighbors;
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Якщо клітинка пуста (null) і ми її ще не перевіряли
            if (grid[y][x] === null && !visited[y][x]) {
                
                // Починаємо аналіз регіону (BFS/DFS)
                const queue = [[y, x]];
                visited[y][x] = true;
                
                let emptyCellsCount = 0;
                // Сет для зберігання унікальних ID гравців, які торкаються цієї пустоти
                const touchingPlayers = new Set<string>();
                
                while (queue.length > 0) {
                    const [curY, curX] = queue.pop()!;
                    emptyCellsCount++;

                    const neighbors = getNeighbors(curY, curX);
                    for (const [nY, nX] of neighbors) {
                        const cellValue = grid[nY][nX];
                        
                        if (cellValue === null) {
                            // Якщо сусід теж пустий - додаємо в чергу на перевірку
                            if (!visited[nY][nX]) {
                                visited[nY][nX] = true;
                                queue.push([nY, nX]);
                            }
                        } else {
                            // Якщо сусід зайнятий кимось - записуємо ID власника
                            // (стіни карти просто ігноруються, вони не додають нікого в Set)
                            touchingPlayers.add(cellValue);
                        }
                    }
                }

                // АНАЛІЗ РЕЗУЛЬТАТУ РЕГІОНУ
                // Логіка:
                // 1. touchingPlayers.size === 1 -> Оточено одним гравцем (або гравцем + стінами). Це БАЛИ!
                // 2. touchingPlayers.size > 1   -> Спільна територія (нічия). Ігноруємо.
                // 3. touchingPlayers.size === 0 -> Острів у пустоті. Ігноруємо.
                
                if (touchingPlayers.size === 1) {
                    // Отримуємо ID єдиного гравця
                    const ownerId = touchingPlayers.values().next().value;
                    
                    // ВИПРАВЛЕННЯ ПОМИЛКИ:
                    // Перевіряємо, чи ownerId існує (не undefined) перед використанням як індексу
                    if (ownerId && scores[ownerId] !== undefined) {
                        scores[ownerId] += emptyCellsCount;
                    }
                }
            }
        }
    }

    return scores;
  };

  const handleRematch = () => {
      socket.emit('voteRematch', { roomId: room.id });
  };

  // ==========================================
  // VIEW: LOBBY
  // ==========================================
  if (room.status === 'lobby') {
    const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);

    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans p-4">
        <h1 className="text-4xl font-bold mb-2 text-blue-400">LOBBY</h1>
        <p className="text-gray-500 mb-8 font-mono">Room ID: {room.id}</p>
        
        <div className="bg-slate-800 p-8 rounded-xl w-full max-w-lg shadow-2xl border border-slate-700">
           <div className="space-y-3 mb-8">
             {room.players.map(p => (
               <div key={p.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                     <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                     <span className={p.id === socket.id ? "font-bold text-white" : "text-gray-400"}>
                       {p.username} {p.id === socket.id && "(You)"}
                       {p.id === room.hostId && <span className="ml-2 text-xs text-yellow-500">👑 HOST</span>}
                     </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded tracking-wider ${p.isReady ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                     {p.isReady ? "READY" : "WAITING"}
                  </span>
               </div>
             ))}
             {Array.from({ length: room.settings.maxPlayers - room.players.length }).map((_, i) => (
                <div key={i} className="p-3 border border-dashed border-slate-700 rounded-lg text-slate-600 text-center text-sm">Empty Slot</div>
             ))}
           </div>

           <div className="flex flex-col gap-4">
               {/* Кнопка готовності для всіх */}
               <button 
                 onClick={toggleReady}
                 className={`w-full py-4 rounded-xl font-bold text-xl transition transform active:scale-[0.98] ${
                   room.players.find(p => p.id === socket.id)?.isReady
                     ? "bg-slate-700 hover:bg-slate-600 text-gray-300" 
                     : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"
                 }`}
               >
                 {room.players.find(p => p.id === socket.id)?.isReady ? "CANCEL READY" : "I AM READY"}
               </button>

               {/* Кнопка старту (ТІЛЬКИ ДЛЯ ХОСТА) */}
               {isHost && (
                   <button 
                     onClick={handleStartGame}
                     disabled={!allReady}
                     className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${
                        allReady 
                        ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50 cursor-pointer animate-pulse" 
                        : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"
                     }`}
                   >
                     START GAME 🚀
                   </button>
               )}
               {isHost && !allReady && (
                   <p className="text-center text-xs text-red-400">Wait for everyone to be READY</p>
               )}
           </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: GAME (SIDE BY SIDE LAYOUT)
  // ==========================================
  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gray-900 text-white" onContextMenu={handleRightClick}>
      
      {/* ГОЛОВНИЙ КОНТЕЙНЕР: Змінив на flex-row */}
      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-7xl items-start justify-center h-full">
        
        {/* ЛІВА ЧАСТИНА: КАНВАС (Центральне місце) */}
        <div className="relative p-2 bg-slate-700 rounded-xl shadow-2xl ring-8 ring-slate-800/50 order-2 lg:order-1 
                      max-w-[90vw] max-h-[80vh] overflow-auto"> {/* <--- Scrollbars для великих карт */}
          <div className="bg-white rounded shadow-lg overflow-hidden inline-block">
            <GameCanvas 
                grid={grid} 
                players={room.players}
                cellSize={ROWS*COLS <= 400 ? 25 : ROWS*COLS <= 1600 ? 15 : 20}
                activeRect={(isPlacing && dice) ? { w: dice[0], h: dice[1] } : null} 
                onCellClick={handleCellClick}
                checkValidity={(x, y) => (dice && socket.id) ? checkValidity(x, y, dice[0], dice[1], socket.id) : false}
            />
            </div>
            {/* Статус під картою */}
            <div className="mt-4 flex justify-between text-sm text-slate-400 px-2">
                <span>Room: {room.id}</span>
                <span>{room.settings.boardSize}x{room.settings.boardSize}</span>
            </div>
        </div>

        {/* ПРАВА ЧАСТИНА: ПАНЕЛЬ (SIDEBAR) */}
        <div className="flex flex-col gap-4 w-full lg:w-80 order-1 lg:order-2">
            
            {/* БЛОК КУБИКІВ */}
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 flex flex-col items-center">
                <span className="text-xs text-slate-400 uppercase font-bold mb-3">Current Roll</span>
                
                {/* Bugfix #1: Явне задання кольорів для кожного числа */}
                <div className={`
                    flex items-center justify-center gap-2 text-5xl font-mono font-bold w-full py-6 rounded-xl border transition-all duration-100 bg-slate-900
                    ${isRolling ? "border-slate-700 blur-[1px]" : "border-slate-600"}
                `}>
                    {dice ? (
                      <>
                        <span className="text-yellow-400">{dice[0]}</span>
                        <span className="text-slate-600 text-3xl">x</span>
                        <span className="text-yellow-400">{dice[1]}</span>
                      </>
                    ) : (
                      <span className="text-slate-600 text-4xl tracking-widest">? x ?</span>
                    )}
                </div>

                <div className="flex flex-col gap-3 w-full mt-6">
                    <button 
                        onClick={rollDice}
                        disabled={!isMyTurn || isRolling || isPlacing} 
                        className={`w-full py-4 font-bold text-lg rounded-xl transition shadow-lg active:scale-[0.98] 
                            ${(!isMyTurn) 
                                ? "bg-slate-700 text-slate-500 opacity-50 cursor-not-allowed border border-slate-600" 
                                : (isPlacing 
                                    ? "bg-green-600 hover:bg-green-500 text-white shadow-green-900/20" 
                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20")
                            }
                        `}
                    >
                        {!isMyTurn ? "WAIT TURN" : (isPlacing ? "PLACE FIGURE" : (isRolling ? "ROLLING..." : "ROLL DICE"))}
                    </button>
                    
                    <button 
                        onClick={rotateDice} 
                        disabled={!isMyTurn || !isPlacing} 
                        className="w-full py-3 font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition active:scale-[0.98] disabled:opacity-50 border border-slate-600"
                    >
                        ROTATE <span className="text-slate-400 text-xs font-normal">(R-Click)</span>
                    </button>
                </div>
            </div>

            {/* SCOREBOARD */}
            <div className="bg-slate-800 p-5 rounded-2xl shadow-xl border border-slate-700 flex-grow">
                <h3 className="text-xs text-slate-400 uppercase font-bold mb-4 border-b border-slate-700 pb-2">Players</h3>
                <div className="space-y-2">
                    {room.players.map((p, index) => {
                        const isActive = index === room.currentTurnIndex;
                        // Підрахунок очок (кількість клітинок) - для краси можна додати пізніше
                        return (
                            <div key={p.id} className={`
                                flex items-center justify-between p-3 rounded-lg border transition-all
                                ${isActive 
                                    ? "bg-slate-700 border-blue-500/50 shadow-lg scale-[1.02]" 
                                    : "bg-slate-900/40 border-slate-700/50 opacity-70"
                                }
                            `}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }}></div>
                                    <span className={`text-sm truncate ${isActive ? "text-white font-bold" : "text-gray-400"}`}>
                                        {p.username} {p.id === socket.id && "(You)"}
                                    </span>
                                </div>
                                {isActive && <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>}
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
      </div>
      {room.status === 'finished' && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
           <div className="bg-slate-800 border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-md w-full">
              <h2 className="text-4xl font-bold text-center mb-2 text-white">GAME OVER</h2>
              <p className="text-center text-slate-400 mb-8">Final Scores</p>

              <div className="space-y-4 mb-8">
                {room.players
                    .map(p => ({ ...p, score: calculateScores()[p.id] }))
                    .sort((a, b) => b.score - a.score) // Сортуємо: переможець зверху
                    .map((p, index) => (
                    <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${index === 0 ? "bg-yellow-500/10 border-yellow-500/50" : "bg-slate-900 border-slate-700"}`}>
                        <div className="flex items-center gap-4">
                            <span className={`text-xl font-bold ${index===0 ? "text-yellow-400" : "text-slate-500"}`}>#{index+1}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                                <span className="text-lg font-bold text-white">{p.username}</span>
                            </div>
                        </div>
                        <span className="text-2xl font-mono font-bold text-white">{p.score}</span>
                    </div>
                ))}
              </div>

              <div className="space-y-3">
                  <button 
                    onClick={handleRematch}
                    disabled={room.players.find(p => p.id === socket.id)?.wantsRematch}
                    className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${
                        room.players.find(p => p.id === socket.id)?.wantsRematch
                        ? "bg-slate-700 text-green-400 cursor-default"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"
                    }`}
                  >
                    {room.players.find(p => p.id === socket.id)?.wantsRematch 
                        ? "WAITING FOR OTHERS..." 
                        : "VOTE FOR REMATCH 🔄"}
                  </button>
                  
                  {/* Відображення голосів */}
                  <div className="flex justify-center gap-1">
                      {room.players.map(p => (
                          <div key={p.id} className={`w-3 h-3 rounded-full ${p.wantsRematch ? "bg-green-500" : "bg-slate-600"}`} title={p.username}></div>
                      ))}
                  </div>

                  <button 
                    onClick={() => window.location.reload()} // Просто перезавантажуємо сторінку для виходу
                    className="w-full py-3 text-slate-500 hover:text-white font-bold transition"
                  >
                    Leave Room
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};