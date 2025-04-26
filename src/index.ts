import app from './app';
import config from './config';
import dotenv from 'dotenv';
dotenv.config();

app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${config.PORT}`);
});
