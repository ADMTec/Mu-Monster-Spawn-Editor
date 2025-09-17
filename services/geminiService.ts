import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generateMonsterImage = async (monsterName: string): Promise<string> => {
    try {
        const prompt = `Generate a cinematic, full-body 3D render of a fantasy monster named '${monsterName}'. The creature should be in a dynamic action pose, detailed with hyper-realistic textures. Set against a dark, moody grey studio background to emphasize the character model. The style must be similar to modern AAA RPG game concept art. Focus on a menacing and powerful appearance.`;
        
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        throw new Error("No images generated.");
    } catch (error) {
        console.error("Error generating monster image:", error);
        // Return a placeholder or default image URL in case of an error
        return `https://picsum.photos/seed/${monsterName}/200`;
    }
};