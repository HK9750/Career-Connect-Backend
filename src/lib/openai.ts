import { OpenAI } from 'openai';
import config from '../config';

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.OPENAI_API_KEY,
});

export default openai;
