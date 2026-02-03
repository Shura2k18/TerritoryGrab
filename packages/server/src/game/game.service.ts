// game/game.service.ts
import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { Room, Player, GameSettings, CreateRoomDto } from '@territory/shared';
import { v4 as uuidv4 } from 'uuid'; // npm install uuid, або просто Math.random()

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();

  createRoom(client: Socket, dto: CreateRoomDto): Room {
    const roomId = uuidv4().slice(0, 6).toUpperCase();

    const newRoom: Room = {
      id: roomId,
      hostId: client.id,
      settings: dto.settings, // Використовуємо налаштування з DTO
      players: [{
        id: client.id,
        username: dto.username,
        isReady: false,
        color: 'red' // Можна задати дефолтний колір
      }],
      status: 'lobby',
      currentTurnIndex: 0
    };

    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  joinRoom(client: Socket, roomId: string, username: string, password?: string): Room {
    const room = this.rooms.get(roomId);

    if (!room) throw new Error('Кімнату не знайдено');
    // ... валідація ...
    if (room.settings.isPrivate && room.settings.password !== password) {
       throw new Error('Невірний пароль');
    }

    const newPlayer: Player = {
      id: client.id,
      username,
      isReady: false,
      color: 'blue' // Тут треба логіку видачі вільних кольорів
    };

    room.players.push(newPlayer);
    return room;
  }

  // Логіка старту "за згодою"
  toggleReady(clientId: string, roomId: string): { room: Room, shouldStart: boolean } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Кімнату не знайдено');

    const player = room.players.find(p => p.id === clientId);
    if (player) player.isReady = !player.isReady;

    // ПЕРЕВІРКА: Чи можна починати гру?
    // 1. Мінімум 2 гравці
    // 2. Всі поточні гравці натиснули Ready
    const minPlayers = 2;
    const allReady = room.players.every(p => p.isReady);
    const enoughPlayers = room.players.length >= minPlayers;

    const shouldStart = allReady && enoughPlayers;
    
    if (shouldStart) {
      this.startGame(room);
    }

    return { room, shouldStart };
  }

  private startGame(room: Room) {
    room.status = 'playing';
    // Генеруємо пусте поле на основі налаштувань (size)
    const size = room.settings.boardSize;
    // Створюємо матрицю size x size, заповнену нулями
    room.board = Array(size).fill(null).map(() => Array(size).fill(0));
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }
  
  // Метод для отримання списку публічних кімнат
  getPublicRooms() {
      // Конвертуємо Map у масив і фільтруємо
      return Array.from(this.rooms.values())
          .filter(room => !room.settings.isPrivate && room.status === 'lobby');
  }
}