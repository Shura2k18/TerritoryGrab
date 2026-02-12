import { socket } from '../socket';
import type { Room } from '@territory/shared';
import { useMemo } from 'react';

interface GameOverModalProps {
  room: Room;
  grid: (string | null)[][];
  onLeave: () => void;
}

export const GameOverModal = ({ room, grid, onLeave }: GameOverModalProps) => {
  
  // Ця функція потрібна ТІЛЬКИ як запасний варіант, якщо сервер не надіслав результати
  const calculateLiveScores = () => {
    const scores: Record<string, number> = {};
    room.players.forEach(p => scores[p.id] = 0);
    const size = room.settings.boardSize;

    // Рахуємо клітинки (сервер вже зафарбував захоплені території, тому FloodFill тут надлишковий,
    // але залишаємо як є для надійності fallback-у)
    for(let y=0; y < size; y++) {
        for(let x=0; x < size; x++) {
            const ownerId = grid[y][x];
            if (ownerId && scores[ownerId] !== undefined) scores[ownerId]++;
        }
    }
    return scores;
  };

  // --- ГОЛОВНИЙ ФІКС ТУТ ---
  const finalPlayers = useMemo(() => {
    // 1. Якщо сервер надіслав фінальний звіт (gameResult) - ВИКОРИСТОВУЄМО ЙОГО.
    // Це "зліпок" гри. Навіть якщо гравці повиходять, цей масив не зміниться.
    if (room.gameResult && room.gameResult.players.length > 0) {
        return [...room.gameResult.players].sort((a, b) => b.score - a.score);
    }

    // 2. Fallback (на всяк випадок): рахуємо вручну по живих гравцях
    const scores = calculateLiveScores();
    return [...room.players]
        .map(p => ({
            id: p.id,
            username: p.username,
            color: p.color,
            score: scores[p.id] || 0
        }))
        .sort((a, b) => b.score - a.score);
  }, [room.gameResult, room.players, grid]); // Залежності

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
       <div className="bg-slate-800 border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <h2 className="text-4xl font-bold text-center mb-2 text-white">GAME OVER</h2>
          <p className="text-center text-slate-400 mb-8">Final Scores</p>

          <div className="space-y-4 mb-8">
            {/* Рендеримо ЗАМОРОЖЕНИЙ список (finalPlayers), а не room.players */}
            {finalPlayers.map((p, index) => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${index === 0 ? "bg-yellow-500/10 border-yellow-500/50" : "bg-slate-900 border-slate-700"}`}>
                    <div className="flex items-center gap-4">
                        <span className={`text-xl font-bold ${index===0 ? "text-yellow-400" : "text-slate-500"}`}>#{index+1}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                            <span className="text-lg font-bold text-white">{p.username}</span>
                        </div>
                    </div>
                    {/* p.score вже є всередині об'єкта, бо ми підготували finalPlayers */}
                    <span className="text-2xl font-mono font-bold text-white">{p.score}</span>
                </div>
            ))}
          </div>

          <div className="space-y-3">
              {/* Кнопки Vote/Rematch залишаємо на базі room.players, бо голосувати можуть тільки ті, хто онлайн */}
              <button 
                onClick={() => socket.emit('voteRematch', { roomId: room.id })}
                // Перевіряємо, чи ми взагалі ще в кімнаті (безпечний доступ)
                disabled={room.players.find(p => p.id === socket.id)?.wantsRematch}
                className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${room.players.find(p => p.id === socket.id)?.wantsRematch ? "bg-slate-700 text-green-400 cursor-default" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"}`}
              >
                {room.players.find(p => p.id === socket.id)?.wantsRematch ? "WAITING FOR OTHERS..." : "VOTE FOR REMATCH"}
              </button>
              
              <div className="flex justify-center gap-1">
                  {/* Крапки показують статус ТІЛЬКИ живих гравців */}
                  {room.players.map(p => (
                      <div key={p.id} className={`w-3 h-3 rounded-full ${p.wantsRematch ? "bg-green-500" : "bg-slate-600"}`} title={p.username}></div>
                  ))}
              </div>

              <button onClick={onLeave} className="w-full py-3 text-slate-500 hover:text-white font-bold transition">Leave Room</button>
          </div>
       </div>
    </div>
  );
};