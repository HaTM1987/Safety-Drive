
// Dữ liệu cứng các tuyến đường huyết mạch tại VN có tốc độ cố định (Dùng làm fallback chung)
const KNOWN_ROADS_REGISTRY: { [key: string]: number } = {
    // --- CAO TỐC ---
    "cao toc ha noi hai phong": 120,
    "cao toc phap van cau gie": 100,
    "cao toc cau gie ninh binh": 120,
    "cao toc ha noi lao cai": 100,
    "cao toc long thanh dau giay": 120,
    "cao toc dau giay phan thiet": 120,
    "cao toc trung luong my thuan": 90,
    "ct01": 120,
    "ct.01": 120,
    "ct05": 100,
    
    // --- TP. HỒ CHÍ MINH ---
    "pham van dong": 80, 
    "vo van kiet": 60,
    "mai chi tho": 80,
    "xa lo ha noi": 80,
    "vo nguyen giap": 80,
    "nguyen van linh": 80, 
    "quoc lo 1a": 60, 
    "quoc lo 13": 60,
    "quoc lo 22": 60,
    "nguyen huu tho": 60,
    "huynh tan phat": 60,
    "dien bien phu": 60,
    
    // --- HÀ NỘI ---
    "vo chi cong": 80,
    "vo nguyen giap (hn)": 90, 
    "thang long": 90, 
    "vanh dai 3": 80, 
    "phap van": 100,
    "pham hung": 60,
    "khuat duy tien": 60,
    "giai phong": 60,
};

// Key lưu trữ trong LocalStorage
const USER_MARKERS_KEY = 'safety_drive_user_markers';

// Interface cho điểm mốc tốc độ người dùng
interface SpeedMarker {
    lat: number;
    lng: number;
    heading: number; // Hướng di chuyển (quan trọng để phân biệt 2 chiều đường)
    speed: number;
    timestamp: number;
    roadName?: string;
}

// Hàm tính khoảng cách Haversine (mét)
const getDistanceFromLatLonInM = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Hàm chuẩn hóa chuỗi
const normalizeString = (str: string): string => {
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .trim();
};

// --- CÁC HÀM QUẢN LÝ BỘ NHỚ KHÔNG GIAN (SPATIAL MEMORY) ---

export const saveUserSpeedMarker = (lat: number, lng: number, heading: number, speed: number, roadName?: string) => {
    try {
        const savedData = localStorage.getItem(USER_MARKERS_KEY);
        let markers: SpeedMarker[] = savedData ? JSON.parse(savedData) : [];
        
        // 1. Dọn dẹp: Xóa các marker cũ quá gần vị trí này (bán kính 50m) để tránh trùng lặp
        markers = markers.filter(m => getDistanceFromLatLonInM(m.lat, m.lng, lat, lng) > 50);

        // 2. Thêm marker mới
        markers.push({
            lat,
            lng,
            heading,
            speed,
            roadName,
            timestamp: Date.now()
        });
        
        // Giới hạn lưu trữ tối đa 500 điểm để không nặng máy
        if (markers.length > 500) {
            markers = markers.slice(markers.length - 500);
        }
        
        localStorage.setItem(USER_MARKERS_KEY, JSON.stringify(markers));
        console.log(`[Memory] Đã cắm biển ảo ${speed}km/h tại [${lat}, ${lng}] hướng ${heading}`);
    } catch (e) {
        console.error("Lỗi lưu user marker", e);
    }
};

const findNearbyUserMarker = (lat: number, lng: number, currentHeading: number): SpeedMarker | null => {
    try {
        const savedData = localStorage.getItem(USER_MARKERS_KEY);
        if (!savedData) return null;
        
        const markers: SpeedMarker[] = JSON.parse(savedData);
        let closestMarker: SpeedMarker | null = null;
        let minDist = Infinity;

        // Bán kính tìm kiếm: 200m
        const SEARCH_RADIUS = 200; 

        for (const m of markers) {
            const dist = getDistanceFromLatLonInM(lat, lng, m.lat, m.lng);
            
            if (dist <= SEARCH_RADIUS) {
                // Kiểm tra hướng: Chỉ chấp nhận nếu hướng đi chênh lệch < 45 độ
                // Để tránh lấy nhầm biển báo của làn đường ngược chiều
                let angleDiff = Math.abs(m.heading - currentHeading);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;
                
                if (angleDiff < 45) {
                    if (dist < minDist) {
                        minDist = dist;
                        closestMarker = m;
                    }
                }
            }
        }
        
        return closestMarker;
    } catch (e) { return null; }
};

// --- HÀM CHÍNH ---

export const fetchRealSpeedLimit = async (lat: number, lng: number, heading: number): Promise<{ limit: number | null, source: 'osm' | 'registry' | 'user' | null, roadName?: string }> => {
  try {
    // --- BƯỚC 1: ƯU TIÊN TUYỆT ĐỐI CHO DỮ LIỆU NGƯỜI DÙNG (SPATIAL MARKERS) ---
    // Tìm xem có "biển báo ảo" nào gần đây không
    const userMarker = findNearbyUserMarker(lat, lng, heading);
    if (userMarker) {
        return { limit: userMarker.speed, source: 'user', roadName: userMarker.roadName };
    }

    // Nếu không có marker người dùng, tiếp tục tìm dữ liệu từ hệ thống (OSM/Registry)
    const query = `
      [out:json][timeout:2];
      way(around:20, ${lat}, ${lng})["highway"];
      out tags;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return { limit: null, source: null };
    
    const data = await response.json();
    const elements = data.elements || [];
    
    const validHighways = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified'];
    const ways = elements.filter((e: any) => validHighways.includes(e.tags.highway));
    
    const hierarchy: {[key: string]: number} = { 
        'motorway': 10, 'trunk': 9, 'primary': 8, 'secondary': 7, 
        'tertiary': 6, 'residential': 5 
    };
    ways.sort((a: any, b: any) => (hierarchy[b.tags.highway] || 0) - (hierarchy[a.tags.highway] || 0));
    
    if (ways.length === 0) return { limit: null, source: null };

    const bestWay = ways[0];
    const tags = bestWay.tags;
    const roadName = tags.name || "";

    // --- BƯỚC 2: KIỂM TRA TÊN ĐƯỜNG TRONG REGISTRY (HARD DATA) ---
    if (roadName) {
        const normalizedName = normalizeString(roadName);
        for (const [key, speed] of Object.entries(KNOWN_ROADS_REGISTRY)) {
            if (normalizedName.includes(key)) {
                return { limit: speed, source: 'registry', roadName };
            }
        }
    }

    // --- BƯỚC 3: DỮ LIỆU TỪ OSM ---
    if (tags.maxspeed) {
        if (tags.maxspeed === 'VN:urban') {
             const isDual = tags.dual_carriageway === 'yes' || tags.oneway === 'yes';
             return { limit: isDual ? 60 : 50, source: 'osm', roadName };
        }
        if (tags.maxspeed === 'VN:rural') {
             const isDual = tags.dual_carriageway === 'yes' || tags.oneway === 'yes';
             return { limit: isDual ? 90 : 80, source: 'osm', roadName };
        }

        const speedStr = tags.maxspeed.split(';')[0].replace(/[^\d]/g, '');
        const val = parseInt(speedStr);
        if (!isNaN(val)) return { limit: val, source: 'osm', roadName };
    }

    return { limit: null, source: null, roadName };

  } catch (error) {
    return { limit: null, source: null };
  }
};
