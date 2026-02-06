
import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, MapFeature, ViewMode } from '../types';

declare const L: any;

interface MapDisplayProps {
  position: Coordinates;
  heading: number;
  traveledPath?: Coordinates[];
  remainingPath?: Coordinates[];
  traveledDistance?: number; // mét
  remainingDistance?: number; // mét
  features?: MapFeature[];
  viewMode: ViewMode;
}

const formatKm = (m: number) => (m / 1000).toFixed(1).replace('.', ',') + ' km';

export const MapDisplay: React.FC<MapDisplayProps> = ({ 
  position, heading, 
  traveledPath = [], remainingPath = [], 
  traveledDistance = 0, remainingDistance = 0,
  features = [], viewMode 
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const featureLayer = useRef<any>(null);
  const labelLayer = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // 1. Khởi tạo bản đồ (Chạy 1 lần)
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return;

    try {
      // Force style override for width/height directly on the element to combat CSS specificity if needed
      mapContainer.current.style.setProperty('width', '300vmax', 'important');
      mapContainer.current.style.setProperty('height', '300vmax', 'important');

      const m = L.map(mapContainer.current, {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: false, 
        fadeAnimation: false,
        markerZoomAnimation: false,
        dragging: false, 
        scrollWheelZoom: "center",
        doubleClickZoom: "center",
        touchZoom: "center"
      }).setView([position.lat, position.lng], 18);

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2', {
        maxZoom: 22,
        tileSize: 512, 
        zoomOffset: -1,
        detectRetina: true,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(m);

      // --- RED CAR ICON DESIGN ---
      const navIcon = L.divIcon({
        className: 'nav-icon',
        html: `
          <div style="transform: rotate(${heading}deg); transition: transform 0.1s linear; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.5));">
             <svg width="70" height="70" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="42" fill="white" fill-opacity="0.15" />
                <path d="M34 20 C34 10, 66 10, 66 20 L 68 82 C 68 90, 32 90, 32 82 Z" fill="#ef4444" stroke="white" stroke-width="2" stroke-linejoin="round"/>
                <path d="M35 22 C35 22, 50 18, 65 22" stroke="rgba(0,0,0,0.1)" stroke-width="2"/>
                <path d="M36 30 L 64 30 L 62 42 L 38 42 Z" fill="#bfdbfe" />
                <path d="M38 45 L 62 45 L 62 60 L 38 60 Z" fill="#b91c1c" />
                <path d="M39 63 L 61 63 L 63 72 L 37 72 Z" fill="#450a0a" />
                <path d="M35 16 Q 37 12, 41 16" stroke="#fef08a" stroke-width="3" stroke-linecap="round" />
                <path d="M65 16 Q 63 12, 59 16" stroke="#fef08a" stroke-width="3" stroke-linecap="round" />
                <path d="M36 86 L 44 86" stroke="#f87171" stroke-width="3" stroke-linecap="round" />
                <path d="M56 86 L 64 86" stroke="#f87171" stroke-width="3" stroke-linecap="round" />
            </svg>
          </div>
        `,
        iconSize: [70, 70],
        iconAnchor: [35, 35]
      });

      marker.current = L.marker([position.lat, position.lng], { icon: navIcon, zIndexOffset: 2000 }).addTo(m);
      
      routeLayer.current = L.layerGroup().addTo(m);
      featureLayer.current = L.layerGroup().addTo(m);
      labelLayer.current = L.layerGroup().addTo(m);

      map.current = m;
      setMapLoaded(true);
    } catch (err) {
      console.error("Map init error", err);
    }

    return () => {
       if (map.current) {
         map.current.remove();
         map.current = null;
       }
    };
  }, []);

  // 2. Render Features
  useEffect(() => {
    if (!map.current || !mapLoaded || !featureLayer.current) return;
    featureLayer.current.clearLayers();

    features.forEach(feature => {
      let iconHtml = '';
      if (feature.type === 'traffic_light') {
        iconHtml = `
          <div style="background: white; border-radius: 8px; border: 2px solid #555; width: 20px; height: 36px; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <div style="width: 6px; height: 6px; background: #ff4444; border-radius: 50%;"></div>
            <div style="width: 6px; height: 6px; background: #ffbb33; border-radius: 50%;"></div>
            <div style="width: 6px; height: 6px; background: #00C851; border-radius: 50%;"></div>
          </div>
        `;
      } else {
        iconHtml = `
          <div style="background: #333; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
              <circle cx="12" cy="13" r="3"></circle>
            </svg>
          </div>
        `;
      }

      const rotation = viewMode === 'heading-up' ? heading : 0;
      const icon = L.divIcon({
        className: 'custom-feature-icon',
        html: `<div style="transform: rotate(${rotation}deg); transition: transform 0.2s linear;">${iconHtml}</div>`,
        iconSize: feature.type === 'traffic_light' ? [20, 36] : [28, 28],
        iconAnchor: feature.type === 'traffic_light' ? [10, 36] : [14, 28]
      });

      L.marker([feature.lat, feature.lng], { icon: icon }).addTo(featureLayer.current);
    });
  }, [features, mapLoaded, heading, viewMode]);

  // 3. Render Route Split (Traveled vs Remaining) with Labels
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeLayer.current || !labelLayer.current) return;
    routeLayer.current.clearLayers();
    labelLayer.current.clearLayers();

    // 3.1 Draw Traveled Path (GREEN - #10b981)
    if (traveledPath.length > 0) {
      const latlngs = traveledPath.map(p => [p.lat, p.lng]);
      L.polyline(latlngs, { color: '#065f46', weight: 14, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer.current);
      L.polyline(latlngs, { color: '#10b981', weight: 10, opacity: 1.0, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer.current);
      
      // Label Điểm Xuất Phát (Start Point)
      const startPoint = traveledPath[0];
      const startIcon = L.divIcon({
        className: 'map-label-start',
        html: `<div style="background: #10b981; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.5); transform: rotate(${viewMode === 'heading-up' ? heading : 0}deg);">Đã đi: ${formatKm(traveledDistance)}</div>`,
        iconSize: [100, 30],
        iconAnchor: [50, -50] 
      });
      L.marker([startPoint.lat, startPoint.lng], { icon: startIcon }).addTo(labelLayer.current);
    }

    // 3.2 Draw Remaining Path (BLUE - #3b82f6)
    if (remainingPath.length > 0) {
      const latlngs = remainingPath.map(p => [p.lat, p.lng]);
      L.polyline(latlngs, { color: '#1e3a8a', weight: 14, opacity: 0.8, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer.current);
      L.polyline(latlngs, { color: '#3b82f6', weight: 10, opacity: 1.0, lineJoin: 'round', lineCap: 'round' }).addTo(routeLayer.current);

      // Label Điểm Đích (Destination)
      const endPoint = remainingPath[remainingPath.length - 1];
      const endIcon = L.divIcon({
        className: 'map-label-end',
        html: `<div style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.5); transform: rotate(${viewMode === 'heading-up' ? heading : 0}deg);">Còn: ${formatKm(remainingDistance)}</div>`,
        iconSize: [100, 30],
        iconAnchor: [50, -20]
      });
      L.marker([endPoint.lat, endPoint.lng], { icon: endIcon }).addTo(labelLayer.current);
    }

  }, [traveledPath, remainingPath, mapLoaded, heading, viewMode, traveledDistance, remainingDistance]);

  // 4. Update Position & Rotation
  useEffect(() => {
    if (!map.current || !marker.current || !mapLoaded) return;
    
    marker.current.setLatLng([position.lat, position.lng]);
    map.current.panTo([position.lat, position.lng], { animate: false });

    const iconElement = marker.current.getElement();
    if (iconElement) {
      const div = iconElement.querySelector('div');
      if (div) div.style.transform = `rotate(${heading}deg)`;
    }
  }, [position, heading, mapLoaded]);

  // UPDATE: Giảm translateY từ 25vh xuống 16vh để nâng vị trí xe lên cao hơn, tránh đè vào ruler
  const containerTransform = viewMode === 'heading-up' 
    ? `translate(-50%, -50%) translateY(16vh) rotate(${-heading}deg)`
    : `translate(-50%, -50%) rotate(0deg)`;

  return (
    <div className="w-full h-full relative bg-[#1f2937] overflow-hidden">
      <div 
        ref={mapContainer} 
        className="z-0"
        style={{ 
            width: '300vmax', 
            height: '300vmax',
            position: 'absolute',
            top: '50%',
            left: '50%',
            transformOrigin: 'center center',
            transform: containerTransform,
            transition: 'transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)', 
            willChange: 'transform'
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-slate-950/80 to-transparent pointer-events-none z-10"></div>
    </div>
  );
};
