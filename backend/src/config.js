// All secrets come from environment variables, never from the repository (SAD 2.4).
const env = process.env;
const isTest = env.NODE_ENV === 'test';

function required(name, fallbackForTest) {
  const v = env[name];
  if (v) return v;
  if (isTest && fallbackForTest) return fallbackForTest;
  throw new Error(`Missing required environment variable ${name}`);
}

const config = {
  env: env.NODE_ENV || 'development',
  isTest,
  port: Number(env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://peerlearn_app:app_pw@localhost:5432/peerlearn_test'),
  jwtSecret: required('JWT_SECRET', 'test-secret-test-secret-test-secret-123'),
  tokenTtl: '2h',                       // SR-04
  bcryptCost: Math.max(10, Number(env.BCRYPT_COST || 12)), // NFR-01: never below 10
  // NFR-04: 100 requests / minute / authenticated user. Anonymous traffic (login, register) has no user, so it is
  // limited per IP with a higher ceiling because many students share one campus address; SR-08 lockout stops brute force.
  rateLimit: { max: 100, anonMax: Number(env.RATE_LIMIT_ANON_MAX || 300), windowMs: 60_000 },
  lockout: { maxFailures: 5, minutes: 15 },  // SR-08
  sessionExpiryHours: 48,               // FR-08
  reminderMinutes: 60,                  // FR-11
  timezone: 'Asia/Kolkata',             // all weekly slots are campus-local time
  enforceHttps: env.ENFORCE_HTTPS === 'true', // SR-01 (reverse proxy also redirects)
  corsOrigin: env.CORS_ORIGIN || '*',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 1025),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'PeerLearn <no-reply@pes.edu>',
  },
  jobsEnabled: env.JOBS_ENABLED !== 'false' && !isTest,
};

module.exports = config;
