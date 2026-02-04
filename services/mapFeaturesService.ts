
import { MapFeature } from '../types';

export const fetchNearbyMapFeatures = async (lat: number, lng: number): Promise<MapFeature[]> => {
  try {
    // Tìm kiếm trong bán kính 1000m:
    // 1. node["highway"="traffic_signals"]: Đèn giao thông
    // 2. node["man_made"="surveillance"]: Camera giám sát
    // 3. node["highway"="speed_camera"]: Camera tốc độ
    const query = `
      [out:json][timeout:5];
      (
        node["highway"="traffic_signals"](around:1000, ${lat}, ${lng});
        node["man_made"="surveillance"](around:1000, ${lat}, ${lng});
        node["highway"="speed_camera"](around:1000, ${lat}, ${lng});
      );
      out body;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return data.elements.map((el: any) => {
      let type: 'traffic_light' | 'camera' = 'traffic_light';
      
      if (el.tags.man_made === 'surveillance' || el.tags.highway === 'speed_camera') {
        type = 'camera';
      }

      return {
        id: el.id.toString(),
        lat: el.lat,
        lng: el.lon,
        type: type
      };
    });
  } catch (error) {
    console.warn("Feature fetch error", error);
    return [];
  }
};
