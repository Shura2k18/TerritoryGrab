import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import type { ChatMessage, Player } from '@territory/shared';

interface GameChatProps {
  roomId: string;
  messages: ChatMessage[];
  players: Player[];
}

export const GameChat = ({ roomId, messages }: GameChatProps) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    socket.emit('sendMessage', { roomId, text: inputText });
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-inner">
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex justify-center items-center flex-shrink-0">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Chat</span>
      </div>

      {/* FIX: min-h-0 дозволяє скролу працювати всередині flex-контейнера */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
        {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
                <div className="text-center text-slate-600 text-xs italic">
                    <p>No messages yet.</p>
                </div>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isSystem ? "items-center my-2" : "items-start"}`}>
            {msg.isSystem ? (
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 border border-slate-700 shadow-sm">
                    {msg.text}
                </span>
            ) : (
                <div className="w-full max-w-[90%]">
                    <div className="flex items-baseline gap-2 mb-0.5 ml-1">
                        <span className="text-xs font-bold" style={{ color: msg.color }}>{msg.senderName}</span>
                        <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="bg-slate-800 p-2.5 rounded-2xl rounded-tl-none border border-slate-700 text-sm text-gray-200 break-words shadow-sm">
                        {msg.text}
                    </div>
                </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2 flex-shrink-0">
        <input 
          type="text" 
          className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition placeholder-slate-600"
          placeholder="Type message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
        <button 
          type="submit" 
          disabled={!inputText.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white p-2 rounded-lg transition shadow-lg active:scale-95"
        >
          ➤
        </button>
      </form>
    </div>
  );
};