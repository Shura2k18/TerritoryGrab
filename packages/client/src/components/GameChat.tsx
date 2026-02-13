import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import type { ChatMessage, Player } from '@territory/shared';

interface GameChatProps {
  roomId: string;
  messages: ChatMessage[];
  players: Player[];
}

export const GameChat = ({ roomId, messages, players }: GameChatProps) => {
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Автоскрол вниз при нових повідомленнях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit('sendMessage', { roomId, text });
    setText('');
  };

  // Знаходимо себе серед гравців, щоб отримати свій ID (UUID), а не просто socket.id
  const myPlayer = players.find(p => p.socketId === socket.id);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white font-sans text-sm">
       
       {/* Список повідомлень */}
       <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {messages.map((msg) => {
              // 1. Системні повідомлення (по центру)
              if (msg.isSystem) {
                  return (
                      <div key={msg.id} className="flex justify-center my-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/50">
                              {msg.text}
                          </span>
                      </div>
                  );
              }

              // 2. Визначаємо, чи це Я
              const isMe = msg.senderId === myPlayer?.id;

              return (
                  <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                      
                      {/* Бульбашка повідомлення */}
                      <div className={`
                          relative max-w-[85%] px-3 py-2 shadow-md break-words
                          ${isMe 
                              ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' // Мій стиль
                              : 'bg-slate-700 text-gray-200 rounded-2xl rounded-tl-none' // Чужий стиль
                          }
                      `}>
                          {/* Ім'я автора (показуємо тільки для чужих) */}
                          {!isMe && (
                              <div className="text-[10px] font-bold mb-0.5 opacity-90" style={{ color: msg.color }}>
                                  {msg.senderName}
                              </div>
                          )}
                          
                          <p className="leading-tight whitespace-pre-wrap">{msg.text}</p>
                          
                          {/* Час (опціонально, дуже дрібно) */}
                          <div className={`text-[9px] mt-1 text-right opacity-50 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                      </div>
                  </div>
              );
          })}
          <div ref={bottomRef} />
       </div>

       {/* Поле вводу */}
       <form onSubmit={handleSubmit} className="p-2 border-t border-slate-700 bg-slate-800 flex gap-2">
           <input
             className="flex-1 bg-slate-900 text-white px-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-700 placeholder:text-slate-600 transition-all"
             value={text}
             onChange={e => setText(e.target.value)}
             placeholder="Message..."
           />
           <button 
             type="submit" 
             disabled={!text.trim()}
             className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-lg"
           >
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 ml-0.5">
                 <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.89 28.89 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
               </svg>
           </button>
       </form>
    </div>
  );
};