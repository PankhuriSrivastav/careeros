'use client';

import { TrendingUp, Check, AlertCircle, Target } from 'lucide-react';

interface Debrief {
  overall_score: number;
  overall_feedback: any;
  round_breakdowns: any;
  strengths: string[];
  improvements: string[];
}

interface InterviewDebriefProps {
  debrief: Debrief;
}

export default function InterviewDebrief({ debrief }: InterviewDebriefProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getRecommendation = (score: number) => {
    if (score >= 80) return { text: 'Strong Hire', color: 'text-green-600' };
    if (score >= 70) return { text: 'Good Hire', color: 'text-blue-600' };
    if (score >= 60) return { text: 'Borderline', color: 'text-yellow-600' };
    return { text: 'Needs Improvement', color: 'text-red-600' };
  };

  const rec = getRecommendation(debrief.overall_score);

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <div className={`rounded-lg p-6 ${getScoreColor(debrief.overall_score)}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-75">Overall Score</p>
            <p className="text-4xl font-bold mt-2">{debrief.overall_score}/100</p>
            <p className={`text-sm font-semibold mt-2 ${rec.color}`}>{rec.text}</p>
          </div>
          <TrendingUp className="w-12 h-12 opacity-50" />
        </div>
      </div>

      {/* Per-Round Scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(debrief.round_breakdowns || {}).map(([round, feedback]: [string, any]) => (
          <div key={round} className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h4 className="font-semibold text-gray-800 capitalize mb-3">
              {round.replace(/_/g, ' ')} Round
            </h4>
            {feedback && feedback.feedback && (
              <p className="text-sm text-gray-700 mb-2">{feedback.feedback}</p>
            )}
            {feedback && feedback.score && (
              <p className="text-sm font-medium text-blue-600">Score: {feedback.score}/100</p>
            )}
          </div>
        ))}
      </div>

      {/* Strengths */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <Check className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-800">Strengths</h3>
        </div>
        <ul className="space-y-2">
          {debrief.strengths && debrief.strengths.map((strength, index) => (
            <li key={index} className="flex items-start space-x-3">
              <span className="text-green-600 mt-1">•</span>
              <span className="text-sm text-gray-700">{strength}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Improvements */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <div className="flex items-center space-x-2 mb-4">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-800">Areas for Improvement</h3>
        </div>
        <ul className="space-y-2">
          {debrief.improvements && debrief.improvements.map((improvement, index) => (
            <li key={index} className="flex items-start space-x-3">
              <span className="text-orange-600 mt-1">•</span>
              <span className="text-sm text-gray-700">{improvement}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Overall Feedback */}
      {debrief.overall_feedback && Object.keys(debrief.overall_feedback).length > 0 && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-800">Detailed Feedback</h3>
          </div>
          {Object.entries(debrief.overall_feedback).map(([key, value]: [string, any]) => (
            <div key={key} className="mb-3">
              <p className="text-xs font-semibold text-blue-800 uppercase">{key}</p>
              <p className="text-sm text-gray-700 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
