import { useState, useEffect } from 'react';
import { socket } from '../socket';
import type { Room } from '@territory/shared';
import { GameChat } from './GameChat';

interface GameLobbyProps {
  room: Room;
  onLeave: () => void;
}

export const GameLobby = ({ room, onLeave }: GameLobbyProps) => {
  const myPlayer = room.players.find(p => p.socketId === socket.id);
  const isHost = room.hostId === myPlayer?.id;
  
  // Стан для мобільних вкладок (Гравці або Чат)
  const [mobileTab, setMobileTab] = useState<'players' | 'chat'>('players');

  // Логіка старту: Мінімум 2 гравці + Всі натиснули Ready
  const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);
  const canStart = isHost && allReady;

  useEffect(() => {
    const handleException = (data: any) => {
       alert(data.message || 'Error');
    };
    socket.on('exception', handleException);
    return () => { socket.off('exception', handleException); };
  }, []);

  const handleToggleReady = () => {
    socket.emit('toggleReady', { roomId: room.id });
  };
  
  const handleStartGame = () => {
    if (canStart) {
        socket.emit('startGame', { roomId: room.id });
    } else {
        alert("Wait for everyone to be READY!");
    }
  };

  const handleKick = (targetId: string) => {
    if (confirm("Kick this player?")) {
        socket.emit('kickPlayer', { roomId: room.id, targetId });
    }
  };
  
  const handleCopyId = () => {
     navigator.clipboard.writeText(room.id);
  };

  if (!room) return <div className="text-white flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans">
      
      {/* ГОЛОВНИЙ КОНТЕЙНЕР */}
      <div className="w-full max-w-6xl bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col lg:flex-row h-[85vh] lg:h-[700px]">
        
        {/* === ЛІВА КОЛОНКА (На ПК) / ОСНОВНА (На Мобільному) === */}
        <div className="flex-1 flex flex-col min-w-0">
            
            {/* ШАПКА ЛОББІ */}
            <div className="p-4 lg:p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-3">
                        LOBBY <span className="text-slate-500 text-sm font-normal">({room.players.length}/{room.settings.maxPlayers})</span>
                    </h1>
                    <div className="flex gap-2 lg:gap-4 mt-1 text-xs lg:text-sm text-gray-400">
                        <span className="bg-slate-700 px-2 py-0.5 rounded border border-slate-600 uppercase">{room.settings.mode}</span>
                        <span className="bg-slate-700 px-2 py-0.5 rounded border border-slate-600">{room.settings.boardSize}x{room.settings.boardSize}</span>
                    </div>
                </div>
                <div onClick={handleCopyId} className="cursor-pointer bg-slate-700 hover:bg-slate-600 px-3 py-1 lg:px-4 lg:py-2 rounded-lg border border-slate-600 flex flex-col items-center transition active:scale-95">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ROOM ID</span>
                    <span className="text-lg lg:text-xl font-mono font-bold text-blue-400">{room.id}</span>
                </div>
            </div>

            {/* МОБІЛЬНІ ТАБИ (Тільки на телефоні visible) */}
            <div className="flex lg:hidden border-b border-slate-700 bg-slate-900">
                <button 
                    onClick={() => setMobileTab('players')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${mobileTab === 'players' ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800" : "text-gray-500"}`}
                >
                    Players
                </button>
                <button 
                    onClick={() => setMobileTab('chat')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider ${mobileTab === 'chat' ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800" : "text-gray-500"}`}
                >
                    Chat
                </button>
            </div>

            {/* КОНТЕНТ (ЗМІНЮЄТЬСЯ НА МОБІЛЬНОМУ, СТАТИЧНИЙ НА ПК) */}
            <div className="flex-1 overflow-hidden relative">
                
                {/* 1. СПИСОК ГРАВЦІВ (Показуємо, якщо це ПК АБО якщо на мобільному обрано таб Players) */}
                <div className={`absolute inset-0 flex flex-col ${mobileTab === 'chat' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-3 bg-slate-900/50">
                        {room.players.map(p => (
                            <div key={p.id} className={`flex items-center justify-between p-3 lg:p-4 rounded-xl border transition group ${p.isReady ? "bg-green-900/10 border-green-500/30" : "bg-slate-800 border-slate-700"}`}>
                                <div className="flex items-center gap-3 lg:gap-4">
                                    <div className="relative">
                                        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full shadow-lg border-2 border-slate-600" style={{ backgroundColor: p.color }}></div>
                                        {p.id === room.hostId && <span className="absolute -top-1 -right-1 text-xs">👑</span>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-sm lg:text-lg ${p.socketId === socket.id ? "text-white" : "text-gray-300"}`}>
                                            {p.username} {p.socketId === socket.id && "(You)"}
                                        </span>
                                        {!p.isOnline && <span className="text-[10px] text-red-500 font-bold uppercase">OFFLINE</span>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 lg:gap-3">
                                    <span className={`text-[10px] lg:text-xs font-bold px-2 py-1 lg:px-3 lg:py-1 rounded-full uppercase tracking-wider ${p.isReady ? "text-green-400 bg-green-900/20" : "text-slate-500 bg-slate-800"}`}>
                                        {p.isReady ? "READY" : "WAITING"}
                                    </span>
                                    {isHost && p.id !== myPlayer?.id && (
                                        <button onClick={() => handleKick(p.id)} className="lg:opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 rounded-lg transition">✕</button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. ЧАТ (Тільки для мобільного в цьому контейнері, коли обрано таб Chat) */}
                <div className={`absolute inset-0 flex flex-col lg:hidden ${mobileTab === 'chat' ? 'flex' : 'hidden'}`}>
                     <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
                </div>

            </div>

            {/* НИЖНЯ ПАНЕЛЬ: КНОПКИ ДІЇ */}
            <div className="p-4 lg:p-6 border-t border-slate-700 bg-slate-800 flex flex-col gap-3">
                
                {/* РЯДОК 1: READY / LEAVE */}
                <div className="flex gap-3 h-14">
                    <button onClick={onLeave} className="px-6 rounded-xl font-bold text-slate-400 border border-slate-600 hover:bg-slate-700 hover:text-white transition text-sm lg:text-base">
                        EXIT
                    </button>
                    
                    {/* Кнопка READY тепер доступна ВСІМ (і Хосту теж) */}
                    <button 
                        onClick={handleToggleReady}
                        className={`flex-1 rounded-xl font-bold text-lg transition shadow-lg active:scale-95 ${myPlayer?.isReady ? "bg-slate-700 text-gray-300 border border-slate-600" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"}`}
                    >
                        {myPlayer?.isReady ? "CANCEL READY" : "I'M READY!"}
                    </button>
                </div>
                
                {/* РЯДОК 2: START GAME (Тільки для Хоста) */}
                {isHost && (
                    <button 
                        onClick={handleStartGame}
                        disabled={!canStart}
                        className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 shadow-lg ${canStart ? "bg-green-600 hover:bg-green-500 text-white shadow-green-900/30 active:scale-95 animate-pulse" : "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"}`}
                    >
                        {canStart ? "START GAME" : (room.players.length < 2 ? "Need 2+ Players" : "Waiting for Ready...")}
                    </button>
                )}
            </div>
        </div>

        {/* === ПРАВА КОЛОНКА (ЧАТ - ТІЛЬКИ ПК) === */}
        {/* На мобільному цей блок прихований, бо чат рендериться всередині табів */}
        <div className="hidden lg:flex w-80 border-l border-slate-700 bg-slate-900 flex-col">
            <div className="p-4 border-b border-slate-800 font-bold text-slate-400 text-sm uppercase tracking-wider text-center">
                Lobby Chat
            </div>
            <div className="flex-1 min-h-0">
                <GameChat roomId={room.id} messages={room.chatHistory || []} players={room.players} />
            </div>
        </div>

      </div>
    </div>
  );
};