
import { Coordinates } from '../types';

export const getDrivingRoute = async (start: Coordinates, end: Coordinates): Promise<{path: Coordinates[], raw: any}> => {
  try {
    // Thêm alternatives=true để lấy nhiều phương án
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=true&steps=true`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error("Không tìm thấy lộ trình");
    }

    return {
      path: data.routes[0].geometry.coordinates.map((coord: number[]) => ({
        lat: coord[1],
        lng: coord[0]
      })),
      raw: data.routes
    };
  } catch (error) {
    console.error("Failed to fetch route:", error);
    throw error;
  }
};
