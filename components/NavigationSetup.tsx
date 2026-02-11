
import React, { useEffect, useState, useRef } from 'react';
import { MapPin, ArrowRight, Activity, Navigation, ShieldCheck, Share, PlusSquare, Coffee, X, Copy, Check, Mic, Sparkles } from 'lucide-react';
import { AutocompleteInput } from './AutocompleteInput';
import { LocationPoint, Coordinates } from '../types';
import { speak } from '../services/ttsService';

interface NavigationSetupProps {
  onStartNavigation: (start: LocationPoint | null, end: LocationPoint | null) => void;
  isAnalyzing: boolean;
  currentLocation: Coordinates | null;
}

export const NavigationSetup: React.FC<NavigationSetupProps> = ({ onStartNavigation, isAnalyzing, currentLocation }) => {
  const [start, setStart] = React.useState<LocationPoint | null>(null);
  const [end, setEnd] = React.useState<LocationPoint | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Voice Input State
  const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening_command' | 'processing'>('idle');
  const recognitionRef = useRef<any>(null);

  // Kiểm tra chế độ PWA
  useEffect(() => {
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

  // --- LOGIC NHẬN DIỆN GIỌNG NÓI (HI TÔ) ---
  const searchLocation = async (query: string): Promise<LocationPoint | null> => {
      try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
              return {
                  address: data[0].display_name,
                  lat: parseFloat(data[0].lat),
                  lng: parseFloat(data[0].lon)
              };
          }
          return null;
      } catch (e) { return null; }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = async (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log("Setup Voice:", transcript);

        // 1. Phát hiện Wake Word "Hi Tô"
        if (transcript.includes("hi tô") || transcript.includes("hi to") || transcript.includes("chào tô")) {
            setVoiceStatus('listening_command');
            speak("Tôi đây, mời bạn đọc điểm đi và điểm đến.");
            return;
        }

        // 2. Xử lý lệnh nhập liệu (nếu đã kích hoạt)
        // Mẫu câu: "Từ [A] đến [B]" hoặc "Đi từ [A] tới [B]"
        if (voiceStatus === 'listening_command') {
            const regex = /(?:từ|đi)\s+(.+?)\s+(?:đến|tới|về|qua)\s+(.+)/i;
            const match = transcript.match(regex);

            if (match) {
                const startQuery = match[1].trim();
                const endQuery = match[2].trim();
                
                setVoiceStatus('processing');
                speak(`Đang tìm đường từ ${startQuery} đến ${endQuery}`);

                const [startLoc, endLoc] = await Promise.all([
                    searchLocation(startQuery),
                    searchLocation(endQuery)
                ]);

                if (startLoc) setStart(startLoc);
                if (endLoc) setEnd(endLoc);
                
                setVoiceStatus('idle');
                if (startLoc && endLoc) {
                    speak("Đã nhập xong dữ liệu.");
                } else {
                    speak("Xin lỗi, tôi không tìm thấy địa chỉ này.");
                }
            }
        }
    };

    recognition.onend = () => {
        // Tự động khởi động lại để luôn lắng nghe "Hi Tô"
        if (recognitionRef.current) {
            try { recognition.start(); } catch(e){}
        }
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
        setIsListeningForWakeWord(true);
    } catch(e) {}

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
    };
  }, [voiceStatus]);


  const handleCopy = () => {
    navigator.clipboard.writeText("0071000883469");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 bg-slate-950 flex flex-col p-6 pt-[calc(3rem+env(safe-area-inset-top))] h-full overflow-y-auto relative">
      <div className="mb-6 text-center">
        <div className="inline-block p-4 bg-emerald-500 rounded-[2rem] shadow-2xl shadow-emerald-500/20 mb-4">
            <ShieldCheck className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Safety Drive</h1>
        <p className="text-emerald-500 text-[10px] font-black tracking-[0.3em] uppercase mt-1">Vietnam Edition</p>
      </div>

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
        <div className={`bg-slate-900/50 p-1.5 rounded-[2.5rem] border backdrop-blur-md transition-colors duration-500 ${voiceStatus !== 'idle' ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-white/5'}`}>
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
        
        {/* --- VOICE TIP SECTION (NEW) --- */}
        <div className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ${voiceStatus !== 'idle' ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-900/60 border-white/5'}`}>
            {voiceStatus !== 'idle' && (
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse"></div>
            )}
            <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-full flex-shrink-0 ${voiceStatus !== 'idle' ? 'bg-emerald-500 text-white animate-bounce' : 'bg-white/5 text-emerald-400'}`}>
                    {voiceStatus === 'processing' ? <Activity size={16} className="animate-spin" /> : <Mic size={16} />}
                </div>
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <Sparkles size={12} className="text-amber-400" />
                        <p className={`text-xs font-bold uppercase tracking-wider ${voiceStatus !== 'idle' ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {voiceStatus === 'listening_command' ? 'Đang nghe bạn...' : voiceStatus === 'processing' ? 'Đang tìm địa điểm...' : 'Hỗ trợ rảnh tay'}
                        </p>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                        Nói <span className="text-white font-black bg-emerald-600/30 px-1.5 py-0.5 rounded mx-0.5 border border-emerald-500/30">"Hi Tô"</span> để bật nhập liệu.
                        <br/>
                        Sau đó đọc: <span className="italic text-emerald-100">"Từ <b>[Điểm A]</b> đến <b>[Điểm B]</b>"</span>
                    </p>
                </div>
            </div>
        </div>

      </div>

      {/* Author & Donation Section */}
      <div className="mt-auto mb-6 px-2">
        <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 text-center backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent opacity-50"></div>
            
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest mb-1.5">Phát triển bởi</p>
            <p className="text-white font-bold text-sm mb-3 flex items-center justify-center space-x-2">
                <span>Tô Minh Hà</span>
                <span className="text-slate-700">|</span>
                <span className="text-emerald-400 font-mono tracking-wide">0935.403.289</span>
            </p>
            
            <p className="text-slate-400 text-[11px] leading-relaxed max-w-[280px] mx-auto font-medium">
                Nếu ứng dụng này giúp ích cho bạn, hãy ủng hộ Tôi ly cà phê bằng cách <button onClick={() => setShowDonate(true)} className="text-emerald-400 hover:text-emerald-300 font-bold underline decoration-emerald-500/50 underline-offset-2 transition-colors cursor-pointer inline-flex items-center gap-1">nhấp vào đây <Coffee size={10} /></button>
            </p>
        </div>
      </div>

      <div className="mb-2 text-center">
        <div className="flex items-center justify-center space-x-2 bg-emerald-500/5 py-1.5 px-3 rounded-full border border-emerald-500/10 inline-flex">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-bold text-emerald-600/80 uppercase tracking-widest">Hệ thống dẫn đường trực tuyến</span>
        </div>
      </div>

      {/* Donation Modal */}
      {showDonate && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowDonate(false)}>
            <div className="bg-white rounded-[2.5rem] p-6 max-w-[340px] w-full shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowDonate(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-2 transition-colors">
                    <X size={20} />
                </button>
                
                <div className="text-center mb-6 mt-2">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-emerald-200 shadow-lg">
                        <Coffee size={28} fill="currentColor" />
                    </div>
                    <h3 className="text-slate-900 font-black text-xl tracking-tight">Cảm ơn bạn! ☕️</h3>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner flex flex-col items-center overflow-hidden">
                        <img 
                            src="https://img.vietqr.io/image/VCB-0071000883469-compact.png?accountName=TO%20MINH%20HA" 
                            alt="QR Vietcombank" 
                            className="w-full h-auto rounded-xl"
                        />
                    </div>

                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-sm space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                             <span className="text-slate-500 font-medium text-xs uppercase tracking-wide">Ngân hàng</span>
                             <span className="font-bold text-slate-900">Vietcombank</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                             <span className="text-slate-500 font-medium text-xs uppercase tracking-wide">Chủ TK</span>
                             <span className="font-bold text-slate-900 uppercase">Tô Minh Hà</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                             <span className="text-slate-500 font-medium text-xs uppercase tracking-wide">Số TK</span>
                             <div className="flex items-center space-x-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                                <span className="font-mono font-bold text-slate-900 text-base">0071000883469</span>
                                <button 
                                    onClick={handleCopy}
                                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-emerald-600"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                             </div>
                        </div>
                    </div>
                </div>

                 <button onClick={() => setShowDonate(false)} className="w-full mt-6 py-3.5 bg-slate-900 text-white font-bold rounded-2xl text-sm active:scale-95 transition-transform shadow-lg shadow-slate-900/20">
                    Đóng
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
