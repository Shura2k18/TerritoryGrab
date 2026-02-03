import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer 
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io'; // Перевір імпорт Server
import { GameService } from './game.service';
import type { CreateRoomDto, JoinRoomDto } from '@territory/shared';

@WebSocketGateway({ cors: true })
export class GameGateway {
  // 1. ВИПРАВЛЕННЯ: Додаємо декоратор сервера, щоб мати доступ до this.server
  @WebSocketServer()
  server: Server;

  constructor(private readonly gameService: GameService) {}

  @SubscribeMessage('createGame')
  handleCreateGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomDto
  ) {
    try {
      const room = this.gameService.createRoom(client, payload);
      
      // 2. ВИПРАВЛЕННЯ: Автор теж має фізично вступити в кімнату сокетів
      client.join(room.id);
      
      client.emit('roomCreated', room);
    } catch (e) {
      client.emit('error', e.message);
    }
  }

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomDto
  ) {
    try {
      // 3. ВИПРАВЛЕННЯ: Обгортаємо в try/catch, бо joinRoom може викинути помилку (пароль, місця)
      const room = this.gameService.joinRoom(client, payload.roomId, payload.username, payload.password);
      
      client.join(room.id);
      
      client.emit('joinedRoom', room);
      // Краще відправляти повний 'roomUpdate' замість окремого 'playerJoined', 
      // щоб стан на фронті був синхронізований
      client.to(room.id).emit('roomUpdate', room); 
    } catch (e) {
      client.emit('error', e.message);
    }
  }

  @SubscribeMessage('playerReady')
  handlePlayerReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    try {
      const { room, shouldStart } = this.gameService.toggleReady(client.id, data.roomId);
      
      // Тепер this.server існує і працює
      this.server.to(room.id).emit('roomUpdate', room);

      if (shouldStart) {
        this.server.to(room.id).emit('gameStarted', { 
            boardSize: room.settings.boardSize,
            players: room.players 
        });
      }
    } catch (e) {
      client.emit('error', e.message);
    }
  }
}