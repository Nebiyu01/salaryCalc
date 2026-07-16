import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // All routes are namespaced and versioned: /api/v1/...
  app.setGlobalPrefix("api/v1");

  app.use(cookieParser());

  // Validation is handled per-route by ZodValidationPipe, which also strips
  // unknown keys (Zod object schemas drop them by default).

  // Cookie-based auth requires credentials + an explicit allowed origin.
  app.enableCors({
    origin: config.getOrThrow<string>("WEB_ORIGIN"),
    credentials: true,
  });

  const port = config.getOrThrow<number>("PORT");
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
