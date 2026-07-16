import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  createCalculationSchema,
  updateCalculationSchema,
  type CreateCalculationInput,
  type UpdateCalculationInput,
} from "@salary-calc/shared";
import { CalculationsService } from "./calculations.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/guards/jwt-auth.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

@Controller("calculations")
@UseGuards(JwtAuthGuard) // every route here requires a valid session
export class CalculationsController {
  constructor(private readonly calculations: CalculationsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCalculationSchema))
    dto: CreateCalculationInput,
  ) {
    return this.calculations.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.calculations.findAllForUser(user.id);
  }

  @Get(":id")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.calculations.findOneForUser(user.id, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateCalculationSchema))
    dto: UpdateCalculationInput,
  ) {
    return this.calculations.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ) {
    return this.calculations.remove(user.id, id);
  }
}
