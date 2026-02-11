
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Square, Compass, Navigation2, ScanEye, Mic, Loader2 } from 'lucide-react';
import { MapDisplay } from './components/MapDisplay';
import { Dashboard } from './components/Dashboard';
import { NavigationSetup } from './components/NavigationSetup';
import { AppState, WarningState, Coordinates, LocationPoint, GpsQuality, MapFeature, ViewMode } from './types';
import { speak } from './services/ttsService';
import { getDrivingRoute } from './services/routeService';
import { fetchRealSpeedLimit, saveUserSpeedMarker } from './services/speedLimitService';
import { fetchNearbyMapFeatures } from './services/mapFeaturesService';
import { askTrafficLawAssistant } from './services/geminiService';

// --- MATH HELPERS FOR BEARING CALCULATION ---
const toRad = (deg: number) => deg * (Math.PI / 180);
const toDeg = (rad: number) => rad * (180 / Math.PI);

const getBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
  const startLatRad = toRad(startLat);
  const startLngRad = toRad(startLng);
  const destLatRad = toRad(destLat);
  const destLngRad = toRad(destLng);

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
        Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  let brng = Math.atan2(y, x);
  brng = toDeg(brng);
  return (brng + 360) % 360;
};

const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  var R = 6371000; 
  var dLat = (lat2 - lat1) * (Math.PI / 180);
  var dLon = (lon2 - lon1) * (Math.PI / 180);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d;
};

