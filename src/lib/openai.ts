import { OpenAI } from 'openai';
import config from '../config';

const openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    timeout: 30000,
    maxRetries: 3,
});

export default openai;
