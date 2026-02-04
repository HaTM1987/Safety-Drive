
import React, { useEffect, useState } from 'react';
import { MapPin, ArrowRight, Activity, Navigation, ShieldCheck, Share, PlusSquare } from 'lucide-react';
import { AutocompleteInput } from './AutocompleteInput';
import { LocationPoint, Coordinates } from '../types';

interface NavigationSetupProps {
  onStartNavigation: (start: LocationPoint | null, end: LocationPoint | null) => void;
  isAnalyzing: boolean;
  currentLocation: Coordinates | null;
}

export const NavigationSetup: React.FC<NavigationSetupProps> = ({ onStartNavigation, isAnalyzing, currentLocation }) => {
  const [start, setStart] = React.useState<LocationPoint | null>(null);
  const [end, setEnd] = React.useState<LocationPoint | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Kiểm tra xem app có đang chạy ở chế độ PWA (đã cài đặt) chưa
  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPWA);

    if (currentLocation && !start) {
      setStart({
        address: "Vị trí hiện tại",
        lat: currentLocation.lat,
        lng: currentLocation.lng
      });
    }
  }, [currentLocation]); 

  return (
    <div className="flex-1 bg-slate-950 flex flex-col p-6 pt-[calc(3rem+env(safe-area-inset-top))] h-full overflow-y-auto">
      <div className="mb-6 text-center">
        <div className="inline-block p-4 bg-emerald-500 rounded-[2rem] shadow-2xl shadow-emerald-500/20 mb-4">
            <ShieldCheck className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Safety Drive</h1>
        <p className="text-emerald-500 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Vietnam Edition</p>
      </div>

      {/* Install Instruction for iOS Web Users */}
      {!isStandalone && (
        <div className="mb-6 bg-slate-900 border border-white/10 p-4 rounded-2xl animate-fade-in">
           <p className="text-white text-xs font-bold mb-2 text-center uppercase text-emerald-400">Cài đặt ứng dụng</p>
           <div className="flex items-center justify-center space-x-2 text-slate-300 text-xs">
              <span>Nhấn</span>
              <Share size={16} className="text-blue-400" />
              <span>chọn</span>
              <span className="font-bold text-white whitespace-nowrap">"Thêm vào MH chính"</span>
              <PlusSquare size={16} />
           </div>
        </div>
      )}

      <div className="space-y-4 mb-8">
        <div className="bg-slate-900/50 p-1.5 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
            <AutocompleteInput 
                label="Bắt đầu"
                placeholder="Điểm đi..."
                icon={<MapPin className="text-emerald-500" size={18} />}
                value={start}
                onChange={setStart}
            />
            <div className="h-px bg-white/5 mx-6"></div>
            <AutocompleteInput 
                label="Kết thúc"
                placeholder="Điểm đến..."
                icon={<MapPin className="text-rose-500" size={18} />}
                value={end}
                onChange={setEnd}
            />
        </div>
      </div>

      <div className="space-y-4">
        <button 
          onClick={() => start && end && onStartNavigation(start, end)}
          disabled={!start || !end || isAnalyzing}
          className={`w-full py-5 rounded-2xl font-black text-base flex items-center justify-center space-x-3 shadow-2xl transition-all active:scale-95 ${
            !start || !end || isAnalyzing 
            ? 'bg-slate-800 text-slate-600' 
            : 'bg-emerald-500 text-white shadow-emerald-500/20'
          }`}
        >
            {isAnalyzing ? (
                <Activity className="animate-spin" size={20} />
            ) : (
                <>
                    <span>BẮT ĐẦU DẪN ĐƯỜNG</span>
                    <ArrowRight size={20} />
                </>
            )}
        </button>

        <button 
            onClick={() => onStartNavigation(null, null)}
            className="w-full py-4 rounded-2xl font-bold text-sm bg-white/5 text-slate-300 border border-white/10 active:bg-white/10 transition-all flex items-center justify-center space-x-2"
        >
            <Navigation size={16} className="text-emerald-500" />
            <span>Chạy chế độ lái tự do</span>
        </button>
      </div>

      <div className="mt-auto mb-2 text-center">
        <div className="flex items-center justify-center space-x-2 bg-emerald-500/10 py-2 px-4 rounded-full border border-emerald-500/20 inline-flex">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hệ thống dẫn đường trực tuyến</span>
        </div>
      </div>
    </div>
  );
};
