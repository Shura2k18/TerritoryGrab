import { useState } from 'react';
import { socket } from '../socket';
import type { CreateRoomDto, JoinRoomDto } from '@territory/shared';

interface LobbyFormProps {
  isConnected: boolean;
  username: string;
  setUsername: (name: string) => void;
  onError: (msg: string) => void;
}

export const LobbyForm = ({ isConnected, username, setUsername, onError }: LobbyFormProps) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  
  // Налаштування створення
  const [selectedSize, setSelectedSize] = useState(20);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  const handleCreate = () => {
    if (!username) return onError("Please enter your name");
    
    const payload: CreateRoomDto = {
      username,
      settings: {
        maxPlayers: 4,
        boardSize: selectedSize,
        isPrivate,
        password: isPrivate ? password : undefined
      }
    };
    socket.emit('createGame', payload);
  };

  const handleJoin = () => {
    if (!username) return onError("Please enter your name");
    if (!roomIdToJoin) return onError("Please enter Room ID");

    const payload: JoinRoomDto = {
      roomId: roomIdToJoin,
      username,
      password: password // Передаємо пароль, якщо він введений
    };
    socket.emit('joinGame', payload);
  };

  return (
    <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        {/* Status Bar */}
        <div className="mb-6 flex items-center justify-between text-xs uppercase font-bold tracking-wider">
            <span className="text-gray-500">Server Status</span>
            <span className={isConnected ? "text-green-400" : "text-red-500"}>
               {isConnected ? '● Online' : '○ Offline'}
            </span>
        </div>

        {/* Username Input */}
        <div className="mb-6">
          <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Your Nickname</label>
          <input 
            type="text" 
            placeholder="Enter name..."
            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:border-blue-500 outline-none transition"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
          <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'create' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>Create Room</button>
          <button onClick={() => setActiveTab('join')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'join' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>Join Room</button>
        </div>

        {activeTab === 'create' ? (
           <div className="animate-fade-in space-y-4">
             {/* Map Size Selector */}
             <div>
               <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Map Size</label>
               {!isCustomSize ? (
                 <div className="flex gap-2">
                   {[20, 40, 60].map(size => (
                     <button key={size} onClick={() => setSelectedSize(size)} className={`flex-1 py-2 rounded-lg font-bold text-sm border ${selectedSize === size ? "bg-blue-600 border-blue-400 text-white" : "bg-slate-900 border-slate-700 text-gray-500"}`}>{size}x{size}</button>
                   ))}
                   <button onClick={() => setIsCustomSize(true)} className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border border-slate-700 text-gray-400">Custom</button>
                 </div>
               ) : (
                 <div className="flex gap-2">
                    <input type="number" min="10" max="200" value={selectedSize} onChange={(e) => setSelectedSize(Number(e.target.value))} className="flex-1 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-center font-mono" />
                    <button onClick={() => setIsCustomSize(false)} className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-700 text-gray-300">Presets</button>
                 </div>
               )}
             </div>

             {/* Private Room Toggle */}
             <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                   <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                   <span className="text-sm font-bold text-gray-300">Private Room</span>
                </label>
                {isPrivate && (
                   <input type="text" placeholder="Set password..." className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm" value={password} onChange={e => setPassword(e.target.value)} />
                )}
             </div>

             <button onClick={handleCreate} disabled={!isConnected} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg active:scale-95 disabled:opacity-50">Create New Game</button>
           </div>
        ) : (
           <div className="animate-fade-in space-y-4">
             <div>
               <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Room ID</label>
               <input type="text" placeholder="e.g. AX5B" className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white text-center tracking-widest uppercase font-mono" value={roomIdToJoin} onChange={e => setRoomIdToJoin(e.target.value.toUpperCase())} />
             </div>
             <div>
               <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Password (Optional)</label>
               <input type="password" placeholder="If private..." className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white" value={password} onChange={e => setPassword(e.target.value)} />
             </div>
             <button onClick={handleJoin} disabled={!isConnected} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition shadow-lg active:scale-95 disabled:opacity-50">Join Game</button>
           </div>
        )}
    </div>
  );
};