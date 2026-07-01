-- Runs once on first container init (empty volume), as root.
-- 1. Force mysql_native_password so Prisma's connector authenticates over TCP
--    without requiring TLS/RSA exchange.
-- 2. Grant global privileges so `prisma migrate dev` can create its shadow DB.
ALTER USER 'gridbase-api'@'%' IDENTIFIED WITH mysql_native_password BY 'gridbase_dev';
GRANT ALL PRIVILEGES ON *.* TO 'gridbase-api'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;
