
import { GoogleGenAI, Type } from "@google/genai";
import { LanguageLevel, Lesson, QuizQuestion, VocabularyItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Generates a full narrative quest with specialized gameplay flavor.
 */
export const generateNarrativeQuest = async (language: string, level: LanguageLevel, topic: string): Promise<Lesson> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `You are a Game Designer for a language learning RPG called "LinguistQuest".
    Create a ${level} level quest for ${language} learning.
    Topic: ${topic}.
    The quest should have a "Narrative" intro, a "Content" section (the lesson), and a set of "Vocabulary" to master.
    Format the title like a game mission.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          narrative: { type: Type.STRING },
          content: { type: Type.STRING },
          questType: { type: Type.STRING, enum: ['discovery', 'battle', 'stealth'] },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                translation: { type: Type.STRING },
                pronunciation: { type: Type.STRING }
              },
              required: ["word", "translation"]
            }
          },
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                translated: { type: Type.STRING }
              },
              required: ["original", "translated"]
            }
          }
        },
        required: ["title", "narrative", "content", "vocabulary", "examples", "questType"]
      }
    }
  });

  const data = JSON.parse(response.text);
  return { 
    ...data, 
    id: Math.random().toString(36).substr(2, 9),
    difficulty: level === LanguageLevel.BEGINNER ? 1 : level === LanguageLevel.INTERMEDIATE ? 2 : 3
  };
};

/**
 * Generates a Boss Battle (Quiz) based on the current quest.
 */
export const generateBossBattle = async (language: string, lessonContent: string): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a "Knowledge Boss Battle" for ${language}. 
    Based on this lesson: "${lessonContent}", create 5 questions that test reading and comprehension. 
    Make them feel like combat moves.`,
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
          },
          required: ["question", "options", "correctAnswer", "explanation"]
        }
      }
    }
  });

  return JSON.parse(response.text);
};

/**
 * Generates a collectible card image for a vocabulary word.
 */
export const generateInventoryArt = async (word: string, language: string): Promise<string | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `A vibrant, high-quality RPG item card illustration for the word '${word}' in ${language}. 3D rendered style, magical background, collectible card game aesthetic.` }]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return null;
};
