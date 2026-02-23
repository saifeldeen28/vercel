interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: string;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

export default function StatsCard({ title, value, icon, color = 'blue' }: StatsCardProps) {
  const gradients = {
    blue: 'from-blue-50 to-blue-100 border-blue-200',
    green: 'from-emerald-50 to-emerald-100 border-emerald-200',
    purple: 'from-purple-50 to-purple-100 border-purple-200',
    orange: 'from-orange-50 to-orange-100 border-orange-200',
  };

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    purple: 'text-purple-700',
    orange: 'text-orange-700',
  };

  const valueColors = {
    blue: 'text-blue-900',
    green: 'text-emerald-900',
    purple: 'text-purple-900',
    orange: 'text-orange-900',
  };

  return (
    <div className={`bg-gradient-to-br ${gradients[color]} rounded-xl border shadow-sm p-5 relative overflow-hidden`}>
      {icon && (
        <span className="absolute right-4 top-3 text-4xl opacity-20 select-none">{icon}</span>
      )}
      <p className={`text-sm font-medium ${textColors[color]} mb-1`}>{title}</p>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
    </div>
  );
}
