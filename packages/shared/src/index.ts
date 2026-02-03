export const GAME_NAME = "Territory Grab";
export interface Player {
    id: string;
    color: string;
}

export interface ClientToServerEvents {
  joinGame: (roomId: string) => void;
  rollDice: () => void;
  // пізніше додамо moveFigure і т.д.
}

export interface ServerToClientEvents {
  playerJoined: (playerId: string) => void;
  diceRolled: (dice: [number, number]) => void;
}