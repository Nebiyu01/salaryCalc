import { Module } from "@nestjs/common";
import { CalculationsService } from "./calculations.service";
import { CalculationsController } from "./calculations.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule], // provides JwtAuthGuard's JwtService
  controllers: [CalculationsController],
  providers: [CalculationsService],
})
export class CalculationsModule {}
