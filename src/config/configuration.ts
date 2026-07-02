export default () => ({
  port: parseInt(process.env.PORT ?? '3303', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  mongodb: {
    url: process.env.MONGODB_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicUrl: process.env.R2_PUBLIC_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  codeRunner: {
    timeoutMs: parseInt(process.env.CODE_RUN_TIMEOUT_MS ?? '5000', 10),
    defaultQuestionTimeLimitMs: parseInt(
      process.env.DEFAULT_QUESTION_TIME_LIMIT_MS ?? '2000',
      10,
    ),
    pythonBin: process.env.PYTHON_BIN,
  },
  llm: {
    providerOrder: process.env.LLM_PROVIDER_ORDER ?? 'gemini,grok',
    maxRetries: parseInt(
      process.env.LLM_MAX_RETRIES ?? process.env.GEMINI_MAX_RETRIES ?? '3',
      10,
    ),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
      fallbackModels: process.env.GEMINI_FALLBACK_MODELS,
    },
    grok: {
      apiKey: process.env.XAI_API_KEY ?? process.env.GROK_API_KEY,
      model: process.env.GROK_MODEL,
      fallbackModels: process.env.GROK_FALLBACK_MODELS,
      baseUrl: process.env.GROK_BASE_URL,
    },
  },
});
