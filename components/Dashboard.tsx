
import React from 'react';
import { Video, TrafficCone, Compass, Hand, Database, X, Bot } from 'lucide-react';
import { WarningState, GpsQuality } from '../types';

interface DashboardProps {
  currentSpeed: number;
  speedLimit: number | null; 
  warning: WarningState;
  nextTurnDistance: number;
  streetName: string;
  gpsStatus: GpsQuality;
  heading: number;
  nearestFeature: { type: 'traffic_light' | 'camera', distance: number } | null;
  routeProgress?: number; 
  totalDistance?: number; 
  showProgressBar?: boolean;
  isManualMode?: boolean; 
  onSpeedLimitClick?: () => void;
  // AI Props
  aiResponse?: string | null;
  onCloseAi?: () => void;
}

const formatDistance = (meters: number) => {
  if (meters >= 1000) {
    return { value: (meters / 1000).toFixed(1).replace('.', ','), unit: 'km' };
  }
  return { value: meters.toString(), unit: 'm' };
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  currentSpeed, 
  speedLimit, 
  warning, 
  nextTurnDistance,
  streetName,
  gpsStatus,
  heading,
  nearestFeature,
  routeProgress = 0,
  totalDistance = 0,
  showProgressBar = false,
  isManualMode = false,
  onSpeedLimitClick,
  aiResponse,
  onCloseAi
}) => {
  const isSpeeding = speedLimit !== null && currentSpeed > speedLimit;
  const compassRotation = -heading;
  const totalDist = formatDistance(totalDistance);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20 flex flex-col justify-end pb-[calc(0.5rem+env(safe-area-inset-bottom))] items-center space-y-2">
      
      {/* AI Response Modal (Floating above dashboard) */}
      {aiResponse && (
        <div className="pointer-events-auto absolute bottom-28 left-4 right-4 bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5 z-50">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2 text-emerald-400">
                    <Bot size={20} />
                    <span className="font-bold text-sm uppercase">Trợ lý Luật GT</span>
                </div>
                <button onClick={onCloseAi} className="text-slate-400 hover:text-white bg-white/10 p-1 rounded-full">
                    <X size={16} />
                </button>
            </div>
            <p className="text-white text-sm font-medium leading-relaxed">
                {aiResponse}
            </p>
        </div>
      )}

      {/* 1. Alerts & Warnings */}
      {warning.active && (
        <div className="pointer-events-auto bg-rose-600 px-4 py-2 rounded-xl shadow-lg border border-white/20 animate-bounce flex items-center space-x-2 mb-1">
          <TrafficCone className="text-white" size={16} />
          <span className="text-white font-black text-sm uppercase tracking-wide">{warning.message}</span>
        </div>
      )}

      {/* 2. Route Ruler */}
      {showProgressBar && (
        <div className="w-[90%] max-w-[320px] flex items-center space-x-3 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 py-1">
           <div className="flex-1 h-2 bg-blue-900/60 rounded-full overflow-hidden shadow-sm backdrop-blur-sm ring-1 ring-white/10">
             <div 
                className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-all duration-1000 ease-linear"
                style={{ width: `${routeProgress * 100}%` }}
             />
           </div>
           <div className="flex-shrink-0 text-white font-black text-[10px] tracking-wide bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-md border border-white/5 shadow-sm">
              {totalDist.value} {totalDist.unit}
           </div>
        </div>
      )}

      {/* 3. Main Speed Dashboard */}
      <div className="relative pointer-events-auto w-[90%] max-w-[340px] bg-[#1e3a8a]/95 backdrop-blur-xl rounded-[2rem] px-2 py-2 border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        
        <div className="grid grid-cols-4 gap-1 items-center divide-x divide-white/10">
            
            {/* Speed Limit Sign (CLICKABLE) */}
            <div 
                className="flex flex-col items-center justify-center relative active:scale-95 transition-transform cursor-pointer"
                onClick={onSpeedLimitClick}
            >
                <div className={`w-10 h-10 bg-white rounded-full border-[3px] ${speedLimit !== null ? 'border-[#d0021b]' : 'border-gray-400'} flex items-center justify-center shadow-md relative overflow-hidden`}>
                    {speedLimit !== null ? (
                        <span className="text-black font-black text-lg tracking-tighter leading-none pt-[1px]">{speedLimit}</span>
                    ) : (
                        <span className="text-gray-400 font-black text-lg tracking-tighter leading-none pt-[1px]">--</span>
                    )}
                </div>
                
                {/* Manual Mode / User Memory Indicator */}
                {isManualMode && (
                    <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-[3px] border border-slate-900 shadow-sm animate-pulse z-10">
                        <Database size={8} className="text-white" />
                    </div>
                )}
                
                <span className="text-[6px] text-slate-400 mt-1 font-bold uppercase">{isManualMode ? 'Đã nhớ' : 'Chạm sửa'}</span>
            </div>

            {/* Speed */}
            <div className="col-span-1 flex flex-col items-center justify-center">
                <span className={`text-5xl font-black tracking-tighter leading-none drop-shadow-lg ${isSpeeding ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                    {Math.round(currentSpeed)}
                </span>
                <span className="text-[7px] text-emerald-400 font-black uppercase tracking-widest mt-0.5">km/h</span>
            </div>

            {/* Compass */}
            <div className="flex flex-col items-center justify-center">
                <div className="relative w-10 h-10 bg-slate-800 rounded-full border border-slate-600 flex items-center justify-center shadow-inner group">
                    <div 
                        className="absolute inset-0 transition-transform duration-300 ease-out"
                        style={{ transform: `rotate(${compassRotation}deg)` }}
                    >
                         <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-1.5 h-3 bg-rose-500 rounded-full z-10 shadow-sm"></div>
                         <div className="absolute bottom-[3px] left-1/2 -translate-x-1/2 w-1 h-2.5 bg-slate-400 rounded-full opacity-50"></div>
                         <div className="absolute top-[6px] right-[6px] text-[6px] font-bold text-slate-500">E</div>
                         <div className="absolute top-[6px] left-[6px] text-[6px] font-bold text-slate-500">W</div>
                         <div className="absolute top-[3px] left-1/2 -translate-x-1/2 text-[7px] font-black text-rose-500 mt-3">N</div>
                    </div>
                    <div className="w-1.5 h-1.5 bg-white rounded-full z-20 shadow-lg"></div>
                </div>
            </div>

            {/* Feature */}
            <div className="flex flex-col items-center justify-center">
                {nearestFeature ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-0.5 shadow-sm ${nearestFeature.type === 'camera' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-black'}`}>
                            {nearestFeature.type === 'camera' ? <Video size={16} /> : <TrafficCone size={16} />}
                        </div>
                        <div className="flex items-baseline space-x-[1px]">
                             <span className="text-xs font-bold text-white leading-none">{nearestFeature.distance}</span>
                             <span className="text-[8px] text-slate-400 uppercase font-bold">m</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center opacity-30">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center mb-0.5">
                            <Compass size={16} className="text-slate-400" />
                        </div>
                        <span className="text-[7px] text-slate-400 uppercase font-bold mt-0.5">An toàn</span>
                    </div>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};
