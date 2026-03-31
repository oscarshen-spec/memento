import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateWoodTexture = async (prompt: string = "A seamless top-down photograph of a rustic hardwood floor or workbench made of horizontal wood planks. Warm medium brown tones — honey to sienna, not too dark. Visible plank seams running left to right. Natural wood grain along each board, scattered knots, subtle aging and color variation between planks. No objects, no people, no furniture, matte finish.") => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating wood texture:", error);
    return null;
  }
};
