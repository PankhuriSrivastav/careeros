'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getInterviewSession, sendInterviewMessage, completeInterviewSession } from '@/lib/api';
import ChatWindow from '@/components/interview-intel/ChatWindow';
import RoundProgressBar from '@/components/interview-intel/RoundProgressBar';
import { Send, CheckCircle2 } from 'lucide-react';

interface Round {
  id: string;
  round_type: string;
  round_number: number;
  interviewer_name: string;
  interviewer_persona: string;
  status: string;
  score?: number;
}

interface Message {
  id: string;
  round_id: string;
  role: 'user' | 'interviewer';
  content: string;
  created_at: string;
}

interface Session {
  id: string;
  company_name: string;
  rounds: Round[];
  current_round: Round | null;
}

export default function InterviewSessionPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  async function loadSession() {
    try {
      const data = await getInterviewSession(sessionId);
      setSession(data);

      if (data.status === 'completed') {
        setSessionComplete(true);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }

  async function handleSendMessage() {
    if (!inputValue.trim() || !session?.current_round) return;

    setIsSending(true);
    try {
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        round_id: session.current_round!.id,
        role: 'user',
        content: inputValue,
        created_at: new Date().toISOString()
      }]);

      const response = await sendInterviewMessage(sessionId, inputValue);
      setInputValue('');

      if (response.message) {
        setMessages(prev => [...prev, {
          id: response.message.id,
          round_id: response.message.round_id,
          role: response.message.role,
          content: response.message.content,
          created_at: response.message.created_at
        }]);
      }

      if (response.round_complete) {
        setShowTransition(true);
        setTimeout(() => {
          setShowTransition(false);
          loadSession();
        }, 2000);
      }

      if (response.session_complete) {
        setSessionComplete(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }

  async function handleCompleteSession() {
    try {
      await completeInterviewSession(sessionId);
      router.push(`/dashboard/interview-intel/session/${sessionId}/debrief`);
    } catch (error) {
      console.error('Error completing session:', error);
    }
  }

  if (!session) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-800">{session.company_name}</h1>
        <p className="text-gray-600 mt-1">Mock Interview Round</p>
      </div>

      {/* Round Progress */}
      <RoundProgressBar rounds={session.rounds} currentRound={session.current_round} />

      {/* Round Transition Overlay */}
      {showTransition && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white p-8 rounded-lg text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="font-semibold text-gray-800">Round Complete!</p>
            <p className="text-gray-600 text-sm mt-2">Preparing next round...</p>
          </div>
        </div>
      )}

      {/* Chat Area */}
      {session.current_round && !sessionComplete && (
        <div className="space-y-4">
          <ChatWindow
            messages={messages}
            isLoading={isSending}
            interviewer={{
              name: session.current_round.interviewer_name,
              persona: session.current_round.interviewer_persona || 'Interviewer'
            }}
          />

          {/* Input Area */}
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                placeholder="Type your response here (Shift+Enter for new line)..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || !inputValue.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Complete */}
      {sessionComplete && (
        <div className="bg-green-50 p-8 rounded-lg border border-green-200 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 text-lg">Interview Complete!</p>
          <p className="text-gray-600 mt-2">All rounds finished. View your detailed debrief below.</p>
          <button
            onClick={handleCompleteSession}
            className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
          >
            View Debrief
          </button>
        </div>
      )}
    </div>
  );
}
