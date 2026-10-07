import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  configureProcessLogging,
  initSentry,
} from './common/observability';

async function bootstrap() {
  const jwtSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtSecret || !refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required');
  }
  if (
    process.env.NODE_ENV === 'production' &&
    (jwtSecret.length < 32 || refreshSecret.length < 32)
  ) {
    throw new Error(
      'In production, JWT_SECRET and JWT_REFRESH_SECRET must be at least 32 characters',
    );
  }

  configureProcessLogging();
  await initSentry();

  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3010')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerOn =
    process.env.SWAGGER_ENABLED === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.SWAGGER_ENABLED !== 'false');

  if (swaggerOn) {
    const config = new DocumentBuilder()
      .setTitle('Umbrella API')
      .setDescription('Umbrella Express delivery API (Navex + internal fleet)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3011);
  await app.listen(port);
  const log = new Logger('Bootstrap');
  log.log(`Umbrella API listening on :${port}`);
  if (swaggerOn) log.log(`Swagger /api`);
}
void bootstrap();
