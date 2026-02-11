import { socket } from '../socket';
import type { Room } from '@territory/shared';
import { GameChat } from './GameChat';

interface GameLobbyProps {
  room: Room;
  onLeave: () => void;
}

export const GameLobby = ({ room, onLeave }: GameLobbyProps) => {
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const isHost = room.hostId === myPlayer?.id;
  const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);
  const canStart = allReady && room.players.length >= 2;

  const toggleReady = () => socket.emit('toggleReady', { roomId: room.id });
  
  const handleStartGame = () => {
    if (isHost && canStart) {
        socket.emit('startGame', { roomId: room.id });
    } else if (isHost) {
        alert("Need at least 2 players to start!");
    }
  };

  const handleKick = (targetId: string) => {
    if (confirm("Kick this player?")) {
        socket.emit('kickPlayer', { roomId: room.id, targetId });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center font-sans p-4 relative">
        <div className="absolute top-4 left-4">
            <button onClick={onLeave} className="px-4 py-2 bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-gray-300 hover:text-white rounded-lg transition flex items-center gap-2">
              ← Leave Lobby
            </button>
        </div>

        <h1 className="text-4xl font-bold mb-2 text-blue-400">LOBBY</h1>
        
        <div className="flex items-center gap-3 mb-8">
            <p className="text-gray-500 font-mono bg-slate-800 px-3 py-1 rounded border border-slate-700">
                ID: <span className="text-white select-all">{room.id}</span>
            </p>
            {room.settings.isPrivate && <span className="text-xs bg-yellow-900/30 text-yellow-500 px-2 py-1 rounded border border-yellow-700 font-bold">🔒 PRIVATE</span>}
            {room.settings.mode === 'fast' ? (
                <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-700 font-bold flex items-center gap-1">⚡ FAST MODE</span>
            ) : (
                <span className="text-xs bg-slate-700 text-gray-400 px-2 py-1 rounded border border-slate-600">CLASSIC</span>
            )}
        </div>
        
        {/* FIX 1: Фіксована висота h-[600px] замість min-h */}
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl h-[600px]">
          
          {/* ЛІВА ПАНЕЛЬ (Гравці) */}
          <div className="bg-slate-800 p-8 rounded-xl flex-1 shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h2 className="text-xl font-bold text-gray-300">Players</h2>
                <span className="text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-700 text-blue-400">
                  {room.players.length} / {room.settings.maxPlayers}
                </span>
            </div>
            
            {/* FIX 2: overflow-y-auto тут теж потрібен, якщо гравців багато */}
            <div className="space-y-3 mb-8 flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              {room.players.map(p => (
                <div key={p.id} className={`flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700 transition-all ${!p.isOnline ? "opacity-50 grayscale border-red-900/30" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                          <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>
                          {!p.isOnline && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                      </div>
                      <span className={p.socketId === socket.id ? "font-bold text-white" : "text-gray-400"}>
                        {p.username} {p.socketId === socket.id && "(You)"}
                        {p.id === room.hostId && <span className="ml-2 text-[10px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/30">HOST</span>}
                        {!p.isOnline && <span className="ml-2 text-[10px] text-red-500 font-bold">OFFLINE</span>}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded tracking-wider ${p.isReady ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                          {p.isReady ? "READY" : "WAITING"}
                        </span>
                        {isHost && p.id !== myPlayer?.id && (
                            <button onClick={() => handleKick(p.id)} className="text-slate-600 hover:text-red-500 transition px-2 py-1 hover:bg-red-900/20 rounded" title="Kick Player">✕</button>
                        )}
                    </div>
                </div>
              ))}
              {Array.from({ length: room.settings.maxPlayers - room.players.length }).map((_, i) => (
                  <div key={i} className="p-3 border border-dashed border-slate-700 rounded-lg text-slate-600 text-center text-sm">Waiting for player...</div>
              ))}
            </div>

            <div className="flex flex-col gap-4 mt-auto flex-shrink-0">
                <button onClick={toggleReady} className={`w-full py-4 rounded-xl font-bold text-xl transition transform active:scale-[0.98] ${myPlayer?.isReady ? "bg-slate-700 hover:bg-slate-600 text-gray-300" : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50"}`}>
                  {myPlayer?.isReady ? "CANCEL READY" : "I AM READY"}
                </button>
                {isHost && (
                    <button onClick={handleStartGame} disabled={!canStart} className={`w-full py-4 rounded-xl font-bold text-xl transition flex items-center justify-center gap-2 ${canStart ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/50 cursor-pointer animate-pulse" : "bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed"}`}>
                      START GAME 🚀
                    </button>
                )}
                {isHost && !canStart && <p className="text-center text-xs text-red-400/70">{room.players.length < 2 ? "Need min 2 players" : "Wait for everyone to be READY"}</p>}
            </div>
          </div>
          
          {/* ПРАВА ПАНЕЛЬ (Чат) - h-full тут працюватиме, бо батько має фіксовану висоту */}
          <div className="lg:w-80 h-full flex flex-col"> 
             <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
          </div>
        </div>
    </div>
  );
};