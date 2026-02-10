import { socket } from '../socket';
import type { Room } from '@territory/shared';

interface GameLobbyProps {
  room: Room;
  onLeave: () => void;
}

export const GameLobby = ({ room, onLeave }: GameLobbyProps) => {
  const isHost = room.hostId === socket.id;
  const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);

  const toggleReady = () => socket.emit('toggleReady', { roomId: room.id });
  
  const handleStartGame = () => {
    if (isHost) socket.emit('startGame', { roomId: room.id });
  };

  const handleKick = (targetId: string) => {
    if (confirm("Kick this player?")) {
        socket.emit('kickPlayer', { roomId: room.id, targetId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans p-4 relative">
        {/* BACK BUTTON */}
        <div className="absolute top-4 left-4">
            <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-2">
              ← Leave Lobby
            </button>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-blue-400">LOBBY</h1>
        <div className="flex items-center gap-2 mb-8">
            <p className="text-gray-500 font-mono">ID: {room.id}</p>
            {room.settings.isPrivate && <span className="text-xs bg-yellow-900/50 text-yellow-500 px-2 py-0.5 rounded border border-yellow-700">PRIVATE</span>}
        </div>
        
        <div className="bg-slate-800 p-8 rounded-xl w-full max-w-lg shadow-2xl border border-slate-700">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-300">Players</h2>
              <span className="text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-700 text-blue-400">
                 {room.players.length} / {room.settings.maxPlayers}
              </span>
           </div>
           
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
                  
                  <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded tracking-wider ${p.isReady ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                        {p.isReady ? "READY" : "WAITING"}
                      </span>
                      {/* KICK BUTTON (Host only, not on self) */}
                      {isHost && p.id !== socket.id && (
                          <button onClick={() => handleKick(p.id)} className="text-slate-500 hover:text-red-500 transition px-2" title="Kick Player">✕</button>
                      )}
                  </div>
               </div>
             ))}
             {Array.from({ length: room.settings.maxPlayers - room.players.length }).map((_, i) => (
                <div key={i} className="p-3 border border-dashed border-slate-700 rounded-lg text-slate-600 text-center text-sm">Empty Slot</div>
             ))}
           </div>

           <div className="flex flex-col gap-4">
               <button onClick={toggleReady} className={`w-full py-4 rounded-xl font-bold text-xl transition transform active:scale-[0.98] ${room.players.find(p => p.id === socket.id)?.isReady ? "bg-slate-700 hover:bg-slate-600 text-gray-300" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"}`}>
                 {room.players.find(p => p.id === socket.id)?.isReady ? "CANCEL READY" : "I AM READY"}
               </button>

               {isHost && (
                   <button onClick={handleStartGame} disabled={!allReady} className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${allReady ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50 cursor-pointer animate-pulse" : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"}`}>
                     START GAME 🚀
                   </button>
               )}
           </div>
        </div>
    </div>
  );
};