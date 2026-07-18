import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CalculationsModule } from "./modules/calculations/calculations.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Serve the built React app so the whole thing runs as one origin (keeps
    // cookie auth working on all browsers, including iOS Safari). API routes
    // under /api are excluded so they aren't shadowed by the SPA fallback.
    ServeStaticModule.forRoot({
      rootPath: process.env.WEB_DIST || join(__dirname, "..", "public"),
      exclude: ["/api/(.*)"],
    }),
    PrismaModule,
    AuthModule,
    CalculationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
