
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Square, Compass, Navigation2, ScanEye } from 'lucide-react';
import { MapDisplay } from './components/MapDisplay';
import { Dashboard } from './components/Dashboard';
import { NavigationSetup } from './components/NavigationSetup';
import { AppState, WarningState, Coordinates, LocationPoint, GpsQuality, MapFeature, ViewMode } from './types';
import { speak } from './services/ttsService';
import { getDrivingRoute } from './services/routeService';
import { fetchRealSpeedLimit } from './services/speedLimitService';
import { fetchNearbyMapFeatures } from './services/mapFeaturesService';

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

// Hàm tính tổng chiều dài lộ trình (dựa trên danh sách toạ độ)
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
  const [speedLimit, setSpeedLimit] = useState<number | null>(null); // Null = Không có dữ liệu thực tế
  const [position, setPosition] = useState<Coordinates>({ lat: 10.7769, lng: 106.7009 });
  const [heading, setHeading] = useState(0);
  
  const [routeInfo, setRouteInfo] = useState({ street: 'Lái xe an toàn', nextTurn: 0 });
  const [routePath, setRoutePath] = useState<Coordinates[] | undefined>(undefined);
  
  // State mới để chia tách quãng đường
  const [traveledPath, setTraveledPath] = useState<Coordinates[]>([]);
  const [remainingPath, setRemainingPath] = useState<Coordinates[]>([]);
  const [traveledDistance, setTraveledDistance] = useState(0); // mét
  const [remainingDistance, setRemainingDistance] = useState(0); // mét
  
  const [routeProgress, setRouteProgress] = useState(0); // 0 -> 1 (0% -> 100%)
  const [totalDistance, setTotalDistance] = useState(0); // Mét

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [warning, setWarning] = useState<WarningState>({ type: null, message: '', active: false });
  const [gpsStatus, setGpsStatus] = useState<GpsQuality>('seeking');
  const [mapFeatures, setMapFeatures] = useState<MapFeature[]>([]);

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

  // Tính toán tiến độ di chuyển và chia tách lộ trình
  useEffect(() => {
    if (appState === AppState.Driving && routePath && routePath.length > 0) {
      // Tìm điểm gần nhất trên lộ trình so với vị trí hiện tại
      let minDistance = Infinity;
      let closestIndex = 0;

      for (let i = 0; i < routePath.length; i++) {
        const d = getDistanceFromLatLonInM(position.lat, position.lng, routePath[i].lat, routePath[i].lng);
        if (d < minDistance) {
          minDistance = d;
          closestIndex = i;
        }
      }

      // 1. Tách mảng toạ độ
      // Đoạn đã đi: Từ đầu đến điểm gần nhất (bao gồm cả điểm hiện tại để nối liền mạch)
      const tPath = routePath.slice(0, closestIndex + 1);
      // Đoạn còn lại: Từ điểm gần nhất đến cuối
      const rPath = routePath.slice(closestIndex);

      setTraveledPath(tPath);
      setRemainingPath(rPath);

      // 2. Tính khoảng cách
      const tDist = calculateRouteLength(tPath);
      const rDist = calculateRouteLength(rPath);

      setTraveledDistance(tDist);
      setRemainingDistance(rDist);
      
      // 3. Cập nhật progress bar
      if (totalDistance > 0) {
        // Cập nhật lại totalDistance dựa trên tổng 2 đoạn để chính xác nhất
        const currentTotal = tDist + rDist;
        setRouteProgress(Math.min(1, Math.max(0, tDist / currentTotal)));
        setTotalDistance(currentTotal);
      }
      
      setRouteInfo(prev => ({ ...prev, nextTurn: Math.round(rDist) }));
    }
  }, [position, routePath, appState]);

  // API Updates (Speed Limit & Features)
  useEffect(() => {
    if (gpsStatus !== 'locked' || appState !== AppState.Driving) return;

    const updateDrivingData = async () => {
      // 1. Cập nhật giới hạn tốc độ (mỗi 50m di chuyển) - Dữ liệu thực tế
      if (!lastLimitUpdatePos.current || 
          Math.abs(position.lat - lastLimitUpdatePos.current.lat) > 0.0005 || 
          Math.abs(position.lng - lastLimitUpdatePos.current.lng) > 0.0005) {
        
        lastLimitUpdatePos.current = position;
        const limit = await fetchRealSpeedLimit(position.lat, position.lng);
        setSpeedLimit(limit);
        
        if (limit && limit !== speedLimit && speedLimit !== null) {
             if (limit < speedLimit) speak(`Giới hạn tốc độ ${limit} ki lô mét trên giờ.`);
        }
      }

      // 2. Cập nhật map features (mỗi 300m di chuyển)
      if (!lastFeatureUpdatePos.current || 
          Math.abs(position.lat - lastFeatureUpdatePos.current.lat) > 0.003 || 
          Math.abs(position.lng - lastFeatureUpdatePos.current.lng) > 0.003) {
          
          lastFeatureUpdatePos.current = position;
          const features = await fetchNearbyMapFeatures(position.lat, position.lng);
          setMapFeatures(features);
      }
    };

    const timer = setTimeout(updateDrivingData, 1000);
    return () => clearTimeout(timer);
  }, [position, gpsStatus, appState, speedLimit]);

  // Cảnh báo quá tốc độ
  useEffect(() => {
    if (appState !== AppState.Driving) return;
    
    // Chỉ cảnh báo nếu CÓ dữ liệu giới hạn tốc độ thực tế (speedLimit !== null)
    if (speedLimit !== null && currentSpeed > speedLimit + 2) {
       if (!warning.active || warning.type !== 'speed') {
           setWarning({ type: 'speed', message: 'GIẢM TỐC ĐỘ', active: true });
           speak(`Bạn đang đi quá tốc độ ${speedLimit}`);
       }
    } else {
       if (warning.active && warning.type === 'speed') {
           setWarning({ type: null, message: '', active: false });
       }
    }
  }, [currentSpeed, speedLimit, appState, warning.active]);

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
      
      // Init các giá trị ban đầu
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

  // --- LOGIC TÍNH TOÁN HƯỚNG HIỂN THỊ (QUAN TRỌNG) ---
  // Nếu đang lái xe và có lộ trình (remainingPath), hãy dùng hướng của đoạn đường tiếp theo (Course Up)
  // Nếu không, dùng hướng la bàn GPS (Heading Up)
  const displayHeading = useMemo(() => {
    if (appState === AppState.Driving && remainingPath.length > 1) {
        // Lấy điểm tiếp theo trên lộ trình để tính hướng (Look ahead)
        // Dùng index 1 hoặc 2 để có hướng ổn định hơn
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
            speedLimit={speedLimit} 
            warning={warning}
            nextTurnDistance={routeInfo.nextTurn}
            streetName={routeInfo.street}
            gpsStatus={gpsStatus}
            heading={displayHeading}
            nearestFeature={nearestFeature}
            routeProgress={routeProgress}
            totalDistance={totalDistance}
            showProgressBar={!!routePath}
          />

          <div className="absolute top-[calc(env(safe-area-inset-top)+60px)] right-4 z-[1001] flex flex-col space-y-3">
            <button 
              onClick={() => { setAppState(AppState.Setup); setRoutePath(undefined); }} 
              className="bg-white/90 text-rose-600 p-3 rounded-full shadow-lg border border-gray-200 active:scale-90 transition-transform"
            >
              <Square size={24} fill="currentColor" />
            </button>
            
            <button 
              onClick={toggleViewMode}
              className={`p-3 rounded-full shadow-lg border border-gray-200 active:scale-90 transition-transform flex items-center justify-center ${viewMode === 'direct-view' ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white/90 text-blue-600'}`}
            >
              {getViewModeIcon()}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
