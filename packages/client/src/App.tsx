import { useState, useEffect } from 'react';
import { socket } from './socket';
import { GameRoom } from './components/GameRoom';
import { LobbyForm } from './components/LobbyForm';
import type { Room, ReconnectDto } from '@territory/shared';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();
    
    // --- АВТОМАТИЧНИЙ РЕКОНЕКТ ---
    const savedRoomId = localStorage.getItem('territory_roomId');
    const savedPlayerId = localStorage.getItem('territory_playerId');
    
    // Якщо є збережена сесія - пробуємо відновитись
    if (savedRoomId && savedPlayerId) {
        console.log("Attempting reconnect...");
        // Невелика затримка, щоб сокет встиг з'єднатись
        setTimeout(() => {
            if (socket.connected) {
                socket.emit('reconnect', { roomId: savedRoomId, playerId: savedPlayerId } as ReconnectDto);
            }
        }, 500);
    }

    const onConnect = () => { 
        setIsConnected(true); 
        setError(null);
        // Повторна спроба реконекту при connect, якщо перша не пройшла
        if (savedRoomId && savedPlayerId) {
             socket.emit('reconnect', { roomId: savedRoomId, playerId: savedPlayerId });
        }
    };
    const onDisconnect = () => setIsConnected(false);
    
    const onRoomEnter = (room: Room) => { 
        console.log('Entered room:', room);
        setCurrentRoom(room);
        setError(null);
        
        // ЗБЕРІГАЄМО СЕСІЮ
        // Шукаємо себе за socket.id, щоб дізнатись свій стійкий UUID
        const me = room.players.find(p => p.socketId === socket.id);
        if (me) {
            localStorage.setItem('territory_roomId', room.id);
            localStorage.setItem('territory_playerId', me.id);
            // Оновлюємо нік, якщо він прийшов з сервера (на випадок реконекту)
            setUsername(me.username);
            localStorage.setItem('territory_username', me.username);
        }
    };

    const onLeft = () => {
        setCurrentRoom(null);
        // Чистимо сесію
        localStorage.removeItem('territory_roomId');
        localStorage.removeItem('territory_playerId');
    };
    
    const onSessionExpired = () => {
        setError("Session expired");
        onLeft();
    };

    const onKicked = (msg: string) => { alert(msg); onLeft(); };
    const onError = (msg: string) => { 
        // Ігноруємо помилки "Room expired" при авто-реконекті, щоб не лякати юзера
        if (msg === 'Room expired' || msg === 'Player not found') {
            onLeft(); // Просто скидаємо сесію
        } else {
            setError(msg); 
            setTimeout(() => setError(null), 3000); 
        }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('roomCreated', onRoomEnter);
    socket.on('joinedRoom', onRoomEnter); // Спрацьовує і при reconnect
    socket.on('leftRoom', onLeft);
    socket.on('sessionExpired', onSessionExpired);
    socket.on('kicked', onKicked);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      // ... off all ...
      socket.off('error', onError);
    };
  }, []);

  const handleLeave = () => {
      if (currentRoom) socket.emit('leaveRoom', { roomId: currentRoom.id });
  };

  if (currentRoom) {
    return <GameRoom room={currentRoom} onLeave={handleLeave} />;
  }

  return (
    <ErrorBoundary>
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
      </div>
    </ErrorBoundary>
  );
}

export default App;