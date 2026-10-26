// Sempre antes de importar a aplicação. Nenhuma conexão de testes usa o banco local.
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'test_only';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'isolated_memory_test';
process.env.AUTH_ALLOWED_ORIGINS = 'http://localhost:5173';
process.env.AUTH_COOKIE_SAME_SITE = 'lax';
process.env.AUTH_SESSION_SECONDS = '28800';
process.env.AUTH_LOGIN_WINDOW_SECONDS = '900';
process.env.AUTH_LOGIN_IP_LIMIT = '50';
process.env.AUTH_LOGIN_ACCOUNT_LIMIT = '10';
process.env.TRUST_PROXY_HOPS = '0';
