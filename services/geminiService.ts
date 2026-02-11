
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeRouteHazards = async (start: string, end: string): Promise<string> => {
  try {
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

/**
 * Trợ lý luật giao thông AI
 * Trả lời các câu hỏi về mức phạt, biển báo, quy định làn đường dựa trên luật VN hiện hành.
 */
export const askTrafficLawAssistant = async (question: string): Promise<string> => {
  try {
    const prompt = `Bạn là Trợ lý Luật Giao Thông AI chuyên nghiệp tại Việt Nam.
    Người dùng (đang lái xe hoặc đang làm việc với CSGT) hỏi: "${question}".
    
    Hãy trả lời CỰC KỲ NGẮN GỌN, súc tích (dưới 50 từ) để người lái xe nghe nhanh.
    Tập trung vào:
    1. Mức phạt tiền cụ thể (theo Nghị định 100/2019/NĐ-CP và Nghị định 123/2021/NĐ-CP).
    2. Hình phạt bổ sung (tước bằng lái bao lâu) nếu có.
    3. Trả lời thẳng vào vấn đề, giọng điệu bình tĩnh, khách quan, hỗ trợ người dùng.
    
    Ví dụ: 
    Hỏi: "Vượt đèn đỏ xe con phạt bao nhiêu?"
    Đáp: "Phạt 4 đến 6 triệu đồng, tước bằng lái 1 đến 3 tháng."
    
    Chỉ trả về nội dung câu trả lời.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text?.trim() || "Xin lỗi, tôi chưa rõ câu hỏi. Vui lòng hỏi lại.";
  } catch (error) {
    console.error("Traffic Assistant Error:", error);
    return "Hiện tại không thể kết nối với hệ thống luật. Vui lòng kiểm tra lại sau.";
  }
};
