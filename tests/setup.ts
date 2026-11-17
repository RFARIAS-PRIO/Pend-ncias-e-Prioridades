if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef";
process.env.AI_PROVIDER = "local";
