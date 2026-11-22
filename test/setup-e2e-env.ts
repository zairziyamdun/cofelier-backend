// Запускается jest до тестов: приложение в e2e подключается к базе `<имя>_test`,
// а не к базе разработки. ConfigModule берёт process.env раньше, чем .env.
import 'dotenv/config';

import { resolveTestDatabaseUrl } from '../src/config/test-database';

process.env.DATABASE_URL = resolveTestDatabaseUrl(process.env);
