
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Phân tích hình ảnh từ Dashcam để tìm biển báo tốc độ.
 * Sử dụng model flash để có tốc độ phản hồi nhanh nhất (~1-2s).
 * @param base64Image Ảnh dạng base64 (không bao gồm prefix data:image...)
 */
export const analyzeTrafficSign = async (base64Image: string): Promise<number | null> => {
  try {
    const prompt = `You are a driving assistant for a car in Vietnam. 
    Analyze this dashcam frame. Look specifically for CIRCULAR SPEED LIMIT SIGNS (Red circle with a number inside).
    
    If you see a valid speed limit sign clearly, return ONLY the number (e.g., 50, 60, 80).
    If you see multiple signs, prioritize the one relevant to the current lane.
    If there is NO speed limit sign, return 0.
    
    Output format: Just the integer number. No JSON, no text.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Sử dụng Flash Latest cho tốc độ nhanh nhất và Vision tốt
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      }
    });

    const text = response.text?.trim();
    const speed = parseInt(text || "0");

    // Chỉ chấp nhận các tốc độ hợp lý ở VN (10 - 120 km/h)
    if (!isNaN(speed) && speed >= 10 && speed <= 120 && speed % 5 === 0) {
      return speed;
    }

    return null;
  } catch (error) {
    console.warn("Vision AI analysis failed:", error);
    return null;
  }
};
