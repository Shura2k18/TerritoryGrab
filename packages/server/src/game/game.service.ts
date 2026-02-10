import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Room, CreateRoomDto, MakeMoveDto, PLAYER_COLORS } from '@territory/shared';

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();

  createRoom(client: Socket, dto: CreateRoomDto): Room {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    
    let size = dto.settings.boardSize;
    if (size < 10) size = 10;
    if (size > 200) size = 200;

    const initialBoard = Array(size).fill(null).map(() => Array(size).fill(null));

    const newRoom: Room = {
      id: roomId,
      hostId: client.id,
      // settings: { ...dto.settings, boardSize: size },
      settings: {
        maxPlayers: 4,
        boardSize: size,
        isPrivate: dto.settings.isPrivate || false,
        password: dto.settings.password
      },
      players: [{
        id: client.id,
        username: dto.username,
        isReady: false,
        color: PLAYER_COLORS[0],
        wantsRematch: false
      }],
      status: 'lobby',
      currentTurnIndex: 0,
      board: initialBoard,
      consecutiveSkips: 0 // Починаємо з 0
    };

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
    const colorIndex = room.players.length % PLAYER_COLORS.length;
    room.players.push({
      id: client.id,
      username,
      isReady: false,
      color: PLAYER_COLORS[colorIndex]
    });
    return room;
  }

  // --- ХІД ГРАВЦЯ ---
  makeMove(clientId: string, dto: MakeMoveDto): Room {
    const room = this.rooms.get(dto.roomId);
    
    if (!room) throw new Error('Room not found');
    if (!room.board) throw new Error('Board not initialized');
    const playerIndex = room.players.findIndex(p => p.id === clientId);
    if (playerIndex !== room.currentTurnIndex) throw new Error('Not your turn');

    for (let r = 0; r < dto.h; r++) {
      for (let c = 0; c < dto.w; c++) {
        if (room.board[dto.y + r] !== undefined) {
           room.board[dto.y + r][dto.x + c] = clientId;
        }
      }
    }
    room.consecutiveSkips = 0;

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    return room;
  }

  toggleReady(clientId: string, roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.id === clientId);
    if (!player) throw new Error('Player not found');

    player.isReady = !player.isReady;
    
    // Автостарт прибрано!
    return room;
  }

  startGame(clientId: string, roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    // Перевірка: чи це Хост?
    if (room.hostId !== clientId) {
      throw new Error('Only the host can start the game');
    }

    // Перевірка: чи достатньо гравців (мін 2)
    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Перевірка: чи всі готові?
    const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
      throw new Error('All players must be Ready');
    }

    room.status = 'playing';
    console.log(`[START] Room ${roomId} started by Host`);
    return room;
  }

  skipTurn(clientId: string, roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Error');
    
    const idx = room.players.findIndex(p => p.id === clientId);
    if (idx !== room.currentTurnIndex) throw new Error('Not turn');

    // ЗБІЛЬШУЄМО ЛІЧИЛЬНИК
    room.consecutiveSkips++;
    console.log(`[SKIP] Skips: ${room.consecutiveSkips}/${room.players.length * 3}`);

    // ПЕРЕВІРКА НА КІНЕЦЬ ГРИ
    if (room.consecutiveSkips >= room.players.length * 3) {
       room.status = 'finished';
       console.log(`[GAME OVER] Room ${roomId}`);
    } else {
       // Передаємо хід далі
       room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
    }

    return room;
  }

  voteRematch(clientId: string, roomId: string): Room {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Error');

    const player = room.players.find(p => p.id === clientId);
    if (player) player.wantsRematch = true;

    // Перевіряємо, чи всі хочуть реванш
    const allWantRematch = room.players.every(p => p.wantsRematch);

    if (allWantRematch) {
      // РЕСТАРТ ГРИ
      const size = room.settings.boardSize;
      room.board = Array(size).fill(null).map(() => Array(size).fill(null)); // Очищаємо поле
      room.status = 'playing';
      room.currentTurnIndex = 0;
      room.consecutiveSkips = 0;
      
      // Скидаємо голоси
      room.players.forEach(p => {
        p.wantsRematch = false;
        p.isReady = true; // Вони вже готові
      });
      
      console.log(`[RESTART] Room ${roomId}`);
    }

    return room;
  }

  // --- ЛОГІКА ВИХОДУ ---
  leaveRoom(clientId: string, roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Видаляємо гравця
    room.players = room.players.filter(p => p.id !== clientId);

    // Якщо нікого не залишилось - видаляємо кімнату
    if (room.players.length === 0) {
       this.rooms.delete(roomId);
       return null; // Кімната знищена
    }

    // Якщо вийшов ХОСТ -> передаємо права наступному
    if (room.hostId === clientId) {
       room.hostId = room.players[0].id; // Новий хост - перший у списку
       console.log(`[HOST CHANGED] New host for ${roomId} is ${room.players[0].username}`);
    }

    // Якщо гра йшла - можна її зупинити або продовжити (для MVP краще скинути в лобі)
    if (room.status === 'playing' && room.players.length < 2) {
       room.status = 'finished'; // Або 'lobby'
    }

    return room;
  }

  // --- ЛОГІКА КІКУ ---
  kickPlayer(hostId: string, roomId: string, targetId: string): Room {
     const room = this.rooms.get(roomId);
     if (!room) throw new Error('Room not found');

     // Перевірка прав (тільки хост може кікати)
     if (room.hostId !== hostId) {
        throw new Error('Only host can kick players');
     }

     // Не можна кікнути самого себе
     if (hostId === targetId) {
        throw new Error("Cannot kick yourself");
     }

     // Видаляємо гравця
     room.players = room.players.filter(p => p.id !== targetId);
     
     // Скидаємо готовність інших, щоб випадково не почати гру
     room.players.forEach(p => p.isReady = false);

     return room;
  }
}