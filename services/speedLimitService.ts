
export const fetchRealSpeedLimit = async (lat: number, lng: number): Promise<number | null> => {
  try {
    // Tăng bán kính tìm kiếm lên 70m để bắt được đường ngay cả khi GPS lệch nhẹ
    // Lấy thông tin chi tiết về loại đường và maxspeed
    const query = `
      [out:json][timeout:4];
      way(around:70, ${lat}, ${lng})["highway"];
      out tags;
    `;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Connection Failed");
    
    const data = await response.json();

    if (data.elements && data.elements.length > 0) {
      // Tìm đường có thẻ maxspeed trước
      const waysWithSpeed = data.elements.filter((e: any) => e.tags.maxspeed);
      
      // Nếu tìm thấy đường có biển báo tốc độ, ưu tiên dùng ngay
      if (waysWithSpeed.length > 0) {
        const tags = waysWithSpeed[0].tags;
        const speedStr = tags.maxspeed.split(';')[0].replace(/[^\d]/g, ''); // Xử lý format lạ
        const speed = parseInt(speedStr);
        if (!isNaN(speed)) return speed;
      }

      // Nếu không có maxspeed, dùng đường gần nhất/đầu tiên tìm thấy để suy luận
      const tags = data.elements[0].tags;
      const highway = tags.highway;
      
      // Logic suy luận tốc độ theo Luật GTĐB Việt Nam (khi thiếu biển báo)
      if (highway === 'motorway') return 100; // Cao tốc
      if (highway === 'motorway_link') return 60; // Đường dẫn cao tốc
      
      if (highway === 'trunk') return 80; // Đường đôi/Quốc lộ lớn
      if (highway === 'primary') return 60; // Đường chính đô thị
      
      if (highway === 'secondary' || highway === 'tertiary') return 50; // Đường gom/Đường tỉnh
      
      // Khu dân cư, đường nhỏ
      if (highway === 'residential' || highway === 'living_street' || highway === 'service' || highway === 'unclassified') return 40;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

export const getVietnameseDefaultLimit = async (lat: number, lng: number): Promise<number> => {
    return 50; 
};
