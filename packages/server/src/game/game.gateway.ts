import { 
  WebSocketGateway, 
  SubscribeMessage, 
  MessageBody, 
  ConnectedSocket, 
  WebSocketServer,
  OnGatewayConnection
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import type { CreateRoomDto, JoinRoomDto, MakeMoveDto } from '@territory/shared';

@WebSocketGateway({ cors: { origin: '*' } }) // Додав CORS на всяк випадок явно
export class GameGateway {
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
      client.join(room.id);
      
      // Відправляємо подію roomCreated автору (щоб він перейшов на екран гри)
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
      const room = this.gameService.joinRoom(client, payload.roomId, payload.username, payload.password);
      client.join(room.id);
      
      // ВАЖЛИВО:
      // 1. Сповіщаємо того, хто зайшов, щоб у нього відкрилась гра
      client.emit('joinedRoom', room);
      
      // 2. Сповіщаємо ВСІХ у кімнаті (включно з новим гравцем) про новий стан
      // Використовуємо 'gameUpdated', бо GameRoom слухає саме його
      this.server.to(room.id).emit('gameUpdated', room);
      
    } catch (e) {
      client.emit('error', e.message);
    }
  }

  @SubscribeMessage('makeMove')
  handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MakeMoveDto
  ) {
    try {
      const updatedRoom = this.gameService.makeMove(client.id, payload);
      
      // Розсилаємо всім новий стан (і перехід ходу)
      this.server.to(updatedRoom.id).emit('gameUpdated', updatedRoom);
      
    } catch (e) {
      console.error(e); // Логуємо помилку на сервері
      client.emit('error', e.message);
    }
  }

  @SubscribeMessage('toggleReady')
  handleToggleReady(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }) {
    try {
      const room = this.gameService.toggleReady(client.id, payload.roomId);
      this.server.to(room.id).emit('gameUpdated', room);
    } catch (e) { client.emit('error', e.message); }
  }

  @SubscribeMessage('skipTurn')
  handleSkipTurn(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }) {
    try {
      const room = this.gameService.skipTurn(client.id, payload.roomId);
      this.server.to(room.id).emit('gameUpdated', room);
    } catch (e) { client.emit('error', e.message); }
  }

  @SubscribeMessage('startGame')
  handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }) {
    try {
      const room = this.gameService.startGame(client.id, payload.roomId);
      this.server.to(room.id).emit('gameUpdated', room);
    } catch (e) {
      client.emit('error', e.message);
    }
  }

  @SubscribeMessage('voteRematch')
  handleVoteRematch(@ConnectedSocket() client: Socket, @MessageBody() payload: { roomId: string }) {
    try {
      const room = this.gameService.voteRematch(client.id, payload.roomId);
      this.server.to(room.id).emit('gameUpdated', room);
    } catch (e) { client.emit('error', e.message); }
  }
}