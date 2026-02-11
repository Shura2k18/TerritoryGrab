import { WsException } from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Room, CreateRoomDto, MakeMoveDto, PLAYER_COLORS, RoomSummary, ReconnectDto, ChatMessage, SendMessageDto } from '@territory/shared';

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  private addMessage(room: Room, senderId: string, senderName: string, text: string, color: string, isSystem = false) {
      const msg: ChatMessage = {
          id: uuidv4(),
          senderId,
          senderName,
          text,
          color,
          timestamp: Date.now(),
          isSystem
      };
      
      if (!room.chatHistory) room.chatHistory = [];
      room.chatHistory.push(msg);
      
      // Обмежуємо історію (наприклад, останні 50 повідомлень)
      if (room.chatHistory.length > 50) room.chatHistory.shift();
      
      return msg; // Повертаємо саме повідомлення, щоб розіслати тільки його (оптимізація), або можна слати всю кімнату
  }

  createRoom(client: Socket, dto: CreateRoomDto): Room {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    const playerId = uuidv4();
    
    let size = dto.settings.boardSize;
    if (size < 10) size = 10;
    if (size > 200) size = 200;

    const initialBoard = Array(size).fill(null).map(() => Array(size).fill(null));

    const newRoom: Room = {
      id: roomId,
      hostId: playerId,
      // settings: { ...dto.settings, boardSize: size },
      settings: {
        maxPlayers: 4,
        boardSize: size,
        isPrivate: dto.settings.isPrivate || false,
        password: dto.settings.password,
        mode: dto.settings.mode || 'classic',
      },
      players: [{
        id: playerId,
        socketId: client.id,
        username: dto.username,
        isReady: false,
        color: PLAYER_COLORS[0],
        wantsRematch: false,
        isOnline: true
      }],
      status: 'lobby',
      currentTurnIndex: 0,
      board: initialBoard,
      consecutiveSkips: 0,
      chatHistory: []
    };
    this.addMessage(newRoom, 'system', 'System', `Room created by ${dto.username}`, '#9ca3af', true);
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  // --- ПРИЄДНАННЯ ---
  joinRoom(client: Socket, roomId: string, username: string, password?: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.status !== 'lobby') throw new Error('Game already started');
    if (room.players.length >= room.settings.maxPlayers) throw new Error('Room full');
    if (room.settings.isPrivate) {
       if (room.settings.password !== password) {
          throw new Error('Invalid password'); // Невірний пароль
       }
    }
    const playerId = uuidv4();
    const colorIndex = room.players.length % PLAYER_COLORS.length;
    room.players.push({
      id: playerId,
      socketId: client.id,
      username,
      isReady: false,
      color: PLAYER_COLORS[colorIndex],
      wantsRematch: false,
      isOnline: true
    });
    this.addMessage(room, 'system', 'System', `${username} joined the game`, '#22c55e', true);
    return room;
  }

  reconnect(client: Socket, dto: ReconnectDto): Room {
    const room = this.rooms.get(dto.roomId);
    if (!room) throw new Error('Room expired');

    const player = room.players.find(p => p.id === dto.playerId);
    if (!player) throw new Error('Player not found');

    // Скасовуємо таймер видалення, бо гравець повернувся
    const timerKey = `${dto.roomId}_${dto.playerId}`;
    if (this.disconnectTimers.has(timerKey)) {
        clearTimeout(this.disconnectTimers.get(timerKey));
        this.disconnectTimers.delete(timerKey);
        console.log(`[RECONNECT] Player ${player.username} restored`);
    }

    // Оновлюємо сокет і статус
    player.socketId = client.id;
    player.isOnline = true;
    
    return room;
    
  }

  handleDisconnect(client: Socket): { roomId: string, room: Room } | null {
    for (const [roomId, room] of this.rooms) {
        // Шукаємо гравця за старим сокетом
        const player = room.players.find(p => p.socketId === client.id);
        if (player) {
            player.isOnline = false; // Ставимо офлайн
            
            // Запускаємо таймер на 60 сек
            const timer = setTimeout(() => this.finalizeDisconnect(roomId, player.id), 60000);
            this.disconnectTimers.set(`${roomId}_${player.id}`, timer);
            
            console.log(`[DISCONNECT] ${player.username} (waiting 60s)`);
            return { roomId, room };
        }
    }
    return null;
  }
  

  private finalizeDisconnect(roomId: string, playerId: string) {
      const room = this.rooms.get(roomId);
      if (!room) return;
      
      console.log(`[TIMEOUT] Removing player ${playerId}`);
      room.players = room.players.filter(p => p.id !== playerId);
      this.disconnectTimers.delete(`${roomId}_${playerId}`);

      if (room.players.length === 0) {
          this.rooms.delete(roomId);
      } else {
          // Якщо пішов хост, передаємо права
          if (room.hostId === playerId) room.hostId = room.players[0].id;
      }
  }

  private finishGame(room: Room): Room {
    room.status = 'finished';
    if (!room.board) return room;

    // 1. Рахуємо бали
    const scores: Record<string, number> = {};
    room.players.forEach(p => scores[p.id] = 0);
    room.board.forEach(row => row.forEach(cell => {
        if (cell) scores[cell] = (scores[cell] || 0) + 1;
    }));

    // 2. Визначаємо переможця
    let maxScore = -1;
    let winnerId: string | null = null;
    Object.entries(scores).forEach(([pid, score]) => {
        if (score > maxScore) { maxScore = score; winnerId = pid; }
        else if (score === maxScore) { winnerId = 'draw'; }
    });
    
    room.winnerId = winnerId || undefined;

    // 3. ЗАПИСУЄМО РЕЗУЛЬТАТ (Щоб він зберігся після виходу гравців)
    room.gameResult = {
        winnerId: winnerId,
        players: room.players.map(p => ({
            id: p.id,
            username: p.username,
            color: p.color,
            score: scores[p.id] || 0
        }))
    };

    return room;
  }

  // --- ХІД ГРАВЦЯ ---
  makeMove(clientSocketId: string, dto: MakeMoveDto): Room {
    const room = this.rooms.get(dto.roomId);
    if (!room || !room.board) throw new Error('Error');
    
    const player = room.players.find(p => p.socketId === clientSocketId);
    if (!player) throw new Error('Player not found');

    const playerIndex = room.players.findIndex(p => p.id === player.id);
    if (playerIndex !== room.currentTurnIndex) throw new Error('Not your turn');

    for (let r = 0; r < dto.h; r++) {
      for (let c = 0; c < dto.w; c++) {
        if (room.board[dto.y + r] !== undefined) {
           room.board[dto.y + r][dto.x + c] = player.id;
        }
      }
    }

    if (room.settings.mode === 'fast') {
        const capturedCount = this.processTerritoryCapture(room);
        if (capturedCount > 0) {
            console.log(`[CAPTURE] Player ${player.username} captured ${capturedCount} cells!`);
        }
    }
    room.consecutiveSkips = 0;
    
    const isBoardFull = room.board.every(row => row.every(cell => cell !== null));
    
    if (isBoardFull) {
        return this.finishGame(room);
    }
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    return room;
  }

  // --- АЛГОРИТМ ЗАХОПЛЕННЯ ТЕРИТОРІЇ (FLOOD FILL) ---
  private processTerritoryCapture(room: Room): number {
      if (!room.board) return 0;
      const board = room.board;
      const size = room.settings.boardSize;
      
      const visited = Array(size).fill(false).map(() => Array(size).fill(false));
      let totalCaptured = 0;

      const getNeighbors = (r: number, c: number): [number, number][] => {
          const n: [number, number][] = [];
          if (r > 0) n.push([r - 1, c]);
          if (r < size - 1) n.push([r + 1, c]);
          if (c > 0) n.push([r, c - 1]);
          if (c < size - 1) n.push([r, c + 1]);
          return n;
      };

      for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
              if (board[y][x] === null && !visited[y][x]) {
                  
                  const queue: [number, number][] = [[y, x]];
                  visited[y][x] = true;
                  
                  const regionCells: [number, number][] = [[y, x]]; 
                  const touchingPlayers = new Set<string>();
                  
                  // Відстежуємо, яких стін торкається цей регіон
                  const borders = { top: false, bottom: false, left: false, right: false };

                  const checkBorders = (r: number, c: number) => {
                      if (r === 0) borders.top = true;
                      if (r === size - 1) borders.bottom = true;
                      if (c === 0) borders.left = true;
                      if (c === size - 1) borders.right = true;
                  };
                  
                  // Перевіряємо стартову точку
                  checkBorders(y, x);

                  let head = 0;
                  while(head < queue.length){
                      const [curY, curX] = queue[head++];
                      
                      const neighbors = getNeighbors(curY, curX);
                      for (const [nY, nX] of neighbors) {
                          const cellVal = board[nY][nX];
                          
                          if (cellVal === null) {
                              if (!visited[nY][nX]) {
                                  visited[nY][nX] = true;
                                  queue.push([nY, nX]);
                                  regionCells.push([nY, nX]);
                                  checkBorders(nY, nX); // Перевіряємо межі для кожної клітинки
                              }
                          } else {
                              touchingPlayers.add(cellVal);
                          }
                      }
                  }

                  // ЛОГІКА ЗАХОПЛЕННЯ:
                  // 1. Регіон має бути оточений лише ОДНИМ гравцем (плюс стіни).
                  // 2. Регіон НЕ має простягатись на всю карту (від верху до низу АБО зліва направо).
                  //    Це захист від зафарбовування всього поля на першому ході.
                  
                  const spansVertical = borders.top && borders.bottom;
                  const spansHorizontal = borders.left && borders.right;
                  const isOcean = spansVertical || spansHorizontal;

                  if (touchingPlayers.size === 1 && !isOcean) {
                      const ownerId = touchingPlayers.values().next().value;
                      if (ownerId) {
                          for (const [r, c] of regionCells) {
                              board[r][c] = ownerId;
                              totalCaptured++;
                          }
                      }
                  }
              }
          }
      }
      return totalCaptured;
  }

  toggleReady(clientSocketId: string, roomId: string): Room {
      const room = this.rooms.get(roomId);
      if (!room) throw new Error('Room not found');
      
      // ШУКАЄМО ПО SOCKET ID
      const player = room.players.find(p => p.socketId === clientSocketId);
      if (!player) throw new Error('Player not found');

      player.isReady = !player.isReady;
      return room;
  }

  startGame(clientSocketId: string, roomId: string): Room {
    const room = this.rooms.get(roomId);

    if (!room) {
      throw new WsException('Room not found');
    }

    // 1. Знаходимо гравця, який натиснув кнопку
    const player = room.players.find(p => p.socketId === clientSocketId);
    if (!player) {
        throw new WsException('Player not found');
    }

    // 2. Перевіряємо права (чи це ХОСТ)
    // Порівнюємо ID гравця з ID хоста кімнати
    if (room.hostId !== player.id) {
      throw new WsException('Only host can start the game');
    }

    // 3. Перевірка кількості гравців
    if (room.players.length < 2) {
        throw new WsException('Need at least 2 players to start!');
    }

    // 4. Перевірка готовності (опціонально, якщо ти використовуєш кнопку Ready)
    /* const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
        throw new WsException('Not everyone is ready');
    }
    */

    // 5. Старт гри
    // Генеруємо чисту дошку
    const size = room.settings.boardSize;
    room.board = Array(size).fill(null).map(() => Array(size).fill(null));
    
    room.status = 'playing';
    room.currentTurnIndex = 0;
    room.consecutiveSkips = 0;
    
    // Очищаємо прапорці готовності та рематчу
    room.players.forEach(p => {
        p.isReady = false;
        p.wantsRematch = false;
    });

    this.addMessage(room, 'system', 'System', 'Game Started!', '#fbbf24', true);
    
    console.log(`[START] Room ${roomId} started by ${player.username}`);
    return room;
  }

  skipTurn(clientSocketId: string, roomId: string): Room {
      const room = this.rooms.get(roomId);
      if (!room) throw new Error('Room not found');

      const player = room.players.find(p => p.socketId === clientSocketId);
      if (!player) throw new Error('Player not found');
      
      // Перевіряємо індекс у масиві (він стабільний)
      const playerIndex = room.players.findIndex(p => p.id === player.id);
      if (playerIndex !== room.currentTurnIndex) throw new Error('Not your turn');
      
      room.consecutiveSkips++;
      const limit = room.players.length * 3;

    if (room.consecutiveSkips >= limit) {
        return this.finishGame(room); // <--- Використовуємо спільний метод
    }

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    return room;
  }

  voteRematch(clientSocketId: string, roomId: string): Room {
      const room = this.rooms.get(roomId);
      if (!room) throw new Error('Room not found');

      const player = room.players.find(p => p.socketId === clientSocketId);
      if (!player) throw new Error('Player not found');

      // --- НОВА ПЕРЕВІРКА ---
      // Не даємо голосувати, якщо в кімнаті залишився тільки один гравець
      if (room.players.length < 2) {
          // Можна кинути помилку, щоб клієнт показав alert
          throw new WsException('Need at least 2 players for a rematch!'); 
          // Або просто ігнорувати: return room;
      }
      // ----------------------

      player.wantsRematch = true;

      // Якщо всі проголосували - рестарт
      if (room.players.every(p => p.wantsRematch)) {
           // Ще одна перевірка на всяк випадок
           if (room.players.length < 2) return room; 

           const size = room.settings.boardSize;
           room.board = Array(size).fill(null).map(() => Array(size).fill(null));
           
           // ... (скидання гри) ...
           room.status = 'playing';
           room.currentTurnIndex = 0;
           room.consecutiveSkips = 0;
           room.winnerId = undefined; 
           room.gameResult = undefined; // Очищаємо результати попередньої гри

           room.players.forEach(p => { 
               p.wantsRematch = false; 
               p.isReady = true; 
           });
           
           this.addMessage(room, 'system', 'System', 'Game Restarted!', '#fbbf24', true);
           console.log(`[RESTART] Room ${roomId}`);
      }
      return room;
  }

  // --- ЛОГІКА ВИХОДУ ---
  leaveRoom(clientSocketId: string, roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
      
    const player = room.players.find(p => p.socketId === clientSocketId);
    if (!player) return null;

    // --- ВИПРАВЛЕННЯ ТУТ ---
    
    // 1. СПОЧАТКУ перевіряємо, чи треба завершити гру (поки гравець ще в списку!)
    // Якщо гра йде, ми повинні зарахувати поразку і зберегти результати ВСІХ гравців
    if (room.status === 'playing') {
        this.addMessage(room, 'system', 'System', `${player.username} left. Game Over!`, '#ef4444', true);
        
        // Викликаємо фініш. Він збереже ВСІХ поточних гравців (включно з тим, хто виходить) у gameResult
        this.finishGame(room);
        
        // Оскільки гра закінчена, статус вже 'finished'
    }

    // 2. ТЕПЕР видаляємо гравця з активного списку
    room.players = room.players.filter(p => p.id !== player.id);
    
    // 3. Чистимо таймери
    const timerKey = `${roomId}_${player.id}`;
    if (this.disconnectTimers.has(timerKey)) {
      clearTimeout(this.disconnectTimers.get(timerKey));
      this.disconnectTimers.delete(timerKey);
    }
    
    // 4. Якщо кімната пуста - видаляємо
    if (room.players.length === 0) {
        this.rooms.delete(roomId);
        return null;
    }

    // 5. Передача хоста (якщо треба)
    if (room.hostId === player.id) {
        room.hostId = room.players[0].id;
    }

    // Повідомлення про вихід (якщо це було лоббі або вже після гри)
    if (room.status !== 'finished') { 
         this.addMessage(room, 'system', 'System', `${player.username} left the game`, '#ef4444', true);
    }

    return room;
  }

  // --- ЛОГІКА КІКУ ---
  kickPlayer(hostSocketId: string, roomId: string, targetId: string): Room {
     const room = this.rooms.get(roomId);
     if (!room) throw new Error('Room not found');
     
     const host = room.players.find(p => p.socketId === hostSocketId);
     if (!host || room.hostId !== host.id) throw new Error('Only host can kick');
     if (host.id === targetId) throw new Error("Cannot kick yourself");

     room.players = room.players.filter(p => p.id !== targetId);
     room.players.forEach(p => p.isReady = false);
     return room;
  }

  getAvailableRooms(): RoomSummary[] {
    return Array.from(this.rooms.values())
      .filter(r => !r.settings.isPrivate && r.status === 'lobby' && r.players.length < r.settings.maxPlayers)
      .map(r => ({
        id: r.id,
        hostName: r.players.find(p => p.id === r.hostId)?.username || 'Unknown',
        currentPlayers: r.players.length,
        maxPlayers: r.settings.maxPlayers,
        boardSize: r.settings.boardSize,
        mode: r.settings.mode
      }));
  }
  sendMessage(clientSocketId: string, dto: SendMessageDto): Room {
      const room = this.rooms.get(dto.roomId);
      if (!room) throw new Error('Room not found');

      const player = room.players.find(p => p.socketId === clientSocketId);
      if (!player) throw new Error('Player not found');

      this.addMessage(room, player.id, player.username, dto.text, player.color);
      return room;
  }
}