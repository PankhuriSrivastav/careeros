'use client';

interface StatsCardsProps {
  total: number;
  applied: number;
  interview: number;
  offer: number;
}

export default function StatsCards({ total, applied, interview, offer }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-2xl font-bold text-blue-600">{total}</div>
        <div className="text-gray-600">Total Applications</div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-2xl font-bold text-green-600">{applied}</div>
        <div className="text-gray-600">Applied</div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-2xl font-bold text-yellow-600">{interview}</div>
        <div className="text-gray-600">Interviews</div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-2xl font-bold text-purple-600">{offer}</div>
        <div className="text-gray-600">Offers</div>
      </div>
    </div>
  );
}