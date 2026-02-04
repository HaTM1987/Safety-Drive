
import React, { useEffect, useRef, useState } from 'react';
import { Coordinates, MapFeature } from '../types';

declare const L: any;

interface MapDisplayProps {
  position: Coordinates;
  heading: number;
  routePath?: Coordinates[];
  features?: MapFeature[];
}

export const MapDisplay: React.FC<MapDisplayProps> = ({ position, heading, routePath, features = [] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const routeLayer = useRef<any>(null);
  const featureLayer = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // 1. Khởi tạo bản đồ (Chạy 1 lần)
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return;

    try {
      const m = L.map(mapContainer.current, {
        zoomControl: false,
        attributionControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      }).setView([position.lat, position.lng], 17);

      L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&scale=2', {
        maxZoom: 22,
        tileSize: 512, 
        zoomOffset: -1,
        detectRetina: true,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(m);

      // SVG Car Icon Design (Top-down view)
      const navIcon = L.divIcon({
        className: 'nav-icon',
        html: `
          <div style="transform: rotate(${heading}deg); transition: transform 0.2s linear; filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3));">
             <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Halo/Glow -->
                <circle cx="50" cy="50" r="42" fill="white" fill-opacity="0.2" />
                
                <!-- Car Body (Blue) -->
                <path d="M34 20 C34 10, 66 10, 66 20 L 68 82 C 68 90, 32 90, 32 82 Z" fill="#2563eb" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
                
                <!-- Hood Detail (Shadow) -->
                <path d="M35 22 C35 22, 50 18, 65 22" stroke="rgba(0,0,0,0.1)" stroke-width="2"/>

                <!-- Windshield (Light Blue) -->
                <path d="M36 30 L 64 30 L 62 42 L 38 42 Z" fill="#93c5fd" />
                
                <!-- Roof (Darker Blue) -->
                <path d="M38 45 L 62 45 L 62 60 L 38 60 Z" fill="#1d4ed8" />
                
                <!-- Rear Window (Navy) -->
                <path d="M39 63 L 61 63 L 63 72 L 37 72 Z" fill="#172554" />
                
                <!-- Headlights -->
                <path d="M35 16 Q 37 12, 41 16" stroke="#fef08a" stroke-width="3" stroke-linecap="round" />
                <path d="M65 16 Q 63 12, 59 16" stroke="#fef08a" stroke-width="3" stroke-linecap="round" />
                
                <!-- Taillights -->
                <path d="M36 86 L 44 86" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
                <path d="M56 86 L 64 86" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
            </svg>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30] // Center of the 60x60 icon
      });

      marker.current = L.marker([position.lat, position.lng], { icon: navIcon, zIndexOffset: 1000 }).addTo(m);
      
      routeLayer.current = L.layerGroup().addTo(m);
      featureLayer.current = L.layerGroup().addTo(m);

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

  // 2. Render Map Features (Traffic Lights & Cameras)
  useEffect(() => {
    if (!map.current || !mapLoaded || !featureLayer.current) return;

    featureLayer.current.clearLayers();

    features.forEach(feature => {
      let iconHtml = '';
      
      if (feature.type === 'traffic_light') {
        // Icon Đèn giao thông
        iconHtml = `
          <div style="background: white; border-radius: 8px; border: 2px solid #555; width: 24px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <div style="width: 8px; height: 8px; background: #ff4444; border-radius: 50%;"></div>
            <div style="width: 8px; height: 8px; background: #ffbb33; border-radius: 50%;"></div>
            <div style="width: 8px; height: 8px; background: #00C851; border-radius: 50%;"></div>
          </div>
        `;
      } else {
        // Icon Camera
        iconHtml = `
          <div style="background: #333; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
              <circle cx="12" cy="13" r="3"></circle>
            </svg>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: 'custom-feature-icon',
        html: iconHtml,
        iconSize: feature.type === 'traffic_light' ? [24, 40] : [32, 32],
        iconAnchor: feature.type === 'traffic_light' ? [12, 40] : [16, 32] // Anchor bottom-center
      });

      L.marker([feature.lat, feature.lng], { icon: icon }).addTo(featureLayer.current);
    });

  }, [features, mapLoaded]);

  // 3. Render Route
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeLayer.current) return;

    routeLayer.current.clearLayers();

    if (routePath && routePath.length > 0) {
      const latlngs = routePath.map(p => [p.lat, p.lng]);
      
      L.polyline(latlngs, {
        color: '#1557b0',
        weight: 10,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(routeLayer.current);

      const mainLine = L.polyline(latlngs, {
        color: '#4285F4',
        weight: 7,
        opacity: 1.0,
        lineJoin: 'round',
        lineCap: 'round'
      }).addTo(routeLayer.current);

      const bounds = mainLine.getBounds();
      if (bounds.isValid()) {
         map.current.fitBounds(bounds, { 
             padding: [50, 50],
             maxZoom: 17,
             animate: true
         });
      }
    }
  }, [routePath, mapLoaded]);

  // 4. Update Vehicle Position
  useEffect(() => {
    if (!map.current || !marker.current || !mapLoaded) return;
    marker.current.setLatLng([position.lat, position.lng]);
    const iconElement = marker.current.getElement();
    if (iconElement) {
      const svg = iconElement.querySelector('div');
      if (svg) svg.style.transform = `rotate(${heading}deg)`;
    }
    map.current.panTo([position.lat, position.lng], { animate: true, duration: 0.8 });
  }, [position, heading, mapLoaded]);

  return (
    <div className="w-full h-full relative bg-[#e5e7eb]">
      <div 
        ref={mapContainer} 
        className="w-full h-full z-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
