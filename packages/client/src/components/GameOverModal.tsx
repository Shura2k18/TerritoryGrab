import { socket } from '../socket';
import type { Room } from '@territory/shared';

interface GameOverModalProps {
  room: Room;
  grid: (string | null)[][];
  onLeave: () => void;
}

export const GameOverModal = ({ room, grid, onLeave }: GameOverModalProps) => {
  
  // Функція підрахунку (з Flood Fill)
  const calculateScores = () => {
    const scores: Record<string, number> = {};
    room.players.forEach(p => scores[p.id] = 0);
    const size = room.settings.boardSize;

    // 1. Базові
    for(let y=0; y < size; y++) {
        for(let x=0; x < size; x++) {
            const ownerId = grid[y][x];
            if (ownerId && scores[ownerId] !== undefined) scores[ownerId]++;
        }
    }

    // 2. Flood Fill
    const visited = Array(size).fill(false).map(() => Array(size).fill(false));
    const getNeighbors = (r: number, c: number) => {
        const n = [];
        if (r > 0) n.push([r - 1, c]);
        if (r < size - 1) n.push([r + 1, c]);
        if (c > 0) n.push([r, c - 1]);
        if (c < size - 1) n.push([r, c + 1]);
        return n;
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (grid[y][x] === null && !visited[y][x]) {
                const queue = [[y, x]];
                visited[y][x] = true;
                let count = 0;
                const touch = new Set<string>();
                
                while (queue.length > 0) {
                    const [curY, curX] = queue.pop()!;
                    count++;
                    const n = getNeighbors(curY, curX);
                    for (const [nY, nX] of n) {
                        const cell = grid[nY][nX];
                        if (cell === null) {
                            if (!visited[nY][nX]) {
                                visited[nY][nX] = true;
                                queue.push([nY, nX]);
                            }
                        } else {
                            touch.add(cell);
                        }
                    }
                }
                if (touch.size === 1) {
                    const owner = touch.values().next().value;
                    if (owner && scores[owner] !== undefined) scores[owner] += count;
                }
            }
        }
    }
    return scores;
  };

  const scores = calculateScores();
  const sortedPlayers = [...room.players].sort((a, b) => scores[b.id] - scores[a.id]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
       <div className="bg-slate-800 border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <h2 className="text-4xl font-bold text-center mb-2 text-white">GAME OVER</h2>
          <p className="text-center text-slate-400 mb-8">Final Scores</p>

          <div className="space-y-4 mb-8">
            {sortedPlayers.map((p, index) => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-xl border ${index === 0 ? "bg-yellow-500/10 border-yellow-500/50" : "bg-slate-900 border-slate-700"}`}>
                    <div className="flex items-center gap-4">
                        <span className={`text-xl font-bold ${index===0 ? "text-yellow-400" : "text-slate-500"}`}>#{index+1}</span>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                            <span className="text-lg font-bold text-white">{p.username}</span>
                        </div>
                    </div>
                    <span className="text-2xl font-mono font-bold text-white">{scores[p.id]}</span>
                </div>
            ))}
          </div>

          <div className="space-y-3">
              <button 
                onClick={() => socket.emit('voteRematch', { roomId: room.id })}
                disabled={room.players.find(p => p.id === socket.id)?.wantsRematch}
                className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${room.players.find(p => p.id === socket.id)?.wantsRematch ? "bg-slate-700 text-green-400 cursor-default" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"}`}
              >
                {room.players.find(p => p.id === socket.id)?.wantsRematch ? "WAITING FOR OTHERS..." : "VOTE FOR REMATCH 🔄"}
              </button>
              
              <div className="flex justify-center gap-1">
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