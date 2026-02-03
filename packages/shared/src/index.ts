export const GAME_NAME = "Territory Grab";
// export interface Player {
//     id: string;
//     color: string;
// }

// export interface ClientToServerEvents {
//   joinGame: (roomId: string) => void;
//   rollDice: () => void;
//   // пізніше додамо moveFigure і т.д.
// }

// export interface ServerToClientEvents {
//   playerJoined: (playerId: string) => void;
//   diceRolled: (dice: [number, number]) => void;
// }

export type GameStatus = 'lobby' | 'playing' | 'finished';

export interface GameSettings {
  maxPlayers: number;    // 2, 3, 4
  boardSize: number;     // 10, 15, 20
  isPrivate: boolean;
  password?: string;     // Опціонально, якщо isPrivate = true
}

export interface Player {
  id: string;       // socket.id
  username: string; 
  isReady: boolean; // Статус "Готовий"
  color?: string;   // Колір для UI
}

export interface Room {
  id: string;
  hostId: string;
  settings: GameSettings; // Наші нові налаштування
  players: Player[];
  status: GameStatus;
  currentTurnIndex: number;
  board?: number[][];     // Стан поля (додаємо, коли гра почалась)
}

// DTO для створення кімнати (те, що приходить з фронта)
export interface CreateRoomDto {
  username: string;
  settings: GameSettings;
}

// DTO для приєднання
export interface JoinRoomDto {
  roomId: string;
  username: string;
  password?: string;
}