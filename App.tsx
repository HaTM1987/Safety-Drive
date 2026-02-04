
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Square } from 'lucide-react';
import { MapDisplay } from './components/MapDisplay';
import { Dashboard } from './components/Dashboard';
import { NavigationSetup } from './components/NavigationSetup';
import { AppState, WarningState, Coordinates, LocationPoint, GpsQuality, MapFeature } from './types';
import { MAX_SPEED_LIMIT } from './constants';
import { speak } from './services/ttsService';
import { getDrivingRoute } from './services/routeService';
import { fetchRealSpeedLimit } from './services/speedLimitService';
import { fetchNearbyMapFeatures } from './services/mapFeaturesService';

// Hàm tính khoảng cách giữa 2 điểm (Haversine) - đơn vị mét
const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  var R = 6371000; // Radius of the earth in m
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

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Setup);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [speedLimit, setSpeedLimit] = useState(MAX_SPEED_LIMIT);
  const [position, setPosition] = useState<Coordinates>({ lat: 10.7769, lng: 106.7009 });
  const [heading, setHeading] = useState(0);
  
  const [routeInfo, setRouteInfo] = useState({ street: 'Lái xe an toàn', nextTurn: 0 });
  const [routePath, setRoutePath] = useState<Coordinates[] | undefined>(undefined);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [warning, setWarning] = useState<WarningState>({ type: null, message: '', active: false });
  const [gpsStatus, setGpsStatus] = useState<GpsQuality>('seeking');
  const [mapFeatures, setMapFeatures] = useState<MapFeature[]>([]);

  const lastLimitUpdatePos = useRef<Coordinates | null>(null);
  const lastFeatureUpdatePos = useRef<Coordinates | null>(null);

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

  // Xử lý logic cập nhật dữ liệu khi di chuyển
  useEffect(() => {
    if (gpsStatus !== 'locked' || appState !== AppState.Driving) return;

    const updateDrivingData = async () => {
      // 1. Cập nhật giới hạn tốc độ (Check mỗi khi di chuyển > 50m)
      if (!lastLimitUpdatePos.current || 
          Math.abs(position.lat - lastLimitUpdatePos.current.lat) > 0.0005 || 
          Math.abs(position.lng - lastLimitUpdatePos.current.lng) > 0.0005) {
        
        lastLimitUpdatePos.current = position;
        const limit = await fetchRealSpeedLimit(position.lat, position.lng);
        if (limit && limit !== speedLimit) {
            setSpeedLimit(limit);
            if (limit < speedLimit) speak(`Giới hạn tốc độ ${limit} km/h.`);
        }
      }

      // 2. Cập nhật Map Features (Đèn, Camera) (Check mỗi khi di chuyển > 300m)
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
  }, [position, gpsStatus, appState]);

  // Tính toán vật thể gần nhất để hiển thị lên Dashboard
  const nearestFeature = useMemo(() => {
    if (mapFeatures.length === 0) return null;
    
    let minDistance = Infinity;
    let nearest: { type: 'traffic_light' | 'camera', distance: number } | null = null;

    mapFeatures.forEach(feature => {
      const dist = getDistanceFromLatLonInM(position.lat, position.lng, feature.lat, feature.lng);
      // Chỉ quan tâm vật thể phía trước (đơn giản hóa bằng bán kính < 500m)
      if (dist < minDistance && dist < 1000) {
        minDistance = dist;
        nearest = { type: feature.type, distance: Math.round(dist) };
      }
    });

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
      setAppState(AppState.Driving);
      setIsAnalyzing(false);
    } catch (e) {
      console.error("Lỗi dẫn đường:", e);
      setAppState(AppState.Driving);
      setIsAnalyzing(false);
    }
  }, []);

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
              heading={heading} 
              routePath={routePath}
              features={mapFeatures}
            />
          </div>

          <Dashboard 
            currentSpeed={currentSpeed} 
            speedLimit={speedLimit} 
            warning={warning}
            nextTurnDistance={routeInfo.nextTurn}
            streetName={routeInfo.street}
            gpsStatus={gpsStatus}
            heading={heading}
            nearestFeature={nearestFeature}
          />

          <div className="absolute top-[calc(env(safe-area-inset-top)+60px)] right-4 z-[1001]">
            <button 
              onClick={() => { setAppState(AppState.Setup); setRoutePath(undefined); }} 
              className="bg-white/90 text-rose-600 p-3 rounded-full shadow-lg border border-gray-200"
            >
              <Square size={20} fill="currentColor" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