const calculateRouteLength = (path: Coordinates[]) => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += getDistanceFromLatLonInM(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
  }
  return total;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Setup);
  const [viewMode, setViewMode] = useState<ViewMode>('heading-up'); 

  const [currentSpeed, setCurrentSpeed] = useState(0);
  
  // Speed Limit Logic
  const [finalSpeedLimit, setFinalSpeedLimit] = useState<number | null>(null);
  const [autoSpeedLimit, setAutoSpeedLimit] = useState<number | null>(null);
  const [isUserSaved, setIsUserSaved] = useState(false); 
  const [manualSpeedLimit, setManualSpeedLimit] = useState<number | null>(null);
  
  const [position, setPosition] = useState<Coordinates>({ lat: 10.7769, lng: 106.7009 });
  const [heading, setHeading] = useState(0);
  
  const [routeInfo, setRouteInfo] = useState({ street: 'Đang xác định...', nextTurn: 0 });
  const [routePath, setRoutePath] = useState<Coordinates[] | undefined>(undefined);
  
  const [traveledPath, setTraveledPath] = useState<Coordinates[]>([]);
  const [remainingPath, setRemainingPath] = useState<Coordinates[]>([]);
  const [traveledDistance, setTraveledDistance] = useState(0); 
  const [remainingDistance, setRemainingDistance] = useState(0); 
  
  const [routeProgress, setRouteProgress] = useState(0); 
  const [totalDistance, setTotalDistance] = useState(0); 

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [warning, setWarning] = useState<WarningState>({ type: null, message: '', active: false });
  const [gpsStatus, setGpsStatus] = useState<GpsQuality>('seeking');
  const [mapFeatures, setMapFeatures] = useState<MapFeature[]>([]);

  // AI Assistant State
  const [isListening, setIsListening] = useState(false); // Trạng thái đang nghe lệnh (Wake word hoặc Query)
  const [isAiActive, setIsAiActive] = useState(false);   // Trạng thái AI đã được bật (chờ câu hỏi)
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const lastLimitUpdatePos = useRef<Coordinates | null>(null);
  const lastFeatureUpdatePos = useRef<Coordinates | null>(null);

  // Geo Location Tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading: gpsHeading } = pos.coords;
        setPosition({ lat: latitude, lng: longitude });
        setGpsStatus('locked');
        setCurrentSpeed(Math.max(0, (speed || 0) * 3.6)); 
        if (gpsHeading !== null && !isNaN(gpsHeading)) setHeading(gpsHeading);
      },
      () => setGpsStatus('seeking'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // --- WAKE WORD & VOICE LOGIC ---
  useEffect(() => {
    // Chỉ khởi tạo nhận diện giọng nói khi đang lái xe
    if (appState !== AppState.Driving) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true; // Nghe liên tục
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = async (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();
        console.log("Nghe thấy:", transcript);

        // LOGIC WAKE WORD
        // 1. Lệnh BẬT ("AI ON")
        if (transcript.includes("ai on") || transcript.includes("bật ai") || transcript.includes("trợ lý")) {
             if (!isAiActive) {
                 setIsAiActive(true);
                 setAiResponse("Tôi đang nghe...");
                 speak("Tôi đang nghe");
             }
             return;
        }

        // 2. Lệnh TẮT ("AI OFF")
        if (transcript.includes("ai off") || transcript.includes("tắt ai") || transcript.includes("thôi")) {
             setIsAiActive(false);
             setAiResponse(null);
             speak("Đã tắt trợ lý");
             window.speechSynthesis.cancel();
             return;
        }

        // 3. XỬ LÝ CÂU HỎI (Chỉ khi AI Active)
        if (isAiActive && !isProcessingAi) {
             // Bỏ qua các từ khóa ngắn hoặc nhiễu
             if (transcript.length < 5) return;

             setIsProcessingAi(true);
             try {
                const answer = await askTrafficLawAssistant(transcript);
                setAiResponse(answer);
                speak(answer);
             } catch (e) {
                 speak("Có lỗi kết nối.");
             } finally {
                 setIsProcessingAi(false);
                 // Sau khi trả lời xong, vẫn giữ Active để hỏi tiếp, hoặc có thể tắt tùy logic
             }
        }
    };

    recognition.onerror = (event: any) => {
        // Tự động restart nếu lỗi (để duy trì nghe wake word)
        if (event.error === 'no-speech') return;
        console.error("Speech error", event.error);
    };

    recognition.onend = () => {
        // Tự động khởi động lại để nghe liên tục (Always Listening Loop)
        if (appState === AppState.Driving) {
             try {
                 recognition.start();
             } catch(e) {}
        } else {
             setIsListening(false);
        }
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
    } catch(e) {}

    return () => {
        if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [appState, isAiActive, isProcessingAi]);

  // Nút bấm thủ công (Manual Toggle)
  const toggleAiAssistant = () => {
      if (isAiActive) {
          setIsAiActive(false);
          setAiResponse(null);
          speak("Đã tắt");
          window.speechSynthesis.cancel();
      } else {
          setIsAiActive(true);
          setAiResponse("Tôi đang nghe...");
          speak("Tôi đang nghe");
          // Đảm bảo recognition đang chạy
          if (recognitionRef.current && !isListening) {
              try { recognitionRef.current.start(); } catch(e){}
          }
      }
  };

  const closeAiModal = () => {
      setAiResponse(null);
      setIsAiActive(false);
      window.speechSynthesis.cancel(); 
  };


  // --- LOGIC HỢP NHẤT SPEED LIMIT ---
  useEffect(() => {
    if (manualSpeedLimit !== null) {
        setFinalSpeedLimit(manualSpeedLimit);
    } else {
        setFinalSpeedLimit(autoSpeedLimit);
    }
  }, [manualSpeedLimit, autoSpeedLimit]);

  // Handle Manual Override Click
  const cycleSpeedLimit = () => {
    const limits = [50, 60, 80, 90, 100, 120, null]; 
    const currentVal = manualSpeedLimit !== null ? manualSpeedLimit : (autoSpeedLimit || 50);
    let nextIndex = limits.indexOf(currentVal) + 1;
    if (nextIndex >= limits.length) nextIndex = 0;
    
    const nextLimit = limits[nextIndex];
    setManualSpeedLimit(nextLimit);

    if (nextLimit) {
        speak(`Đã đặt ${nextLimit}`);
        saveUserSpeedMarker(position.lat, position.lng, heading, nextLimit, routeInfo.street);
        setIsUserSaved(true); 
    } else {
        speak("Chế độ tự động");
        setManualSpeedLimit(null);
    }
  };

  // Route Calculation ... (Existing code)
  useEffect(() => {
    if (appState === AppState.Driving && routePath && routePath.length > 0) {
      let minDistance = Infinity;
      let closestIndex = 0;

      for (let i = 0; i < routePath.length; i++) {
        const d = getDistanceFromLatLonInM(position.lat, position.lng, routePath[i].lat, routePath[i].lng);
        if (d < minDistance) {
          minDistance = d;
          closestIndex = i;
        }
      }

      const tPath = routePath.slice(0, closestIndex + 1);
      const rPath = routePath.slice(closestIndex);

      setTraveledPath(tPath);
      setRemainingPath(rPath);

      const tDist = calculateRouteLength(tPath);
      const rDist = calculateRouteLength(rPath);

      setTraveledDistance(tDist);
      setRemainingDistance(rDist);
      
      if (totalDistance > 0) {
        const currentTotal = tDist + rDist;
        setRouteProgress(Math.min(1, Math.max(0, tDist / currentTotal)));
        setTotalDistance(currentTotal);
      }
      
      setRouteInfo(prev => ({ ...prev, nextTurn: Math.round(rDist) }));
    }
  }, [position, routePath, appState]);

  // API Updates
  useEffect(() => {
    if (gpsStatus !== 'locked' || appState !== AppState.Driving) return;

    const updateDrivingData = async () => {
      if (!lastLimitUpdatePos.current || 
          getDistanceFromLatLonInM(position.lat, position.lng, lastLimitUpdatePos.current.lat, lastLimitUpdatePos.current.lng) > 30) {
        
        lastLimitUpdatePos.current = position;
        const result = await fetchRealSpeedLimit(position.lat, position.lng, heading);
        
        if (result.limit !== null) {
            setAutoSpeedLimit(result.limit);
            setIsUserSaved(result.source === 'user'); 
            
            if (result.roadName) {
                setRouteInfo(prev => ({...prev, street: result.roadName!}));
            }
        }
      }

      if (!lastFeatureUpdatePos.current || 
          getDistanceFromLatLonInM(position.lat, position.lng, lastFeatureUpdatePos.current.lat, lastFeatureUpdatePos.current.lng) > 300) {
          
          lastFeatureUpdatePos.current = position;
          const features = await fetchNearbyMapFeatures(position.lat, position.lng);
          setMapFeatures(features);
      }
    };

    const timer = setTimeout(updateDrivingData, 1000);
    return () => clearTimeout(timer);
  }, [position, gpsStatus, appState, heading]);

  // Speed Warning
  useEffect(() => {
    if (appState !== AppState.Driving) return;
    
    if (finalSpeedLimit !== null && currentSpeed > finalSpeedLimit + 2) {
       if (!warning.active || warning.type !== 'speed') {
           setWarning({ type: 'speed', message: 'GIẢM TỐC ĐỘ', active: true });
           speak(`Bạn đang đi quá tốc độ ${finalSpeedLimit}`);
       }
    } else {
       if (warning.active && warning.type === 'speed') {
           setWarning({ type: null, message: '', active: false });
       }
    }
  }, [currentSpeed, finalSpeedLimit, appState, warning.active]);

  const nearestFeature = useMemo(() => {
    if (mapFeatures.length === 0) return null;
    let minDistance = Infinity;
    let nearest: { type: 'traffic_light' | 'camera', distance: number } | null = null;

    mapFeatures.forEach(feature => {
      const dist = getDistanceFromLatLonInM(position.lat, position.lng, feature.lat, feature.lng);
      if (dist < minDistance && dist < 1000) {
        minDistance = dist;
        nearest = { type: feature.type, distance: Math.round(dist) };
      }
    });
    
    if (nearest && nearest.distance < 300 && nearest.distance > 250) {
        if (nearest.type === 'camera') speak("Sắp có camera giám sát.");
        if (nearest.type === 'traffic_light') speak("Sắp đến đèn giao thông.");
    }

    return nearest;
  }, [position, mapFeatures]);

  const handleStartNavigation = useCallback(async (start: LocationPoint | null, end: LocationPoint | null) => {
    if (!start || !end) {
        setAppState(AppState.Driving);
        return;
    }
    setIsAnalyzing(true);
    speak("Đang tính toán lộ trình.");
    try {
      const { path } = await getDrivingRoute(start, end);
      setRoutePath(path);
      
      const totalDist = calculateRouteLength(path);
      setTotalDistance(totalDist);
      setRemainingDistance(totalDist);
      setTraveledDistance(0);
      setRemainingPath(path);
      setTraveledPath([path[0]]);
      setRouteProgress(0);

      setAppState(AppState.Driving);
      setIsAnalyzing(false);
    } catch (e) {
      console.error("Lỗi dẫn đường:", e);
      setAppState(AppState.Driving);
      setIsAnalyzing(false);
    }
  }, []);

  const displayHeading = useMemo(() => {
    if (appState === AppState.Driving && remainingPath.length > 1) {
        const targetPoint = remainingPath[Math.min(2, remainingPath.length - 1)];
        if (targetPoint) {
            return getBearing(position.lat, position.lng, targetPoint.lat, targetPoint.lng);
        }
    }
    return heading;
  }, [appState, remainingPath, position, heading]);

  const toggleViewMode = () => {
    setViewMode(prev => {
        if (prev === 'heading-up') return 'direct-view';
        if (prev === 'direct-view') return 'north-up';
        return 'heading-up';
    });
  };

  const getViewModeIcon = () => {
    switch (viewMode) {
        case 'heading-up': return <Navigation2 size={24} fill="currentColor" />;
        case 'direct-view': return <ScanEye size={24} />;
        case 'north-up': return <Compass size={24} />;
    }
  };

  return (
    <div className="iphone-12-pro-container flex flex-col font-sans bg-gray-200">
      {appState === AppState.Setup && (
        <NavigationSetup 
          onStartNavigation={handleStartNavigation} 
          isAnalyzing={isAnalyzing}
          currentLocation={gpsStatus === 'locked' ? position : null} 
        />
      )}

      {appState === AppState.Driving && (
        <>
          <div className="flex-1 relative z-0">
            <MapDisplay 
              position={position} 
              heading={displayHeading} 
              traveledPath={traveledPath}
              remainingPath={remainingPath}
              traveledDistance={traveledDistance}
              remainingDistance={remainingDistance}
              features={mapFeatures}
              viewMode={viewMode}
            />
          </div>

          <Dashboard 
            currentSpeed={currentSpeed} 
            speedLimit={finalSpeedLimit} 
            warning={warning}
            nextTurnDistance={routeInfo.nextTurn}
            streetName={routeInfo.street}
            gpsStatus={gpsStatus}
            heading={displayHeading}
            nearestFeature={nearestFeature}
            routeProgress={routeProgress}
            totalDistance={totalDistance}
            showProgressBar={!!routePath}
            isManualMode={manualSpeedLimit !== null || isUserSaved} 
            onSpeedLimitClick={cycleSpeedLimit}
            // Pass AI props for Dashboard to display the response text
            aiResponse={aiResponse}
            onCloseAi={closeAiModal}
          />

          {/* RIGHT SIDE CONTROLS STACK */}
          <div className="absolute top-[calc(env(safe-area-inset-top)+60px)] right-4 z-[1001] flex flex-col space-y-3">
            
            {/* 1. Stop Navigation */}
            <button 
              onClick={() => { 
                setAppState(AppState.Setup); 
                setRoutePath(undefined);
                if (recognitionRef.current) recognitionRef.current.stop();
              }} 
              className="bg-white/90 text-rose-600 p-3 rounded-full shadow-lg border border-gray-200 active:scale-90 transition-transform"
            >
              <Square size={24} fill="currentColor" />
            </button>
            
            {/* 2. View Mode */}
            <button 
              onClick={toggleViewMode}
              className={`p-3 rounded-full shadow-lg border border-gray-200 active:scale-90 transition-transform flex items-center justify-center ${viewMode === 'direct-view' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white/90 text-blue-600'}`}
            >
              {getViewModeIcon()}
            </button>

            {/* 3. AI Traffic Assistant (Mic) */}
            <button 
                onClick={toggleAiAssistant}
                className={`p-3 rounded-full shadow-lg border border-gray-200 active:scale-90 transition-transform flex items-center justify-center relative
                ${isAiActive 
                    ? 'bg-rose-500 text-white border-rose-600 animate-pulse ring-4 ring-rose-500/30' 
                    : isProcessingAi 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-white/90 text-indigo-600'
                }`}
            >
                {isProcessingAi ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
                
                {/* Badge ON/OFF status text */}
                <div className="absolute right-full mr-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAiActive ? "AI ON" : "AI OFF"}
                </div>
            </button>

          </div>
        </>
      )}
    </div>
  );
};

export default App;
