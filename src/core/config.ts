import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  // Server
  nodeEnv: string;
  port: number;

  // Database
  databaseUrl: string;
  redisUrl: string;

  // LLM Providers
  openaiApiKey: string;
  anthropicApiKey: string;

  // RAG Pipeline
  mistralApiKey: string;
  pineconeApiKey: string;

  // Email & Integrations
  resendApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;

  // Security
  jwtSecret: string;
  encryptionKey: string;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value && !defaultValue) {
    console.warn(`Warning: Environment variable ${key} is not set`);
  }
  return value || '';
}

export const config: Config = {
  // Server
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: parseInt(getEnvVar('PORT', '3000'), 10),

  // Database
  databaseUrl: getEnvVar('DATABASE_URL', 'postgresql://localhost:5432/coask'),
  redisUrl: getEnvVar('REDIS_URL', 'redis://localhost:6379'),

  // LLM Providers
  openaiApiKey: getEnvVar('OPENAI_API_KEY'),
  anthropicApiKey: getEnvVar('ANTHROPIC_API_KEY'),

  // RAG Pipeline
  mistralApiKey: getEnvVar('MISTRAL_API_KEY'),
  pineconeApiKey: getEnvVar('PINECONE_API_KEY'),

  // Email & Integrations
  resendApiKey: getEnvVar('RESEND_API_KEY'),
  googleClientId: getEnvVar('GOOGLE_CLIENT_ID'),
  googleClientSecret: getEnvVar('GOOGLE_CLIENT_SECRET'),
  googleRedirectUri: getEnvVar('GOOGLE_REDIRECT_URI', 'http://localhost:3000/auth/google/callback'),

  // Security
  jwtSecret: getEnvVar('JWT_SECRET', 'your-secret-key-change-in-production'),
  encryptionKey: getEnvVar('ENCRYPTION_KEY', 'your-encryption-key-change-in-production'),
};
