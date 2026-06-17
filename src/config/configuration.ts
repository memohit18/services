export default () => ({
  port: parseInt(process.env.PORT ?? '3303', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  mongodb: {
    url: process.env.MONGODB_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
});
