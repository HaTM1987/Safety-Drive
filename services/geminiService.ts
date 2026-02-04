
import { GoogleGenAI } from "@google/genai";

export const analyzeRouteHazards = async (start: string, end: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Tôi đang lái xe từ "${start}" đến "${end}" tại Việt Nam. 
    Hãy đóng vai một trợ lý lái xe thông minh. 
    Đưa ra một lời khuyên an toàn cực ngắn (dưới 15 từ) về giao thông cho tuyến đường này. 
    Chỉ trả về nội dung lời khuyên.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "Lái xe an toàn và quan sát biển báo.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hãy chú ý quan sát và giữ khoảng cách an toàn.";
  }
};
