import { useState, useEffect } from 'react';
import { socket } from './socket';
import { GameRoom } from './components/GameRoom';
import { LobbyForm } from './components/LobbyForm';
import type { Room } from '@territory/shared';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();
    
    // Обробники подій
    const onConnect = () => { setIsConnected(true); setError(null); };
    const onDisconnect = () => setIsConnected(false);
    const onRoomEnter = (room: Room) => { setCurrentRoom(room); setError(null); };
    const onLeft = () => setCurrentRoom(null);
    const onKicked = (msg: string) => { alert(msg); setCurrentRoom(null); };
    const onError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 3000); };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomEnter);
    socket.on('joinedRoom', onRoomEnter);
    socket.on('leftRoom', onLeft);
    socket.on('kicked', onKicked);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('roomCreated', onRoomEnter);
      socket.off('joinedRoom', onRoomEnter);
      socket.off('leftRoom', onLeft);
      socket.off('kicked', onKicked);
      socket.on('error', onError);
    };
  }, []);

  const handleLeave = () => {
      if (currentRoom) socket.emit('leaveRoom', { roomId: currentRoom.id });
  };

  if (currentRoom) {
    return <GameRoom room={currentRoom} onLeave={handleLeave} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <h1 className="text-5xl font-bold mb-2 text-blue-500 tracking-widest">TERRITORY</h1>
      <p className="text-gray-500 mb-8">MULTIPLAYER STRATEGY</p>
      
      {error && (
          <div className="fixed top-0 left-0 w-full bg-red-500 text-white text-center py-2 text-sm font-bold animate-pulse z-50">
            {error}
          </div>
      )}

      <LobbyForm 
         isConnected={isConnected} 
         username={username} 
         setUsername={setUsername} 
         onError={setError} 
      />
      
      <div className="mt-8 text-slate-600 text-xs">v0.3.0 Release</div>
    </div>
  );
}

export default App;