import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const analyzeNotes = async (
  input: { type: 'image', data: string }[] | { type: 'text', data: string }
) => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a "Smart Scribbler" assistant. Your task is to transform handwritten notes or digital documents into a professional, structured format.
    
    Rules:
    1. UNDERLINED WORDS: Identify words or phrases that are underlined for emphasis. Elaborate on these concepts significantly, providing detailed context, definitions, or examples.
    2. EMPTY HEADINGS: If you find a heading or title with no content under it, generate concise but highly contextual information that fits the overall theme of the notes.
    3. DIAGRAMS: If there are any diagrams, sketches, or charts, provide a detailed textual description of them. Start these descriptions with "[DIAGRAM_DESCRIPTION]: ".
    4. CONCISENESS: For all other parts of the notes, keep the summary concise, scannable, and to the point.
    5. STRUCTURE: Use Markdown for the output. Use clear headings (H1, H2, H3).
    6. OUTPUT FORMAT: Return a JSON object with the following structure:
       {
         "title": "Main Title of the Notes",
         "sections": [
           {
             "heading": "Section Heading",
             "content": "Elaborated or concise content in Markdown",
             "isElaborated": boolean,
             "diagrams": ["Description of diagram 1", ...]
           }
         ]
       }
  `;

  let contents;
  if (Array.isArray(input)) {
    contents = {
      parts: [
        { text: "Analyze these handwritten notes according to the rules." },
        ...input.map(img => ({
          inlineData: {
            mimeType: "image/jpeg",
            data: img.data.split(',')[1]
          }
        }))
      ]
    };
  } else {
    contents = {
      parts: [{ text: `Analyze these notes: ${input.data}` }]
    };
  }

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                content: { type: Type.STRING },
                isElaborated: { type: Type.BOOLEAN },
                diagrams: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["heading", "content"]
            }
          }
        },
        required: ["title", "sections"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const generateDiagramImage = async (description: string) => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `Create a professional, clean, technical diagram based on this description: ${description}. Use a white background and clear lines.` }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
