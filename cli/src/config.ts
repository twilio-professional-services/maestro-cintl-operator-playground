import { config as loadDotenv } from 'dotenv';
import { Config } from './types';

export function loadConfig(): Config {
  // Load .env file
  loadDotenv();

  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    conversationConfigurationId: process.env.CONVERSATION_CONFIGURATION_ID || '',
    webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000', 10),
    webhookPath: process.env.WEBHOOK_PATH || '/webhook/operator',
  };
}
