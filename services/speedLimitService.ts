
export const fetchRealSpeedLimit = async (lat: number, lng: number): Promise<number | null> => {
  try {
    // Truy vấn OSM xung quanh vị trí xe (bán kính 20m)
    // Chỉ lấy các con đường (way) có thẻ highway (đường giao thông)
    const query = `
      [out:json][timeout:4];
      way(around:20, ${lat}, ${lng})["highway"];
      out tags;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Connection Failed");
    
    const data = await response.json();
    const elements = data.elements || [];

    if (elements.length === 0) return null;

    // Lọc ra các loại đường hợp lệ cho xe ô tô
    const validHighways = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified'];
    const ways = elements.filter((e: any) => validHighways.includes(e.tags.highway));

    if (ways.length === 0) return null;

    // Chọn con đường gần nhất/quan trọng nhất (Ưu tiên đường lớn)
    const hierarchy = { 'motorway': 10, 'trunk': 9, 'primary': 8, 'secondary': 7, 'tertiary': 6, 'residential': 5 };
    ways.sort((a: any, b: any) => {
      const hA = (hierarchy as any)[a.tags.highway] || 0;
      const hB = (hierarchy as any)[b.tags.highway] || 0;
      return hB - hA;
    });

    const bestWay = ways[0];
    const tags = bestWay.tags;

    // --- LOGIC XỬ LÝ DỮ LIỆU THỰC TẾ (STRICT MODE) ---
    
    // 1. Ưu tiên cao nhất: Thẻ maxspeed (Biển báo cắm trên đường)
    if (tags.maxspeed) {
      // Xử lý các trường hợp đặc biệt như "50;40" (lấy max) hoặc "VN:urban"
      if (tags.maxspeed === 'VN:urban') return 60; // Theo luật VN mới (đường đôi) hoặc 50
      if (tags.maxspeed === 'VN:rural') return 90; // Theo luật VN mới (đường đôi) hoặc 80
      
      const speedStr = tags.maxspeed.split(';')[0].replace(/[^\d]/g, '');
      const speed = parseInt(speedStr);
      if (!isNaN(speed)) return speed;
    }

    // 2. Ưu tiên nhì: Thẻ maxspeed:lanes (Tốc độ theo làn đường)
    // Ví dụ: 60|60|50 (Làn sát dải phân cách nhanh hơn)
    // Vì GPS điện thoại không đủ chính xác để biết làn nào, ta lấy tốc độ CAO NHẤT cho phép trên đoạn đường đó
    if (tags['maxspeed:lanes']) {
        const laneSpeeds = tags['maxspeed:lanes']
            .split('|')
            .map((s: string) => parseInt(s.replace(/[^\d]/g, '')))
            .filter((n: number) => !isNaN(n));
        
        if (laneSpeeds.length > 0) {
            return Math.max(...laneSpeeds);
        }
    }

    // 3. Ưu tiên ba: Thẻ zone (Khu vực quy hoạch)
    // Nếu dữ liệu map định nghĩa rõ đây là khu đông dân cư
    if (tags['source:maxspeed'] === 'VN:urban' || tags['zone:traffic'] === 'VN:urban') {
        // Kiểm tra xem có dải phân cách không để trả về 60 hay 50
        const isDualCarriageway = tags.oneway === 'yes' || tags.dual_carriageway === 'yes';
        return isDualCarriageway ? 60 : 50;
    }
    
    if (tags['source:maxspeed'] === 'VN:rural' || tags['zone:traffic'] === 'VN:rural') {
        const isDualCarriageway = tags.oneway === 'yes' || tags.dual_carriageway === 'yes';
        return isDualCarriageway ? 90 : 80;
    }

    // Nếu không có bất kỳ dữ liệu cụ thể nào -> Trả về NULL (Hiển thị --)
    // Tuyệt đối không đoán (Interpolation)
    return null;

  } catch (error) {
    return null;
  }
};
