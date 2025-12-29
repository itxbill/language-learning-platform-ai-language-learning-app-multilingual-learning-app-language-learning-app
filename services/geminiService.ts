
import { GoogleGenAI, Type } from "@google/genai";
import { LanguageLevel, Lesson, QuizQuestion, AIFeedback } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const generateNarrativeQuest = async (language: string, level: LanguageLevel, topic: string): Promise<Lesson> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `You are the Master Synapse AI Teacher. Create a ${level} quest for the language ${language}.
    Topic: ${topic}.
    CRITICAL INSTRUCTION: Integrate deep scientific education into the lesson. 
    If the topic is "Volcanoes", teach the language words while explaining magma, eruption mechanics, and tectonics.
    If the topic is "Trees", teach botany and photosynthesis terminology in ${language}.
    Format the response as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          narrative: { type: Type.STRING },
          content: { type: Type.STRING },
          questType: { type: Type.STRING, enum: ['discovery', 'battle', 'stealth'] },
          scientificCategory: { type: Type.STRING, enum: ['geology', 'biology', 'astronomy', 'physics', 'culture'] },
          educationalFact: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              fact: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            }
          },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                translation: { type: Type.STRING }
              }
            }
          },
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                translated: { type: Type.STRING }
              }
            }
          }
        },
        required: ["title", "narrative", "content", "vocabulary", "examples", "questType", "educationalFact", "scientificCategory"]
      }
    }
  });

  const data = JSON.parse(response.text);
  return { ...data, id: Math.random().toString(36).substr(2, 9), difficulty: 1 };
};

export const getTeacherFeedback = async (language: string, userText: string): Promise<AIFeedback> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze this ${language} input: "${userText}". 
    1. Grammar analysis.
    2. Pronunciation phonetics (how to say it).
    3. Naturalness score (0-100).
    Provide feedback as a master teacher.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          grammar: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          phonetics: { type: Type.STRING },
          naturalness: { type: Type.STRING },
          score: { type: Type.NUMBER }
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateBossBattle = async (language: string, lessonContent: string): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a challenging 5-question quiz for ${language} based on this text: ${lessonContent}.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          }
        }
      }
    }
  });
  return JSON.parse(response.text);
};

export const generateInventoryArt = async (word: string, language: string): Promise<string | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: `A futuristic holographic card showing '${word}' in ${language}. Cyan glowing borders, 4k, digital art.` }] }
  });
  const data = response.candidates?.[0]?.content?.parts.find(p => p.inlineData)?.inlineData?.data;
  return data ? `data:image/png;base64,${data}` : null;
};
