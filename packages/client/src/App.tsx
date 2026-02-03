import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import './App.css';

// Підключаємося до бекенду (за замовчуванням Nest слухає 3000)
const socket: Socket = io('http://localhost:3000', {
  autoConnect: false // Щоб ми могли контролювати момент підключення
});

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState<string>('');

  useEffect(() => {
    // 1. Встановлюємо слухачів подій
    function onConnect() {
      setIsConnected(true);
      console.log("Connected to server!");
    }

    function onDisconnect() {
      setIsConnected(false);
      console.log("Disconnected form server");
    }

    function onMessage(value: string) {
      setLastMessage(value);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message', onMessage); // Слухаємо подію, яку ми створили в Gateway

    // 2. Підключаємося
    socket.connect();

    // 3. Прибирання (cleanup) при закритті компонента
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message', onMessage);
      socket.disconnect();
    };
  }, []);

  const sendPing = () => {
    socket.emit('ping', 'Hello Server!');
  };

  return (
    <div className="card">
      <h1>Territory Game</h1>
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <p>Status: <strong>{isConnected ? '🟢 Connected' : '🔴 Disconnected'}</strong></p>
        <p>Server says: {lastMessage || '...'}</p>
        <button onClick={sendPing} disabled={!isConnected}>
          Send Ping
        </button>
      </div>
    </div>
  );
}

export default App;