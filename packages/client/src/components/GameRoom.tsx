import { useState, useEffect } from 'react';
import type { Room } from '@territory/shared'; 
import { socket } from '../socket'; 
import { GameLobby } from './GameLobby';
import { ActiveGame } from './ActiveGame';
import { GameOverModal } from './GameOverModal';

interface GameRoomProps {
  room: Room;
  onLeave: () => void;
}

type CellOwner = string | null;

export const GameRoom = ({ room: initialRoom, onLeave }: GameRoomProps) => {
  const [room, setRoom] = useState<Room>(initialRoom);
  
  // Grid state тримаємо тут, щоб він не зникав при переключеннях
  const [grid, setGrid] = useState<CellOwner[][]>(
    (room.board as CellOwner[][]) || []
  );

  useEffect(() => {
    const onGameUpdate = (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.board) setGrid(updatedRoom.board as CellOwner[][]);
    };
    socket.on('gameUpdated', onGameUpdate);
    return () => { socket.off('gameUpdated', onGameUpdate); };
  }, []);

  // Вибір, що показувати
  if (room.status === 'lobby') {
      return <GameLobby room={room} onLeave={onLeave} />;
  }

  return (
    <>
        <ActiveGame 
            room={room} 
            grid={grid} 
            isMyTurn={room.currentTurnIndex === room.players.findIndex(p => p.id === socket.id)} 
            onLeave={onLeave}
        />
        {room.status === 'finished' && (
            <GameOverModal room={room} grid={grid} onLeave={onLeave} />
        )}
    </>
  );
};