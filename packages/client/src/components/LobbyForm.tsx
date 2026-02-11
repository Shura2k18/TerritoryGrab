import { useState, useEffect } from 'react';
import { socket } from '../socket';
import type { CreateRoomDto, JoinRoomDto, RoomSummary } from '@territory/shared';

interface LobbyFormProps {
  isConnected: boolean;
  username: string;
  setUsername: (name: string) => void;
  onError: (msg: string) => void;
}

export const LobbyForm = ({ isConnected, username, setUsername, onError }: LobbyFormProps) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  
  // Create settings
  const [selectedSize, setSelectedSize] = useState(20);
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  // List of rooms
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  // Слухаємо список кімнат
  useEffect(() => {
      const savedNick = localStorage.getItem('territory_username');
      if (savedNick) setUsername(savedNick);

      socket.on('roomsList', setRooms);
      socket.emit('getRooms');
      return () => { socket.off('roomsList'); };
  }, []);

  const saveNick = () => {
      if(username) localStorage.setItem('territory_username', username);
  };

  const handleCreate = () => {
    if (!username) return onError("Enter name");
    saveNick(); // <--- Зберігаємо
    
    const payload: CreateRoomDto = {
      username,
      settings: { maxPlayers: 4, boardSize: selectedSize, isPrivate, password: isPrivate ? password : undefined }
    };
    socket.emit('createGame', payload);
  };

  const handleJoin = (id?: string) => {
    const targetId = id || roomIdToJoin;
    if (!username || !targetId) return onError("Enter name & ID");
    saveNick(); // <--- Зберігаємо

    const payload: JoinRoomDto = { roomId: targetId, username, password };
    socket.emit('joinGame', payload);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden flex flex-col">
        
        {/* Header Section */}
        <div className="flex-shrink-0">
            <div className="mb-4 flex items-center justify-between text-xs uppercase font-bold tracking-wider">
                <span className="text-gray-500">Server Status</span>
                <span className={isConnected ? "text-green-400" : "text-red-500"}>
                {isConnected ? '● Online' : '○ Offline'}
                </span>
            </div>

            <div className="mb-4">
                <label className="block text-xs font-bold mb-1 text-gray-400 uppercase">Your Nickname</label>
                <input 
                    type="text" 
                    placeholder="Enter name..."
                    className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:border-blue-500 outline-none transition"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                />
            </div>

            <div className="flex bg-slate-900 rounded-lg p-1 mb-4">
                <button onClick={() => setActiveTab('create')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'create' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>Create Room</button>
                <button onClick={() => setActiveTab('join')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'join' ? 'bg-slate-700 text-white' : 'text-gray-500'}`}>Join Room</button>
            </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
            {activeTab === 'create' ? (
                <div className="animate-fade-in space-y-4 pb-2">
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

                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="w-4 h-4 rounded accent-blue-500" />
                        <span className="text-sm font-bold text-gray-300">Private Room</span>
                        </label>
                        {isPrivate && (
                        <input type="text" placeholder="Set password..." className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm mt-1" value={password} onChange={e => setPassword(e.target.value)} />
                        )}
                    </div>

                    <button onClick={handleCreate} disabled={!isConnected} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg active:scale-95 disabled:opacity-50">Create New Game</button>
                </div>
            ) : (
                <div className="animate-fade-in pb-2">
                    {/* Manual Join Section */}
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-3">Join Private / By ID</h3>
                        <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="ROOM ID" className="flex-1 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-center uppercase" value={roomIdToJoin} onChange={e => setRoomIdToJoin(e.target.value.toUpperCase())} />
                            <button onClick={() => handleJoin()} disabled={!isConnected} className="px-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition text-sm">JOIN</button>
                        </div>
                        <input type="password" placeholder="Password (if required)" className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>

                    {/* Available Rooms List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Public Rooms ({rooms.length})</h3>
                            <button onClick={() => socket.emit('getRooms')} className="text-xs text-blue-400 hover:text-white">Refresh ⟳</button>
                        </div>
                        
                        <div className="space-y-2">
                            {rooms.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-slate-700 rounded-xl">
                                    No public rooms found.<br/>Be the first to create one!
                                </div>
                            ) : (
                                rooms.map(room => (
                                    <div key={room.id} className="bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl p-3 flex items-center justify-between transition group">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-white">{room.hostName}'s Game</span>
                                                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-gray-400 font-mono">#{room.id}</span>
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1 flex gap-3">
                                                <span>Size: {room.boardSize}x{room.boardSize}</span>
                                                <span>Players: {room.currentPlayers}/{room.maxPlayers}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleJoin(room.id)}
                                            className="px-4 py-2 bg-blue-600 group-hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition shadow-lg active:scale-95"
                                        >
                                            JOIN
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};