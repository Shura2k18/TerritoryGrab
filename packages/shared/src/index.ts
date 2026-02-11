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

export const PLAYER_COLORS = [
  '#3b82f6', // P1: Blue
  '#ef4444', // P2: Red
  '#22c55e', // P3: Green
  '#eab308', // P4: Yellow
];

// Можна також додати тип, щоб TS підказував кольори
export type PlayerColor = typeof PLAYER_COLORS[number];

export type GameStatus = 'lobby' | 'playing' | 'finished';

export type GameMode = 'classic' | 'fast';

export interface GameSettings {
  maxPlayers: number;    // 2, 3, 4
  boardSize: number;     // 10, 15, 20
  isPrivate: boolean;
  password?: string;
  mode: GameMode;
}

export interface Player {
  id: string;
  socketId: string;
  username: string;
  isReady: boolean;
  color: string;
  wantsRematch?: boolean;
  isOnline: boolean;
}

export interface Room {
  id: string;
  hostId: string;
  settings: GameSettings; // Наші нові налаштування
  players: Player[];
  status: GameStatus;
  currentTurnIndex: number;
  board?: (string | null)[][];
  consecutiveSkips: number;
}
export interface ToggleReadyDto {
  roomId: string;
}

// Додаємо подію для пропуску ходу
export interface SkipTurnDto {
  roomId: string;
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

export interface LeaveRoomDto {
  roomId: string;
}

export interface KickPlayerDto {
  roomId: string;
  targetId: string; // Кого кікаємо
}

export interface RematchDto {
  roomId: string;
}

export interface MakeMoveDto {
  roomId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Додамо подію для оновлення гри
export interface GameStateUpdate {
  board: any[][]; // або number[][], залежно як ти зберігаєш
  currentTurnIndex: number; // чий зараз хід
  players: Player[]; // щоб оновити статуси (напр. хтось вийшов)
}

export interface RoomSummary {
  id: string;
  hostName: string;
  currentPlayers: number;
  maxPlayers: number;
  boardSize: number;
  mode: GameMode;
}
export interface CreateRoomDto {
  username: string;
  settings: GameSettings;
}
export interface ReconnectDto { // <--- Нове DTO для відновлення
  roomId: string;
  playerId: string;
}
export interface PlayerActionDto {
  roomId: string;
  targetId?: string;
}