
import React from 'react';
import { Navigation, Signal, SignalZero, Video, TrafficCone, Compass } from 'lucide-react';
import { WarningState, GpsQuality } from '../types';

interface DashboardProps {
  currentSpeed: number;
  speedLimit: number;
  warning: WarningState;
  nextTurnDistance: number;
  streetName: string;
  gpsStatus: GpsQuality;
  heading: number;
  nearestFeature: { type: 'traffic_light' | 'camera', distance: number } | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  currentSpeed, 
  speedLimit, 
  warning, 
  nextTurnDistance,
  streetName,
  gpsStatus,
  heading,
  nearestFeature
}) => {
  const isSpeeding = currentSpeed > speedLimit;

  // Render Compass Rotation (North points to actual North)
  // heading is the direction device is pointing (0 = North, 90 = East)
  // We rotate the compass dial opposite to heading so 'N' stays North.
  const compassRotation = -heading;

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none z-20 flex flex-col justify-end pb-[calc(1rem+env(safe-area-inset-bottom))]">
      
      {/* Top Floating Alerts (Navigation & Warnings) */}
      <div className="absolute top-[env(safe-area-inset-top,47px)] inset-x-0 px-4 flex flex-col items-center space-y-2">
        <div className="bg-[#1e3a8a]/90 backdrop-blur-2xl px-5 py-3 rounded-2xl border border-white/10 shadow-2xl flex items-center space-x-4 w-full max-w-[340px]">
          <div className="bg-emerald-500 p-2 rounded-xl">
            <Navigation className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
             <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-white">{nextTurnDistance > 0 ? nextTurnDistance : '--'}</span>
              <span className="text-[10px] font-bold text-emerald-400 uppercase">mét</span>
            </div>
            <p className="text-slate-300 text-xs font-medium truncate">{streetName}</p>
          </div>
          <div className="flex items-center space-x-1 pl-2 border-l border-white/10">
             {gpsStatus === 'locked' ? (
              <Signal size={16} className="text-emerald-500" />
            ) : (
              <SignalZero size={16} className="text-rose-500 animate-pulse" />
            )}
          </div>
        </div>

        {warning.active && (
          <div className="bg-rose-600 px-4 py-2 rounded-xl shadow-lg border border-rose-400 animate-bounce">
            <span className="text-white font-bold text-sm uppercase">{warning.message}</span>
          </div>
        )}
      </div>

      {/* Main Dashboard Bar (4 Columns) */}
      <div className="mx-3 mb-2 bg-[#1e3a8a]/90 backdrop-blur-xl rounded-[2rem] p-4 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div className="grid grid-cols-4 gap-2 items-center">
            
            {/* 1. Speed Limit */}
            <div className="flex flex-col items-center justify-center border-r border-white/10 pr-2">
                <div className="w-14 h-14 bg-white rounded-full border-[5px] border-[#d0021b] flex items-center justify-center shadow-lg ring-1 ring-black/20">
                    <span className="text-black font-black text-2xl tracking-tighter">{speedLimit}</span>
                </div>
                <span className="text-[8px] text-slate-300 mt-1 uppercase font-bold tracking-wider">Giới hạn</span>
            </div>

            {/* 2. Current Speed */}
            <div className="col-span-1 flex flex-col items-center justify-center border-r border-white/10 pr-2">
                <span className={`text-5xl font-black tracking-tighter leading-none ${isSpeeding ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                    {Math.round(currentSpeed)}
                </span>
                <span className="text-[9px] text-emerald-400 mt-1 font-black uppercase">km/h</span>
            </div>

            {/* 3. Compass */}
            <div className="flex flex-col items-center justify-center border-r border-white/10 pr-2">
                <div className="relative w-12 h-12 bg-slate-800 rounded-full border-2 border-slate-500 flex items-center justify-center shadow-inner">
                    {/* Compass Dial */}
                    <div 
                        className="absolute inset-0 transition-transform duration-300 ease-out"
                        style={{ transform: `rotate(${compassRotation}deg)` }}
                    >
                         <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-3 bg-rose-500 rounded-full z-10"></div> {/* North Marker */}
                         <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-2 bg-slate-400 rounded-full opacity-50"></div> {/* South Marker */}
                         <div className="absolute top-1 right-3 text-[6px] font-bold text-slate-400">E</div>
                         <div className="absolute top-1 left-3 text-[6px] font-bold text-slate-400">W</div>
                         <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-rose-500 mt-3">N</div>
                    </div>
                    {/* Center point */}
                    <div className="w-1 h-1 bg-white rounded-full z-20"></div>
                </div>
                <span className="text-[8px] text-slate-300 mt-1 uppercase font-bold">Hướng</span>
            </div>

            {/* 4. Distance to Feature */}
            <div className="flex flex-col items-center justify-center pl-1">
                {nearestFeature ? (
                    <>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-0.5 ${nearestFeature.type === 'camera' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                            {nearestFeature.type === 'camera' ? <Video size={20} /> : <TrafficCone size={20} />}
                        </div>
                        <span className="text-lg font-bold text-white leading-none">{nearestFeature.distance}</span>
                        <span className="text-[8px] text-slate-300 uppercase font-bold">mét</span>
                    </>
                ) : (
                    <>
                        <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center mb-0.5 opacity-50">
                            <Compass size={18} className="text-slate-400" />
                        </div>
                        <span className="text-lg font-bold text-slate-400 leading-none">--</span>
                        <span className="text-[8px] text-slate-400 uppercase font-bold">Trống</span>
                    </>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};
