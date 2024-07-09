import OpenAI, { OpenAIError } from "openai";

const openAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default openAIClient;
