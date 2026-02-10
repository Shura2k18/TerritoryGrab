import { useState, useEffect } from 'react';
import { socket } from './socket';
import { GameRoom } from './components/GameRoom';
import type { Room, CreateRoomDto, JoinRoomDto } from '@territory/shared';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Дані форми
  const [username, setUsername] = useState('');
  const [roomIdToJoin, setRoomIdToJoin] = useState('');
  const [selectedSize, setSelectedSize] = useState(20);
  const [isCustomSize, setIsCustomSize] = useState(false);
  
  // Стан інтерфейсу
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();

    function onConnect() { setIsConnected(true); setError(null); }
    function onDisconnect() { setIsConnected(false); }

    function onRoomCreated(room: Room) {
      console.log('Created room:', room);
      setCurrentRoom(room);
      setError(null);
    }

    function onJoinedRoom(room: Room) {
      console.log('Joined room:', room);
      setCurrentRoom(room);
      setError(null);
    }

    function onError(message: string) {
      setError(message);
      setTimeout(() => setError(null), 3000);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomCreated);
    socket.on('joinedRoom', onJoinedRoom);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomCreated);
      socket.off('joinedRoom', onJoinedRoom);
      socket.off('error', onError);
    };
  }, []);

  const handleCreateGame = () => {
    if (!username) return setError("Please enter your name");

    const payload: CreateRoomDto = {
      username,
      settings: {
        maxPlayers: 4,         // ДОЗВОЛЯЄМО 4 ГРАВЦІВ
        boardSize: selectedSize, // ВИБРАНИЙ РОЗМІР
        isPrivate: false
      }
    };
    socket.emit('createGame', payload);
  };

  const handleJoinGame = () => {
    if (!username) return setError("Please enter your name");
    if (!roomIdToJoin) return setError("Please enter Room ID");

    const payload: JoinRoomDto = {
      roomId: roomIdToJoin,
      username,
    };
    socket.emit('joinGame', payload);
  };

  // 1. ЕКРАН ГРИ / ЛОБІ
  if (currentRoom) {
    return <GameRoom room={currentRoom} />;
  }

  // 2. ЕКРАН ВХОДУ
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-5xl font-bold mb-2 text-blue-500 tracking-widest">TERRITORY</h1>
      <p className="text-gray-500 mb-8">MULTIPLAYER STRATEGY</p>
      
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
        
        {error && (
          <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-center py-2 text-sm font-bold animate-pulse">
            {error}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between text-xs uppercase font-bold tracking-wider">
            <span className="text-gray-500">Server Status</span>
            <span className={isConnected ? "text-green-400" : "text-red-500"}>
               {isConnected ? '● Online' : '○ Offline'}
            </span>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Your Nickname</label>
          <input 
            type="text" 
            placeholder="Enter name..."
            className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-500 transition shadow-inner"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        </div>

        <div className="flex bg-slate-900 rounded-lg p-1 mb-6">
          <button 
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'create' ? 'bg-slate-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Create Room
          </button>
          <button 
            onClick={() => setActiveTab('join')}
            className={`flex-1 py-2 text-sm font-bold rounded-md transition ${activeTab === 'join' ? 'bg-slate-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Join Room
          </button>
        </div>

        {activeTab === 'create' ? (
           <div className="animate-fade-in">
             {/* ВИБІР РОЗМІРУ */}
             <div className="mb-6">
               <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Map Size</label>
               
               {!isCustomSize ? (
                 <div className="flex gap-2 mb-2">
                   {[20, 40, 60].map(size => (
                     <button
                       key={size}
                       onClick={() => setSelectedSize(size)}
                       className={`flex-1 py-2 rounded-lg font-bold text-sm transition border ${
                         selectedSize === size 
                           ? "bg-blue-600 border-blue-400 text-white" 
                           : "bg-slate-900 border-slate-700 text-gray-500"
                       }`}
                     >
                       {size}x{size}
                     </button>
                   ))}
                   <button 
                     onClick={() => setIsCustomSize(true)}
                     className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-800 border border-slate-700 text-gray-400 hover:text-white"
                   >
                     Custom
                   </button>
                 </div>
               ) : (
                 <div className="flex gap-2 mb-2">
                    <input 
                      type="number" 
                      min="10" max="200"
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(Number(e.target.value))}
                      className="flex-1 p-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-center font-mono"
                    />
                    <button 
                      onClick={() => setIsCustomSize(false)}
                      className="px-4 py-2 rounded-lg font-bold text-sm bg-slate-700 text-gray-300"
                    >
                      Presets
                    </button>
                 </div>
               )}
               <p className="text-[10px] text-gray-500 text-right">Max: 200x200</p>
             </div>

             <button 
               onClick={handleCreateGame}
               disabled={!isConnected}
               className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Create New Game
             </button>
           </div>
        ) : (
           <div className="animate-fade-in">
             <div className="mb-4">
               <label className="block text-xs font-bold mb-2 text-gray-400 uppercase">Room ID</label>
               <input 
                 type="text" 
                 placeholder="e.g. AX5B"
                 className="w-full p-3 bg-slate-900 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-green-500 transition shadow-inner font-mono text-center tracking-widest uppercase"
                 value={roomIdToJoin}
                 onChange={e => setRoomIdToJoin(e.target.value.toUpperCase())}
               />
             </div>
             <button 
               onClick={handleJoinGame}
               disabled={!isConnected}
               className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Join Game
             </button>
           </div>
        )}

      </div>
      <div className="mt-8 text-slate-600 text-xs">v0.2.0 Beta</div>
    </div>
  );
}

export default App;