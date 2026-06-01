'use client';

import { useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'interviewer';
  content: string;
  created_at: string;
}

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  interviewer: {
    name: string;
    persona: string;
  };
}

export default function ChatWindow({ messages, isLoading, interviewer }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 border-b">
        <h3 className="font-semibold text-gray-800">{interviewer.name}</h3>
        <p className="text-xs text-gray-600 mt-1">{interviewer.persona}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Interview starting...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg rounded-bl-none flex items-center space-x-2">
              <Loader className="w-4 h-4 animate-spin" />
              <span className="text-sm">Interviewer is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
