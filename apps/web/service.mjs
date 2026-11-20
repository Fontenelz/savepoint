// @ts-check
import nextjs from '@prisma/composer/nextjs';
import { rawHttp } from '@prisma/composer/http';
import { compute } from '@prisma/composer-prisma-cloud';

export default compute({
  name: 'web',
  deps: { api: rawHttp() },
  build: nextjs({ module: import.meta.url, appDir: '.' }),
});
