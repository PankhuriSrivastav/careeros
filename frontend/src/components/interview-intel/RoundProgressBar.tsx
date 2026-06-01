'use client';

import { CheckCircle2, Circle } from 'lucide-react';

interface Round {
  id: string;
  round_type: string;
  round_number: number;
  status: string;
  score?: number;
}

interface RoundProgressBarProps {
  rounds: Round[];
  currentRound: Round | null;
}

export default function RoundProgressBar({ rounds, currentRound }: RoundProgressBarProps) {
  const roundNames: { [key: string]: string } = {
    dsa: 'DSA',
    technical: 'Technical',
    system_design: 'System Design',
    hr: 'HR'
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-sm font-semibold text-gray-600 mb-4">Interview Progress</h3>
      <div className="flex items-center justify-between">
        {rounds.map((round, index) => (
          <div key={round.id} className="flex flex-col items-center flex-1">
            <div className="relative">
              {round.status === 'completed' ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : round.id === currentRound?.id ? (
                <div className="relative">
                  <Circle className="w-8 h-8 text-blue-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                </div>
              ) : (
                <Circle className="w-8 h-8 text-gray-300" />
              )}
            </div>
            <p className="text-xs font-medium mt-2 text-gray-700">{roundNames[round.round_type]}</p>
            {round.score !== null && round.score !== undefined && (
              <p className="text-xs text-gray-500 mt-1">{round.score}/100</p>
            )}
            {index < rounds.length - 1 && (
              <div
                className={`absolute top-4 w-16 h-0.5 -right-8 ${
                  round.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
