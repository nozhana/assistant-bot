import openAIClient from "../services/openai-service";

const openaiMiddleware = () => ({ openai: openAIClient });

export default openaiMiddleware;
