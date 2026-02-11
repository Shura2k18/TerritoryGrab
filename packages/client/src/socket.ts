import { io, Socket } from 'socket.io-client';

// URL бекенду (ми домовились, що це 5000)
const URL = import.meta.env.MODE === 'production' 
  ? undefined 
  : 'http://localhost:5000'; 
// Або просто: const URL = undefined; (якщо ти завжди запускаєш через сервер)

export const socket: Socket = io(URL, {
  autoConnect: false,
  path: '/socket.io',
  transports: ['websocket', 'polling'] 
});

// Для дебагу: щоб бачити в консолі браузера всі події
socket.onAny((event, ...args) => {
  console.log(`[SOCKET] ${event}`, args);
});