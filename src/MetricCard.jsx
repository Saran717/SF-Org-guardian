import React from 'react';
import { ShieldAlert, CheckCircle2, ChevronRight, Activity, XOctagon } from 'lucide-react';

const MetricCard = ({ title, value, status, description, drillDownData, onClick }) => {
  const getStatusVisuals = () => {
    switch (status) {
      case 'Healthy':
      case 'Green':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
          glow: 'group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-emerald-500/20',
          border: 'border-emerald-500/20',
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10'
        };
      case 'Moderate':
      case 'Yellow':
        return {
          icon: <Activity className="w-5 h-5 text-amber-400" />,
          glow: 'group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-amber-500/20',
          border: 'border-amber-500/20',
          text: 'text-amber-400',
          bg: 'bg-amber-500/10'
        };
      case 'At Risk':
      case 'Red':
      case 'Critical':
        return {
          icon: <XOctagon className="w-5 h-5 text-rose-500" />,
          glow: 'group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-rose-500/20 border-rose-500/30',
          border: 'border-rose-500/30',
          text: 'text-rose-500',
          bg: 'bg-rose-500/10'
        };
      default:
        return {
          icon: <Activity className="w-5 h-5 text-blue-400" />,
          glow: 'group-hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-blue-500/20',
          border: 'border-blue-500/20',
          text: 'text-blue-400',
          bg: 'bg-blue-500/10'
        };
    }
  };

  const visuals = getStatusVisuals();

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl glass-card p-6 cursor-pointer flex flex-col justify-between transform transition-all duration-500 hover:-translate-y-1 ${visuals.glow}`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-30 transition-all duration-500 group-hover:opacity-60 -mr-10 -mt-10 ${visuals.bg}`}></div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg bg-slate-900/50 backdrop-blur-md border ${visuals.border}`}>
              {visuals.icon}
            </div>
            {title.includes('File') && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <span className="text-[10px] font-black uppercase tracking-widest">Cleanup</span>
              </div>
            )}
          </div>
          
          {drillDownData && drillDownData.length > 0 && (
            <div className="bg-white/5 backdrop-blur-md px-3 py-1 rounded-full border border-white/5 flex items-center gap-1 group-hover:bg-white/10 transition">
              <span className="text-xs font-semibold text-slate-300">
                {drillDownData.length} records
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
            </div>
          )}
        </div>
        
        <h3 className="font-semibold text-slate-200 text-lg mb-1 leading-tight group-hover:text-white transition-colors">
          {title}
        </h3>
        
        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-3xl font-bold tracking-tight ${visuals.text}`}>
            {value}
          </span>
        </div>
        
        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
          {description}
        </p>
      </div>

    </div>
  );
};

export default MetricCard;
