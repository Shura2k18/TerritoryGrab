import { io, Socket } from 'socket.io-client';

// URL бекенду (ми домовились, що це 5000)
const SERVER_URL = 'https://w8dftp18-5000.euw.devtunnels.ms/';

// Створюємо один екземпляр на весь додаток
export const socket: Socket = io(SERVER_URL, {
  autoConnect: false, // Щоб не коннектився сам, поки ми не скажемо (опціонально)
});

// Для дебагу: щоб бачити в консолі браузера всі події
socket.onAny((event, ...args) => {
  console.log(`[SOCKET] ${event}`, args);
});