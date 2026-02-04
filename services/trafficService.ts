
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface TrafficScore {
    routeIndex: number;
    score: number; // 1-10 (10 là kẹt nhất)
    reason: string;
}

export const getRealTimeTrafficAnalysis = async (routes: any[]): Promise<number> => {
  try {
    const routeData = routes.map((r, i) => {
        const streets = r.legs[0].steps.map((s: any) => s.name).filter((n: string) => n && n !== "");
        return `Lộ trình ${i}: Qua ${streets.slice(0, 8).join(', ')}`;
    }).join('\n');

    const prompt = `Dựa trên dữ liệu tìm kiếm thực tế về tình hình giao thông tại Việt Nam hiện nay, hãy phân tích lưu lượng xe trên các tuyến đường sau:\n${routeData}\n\n
    Hãy xác định xem lộ trình nào có mật độ GPS thấp hơn, ít kẹt xe hơn dựa trên báo cáo giao thông thời gian thực.
    Chỉ trả về duy nhất index của lộ trình tốt nhất (ví dụ: 0).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const bestIndex = parseInt(response.text?.trim() || "0");
    return isNaN(bestIndex) ? 0 : bestIndex;
  } catch (error) {
    console.error("Traffic Analysis Error:", error);
    return 0;
  }
};
