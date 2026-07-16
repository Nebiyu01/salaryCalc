import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  Calculation,
  CreateCalculationInput,
  UpdateCalculationInput,
} from "@salary-calc/shared";

/**
 * Every method takes the authenticated userId and scopes all reads/writes to
 * it, so a user can never read or mutate another user's rows.
 */
@Injectable()
export class CalculationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateCalculationInput,
  ): Promise<Calculation> {
    const row = await this.prisma.calculation.create({
      data: {
        userId,
        calculatorSlug: dto.calculatorSlug,
        title: dto.title ?? null,
        inputs: dto.inputs as Prisma.InputJsonValue,
        results: dto.results as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async findAllForUser(userId: string): Promise<Calculation[]> {
    const rows = await this.prisma.calculation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toDto(r));
  }

  async findOneForUser(userId: string, id: string): Promise<Calculation> {
    const row = await this.prisma.calculation.findFirst({
      where: { id, userId },
    });
    // 404 (not 403) so we don't reveal that a row with this id exists.
    if (!row) throw new NotFoundException("Calculation not found");
    return this.toDto(row);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCalculationInput,
  ): Promise<Calculation> {
    await this.findOneForUser(userId, id); // ownership check
    const row = await this.prisma.calculation.update({
      where: { id },
      data: {
        calculatorSlug: dto.calculatorSlug,
        title: dto.title,
        inputs: dto.inputs as Prisma.InputJsonValue | undefined,
        results: dto.results as Prisma.InputJsonValue | undefined,
      },
    });
    return this.toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneForUser(userId, id); // ownership check
    await this.prisma.calculation.delete({ where: { id } });
  }

  private toDto(row: {
    id: string;
    userId: string;
    calculatorSlug: string;
    title: string | null;
    inputs: Prisma.JsonValue;
    results: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): Calculation {
    return {
      id: row.id,
      userId: row.userId,
      calculatorSlug: row.calculatorSlug,
      title: row.title,
      inputs: (row.inputs ?? {}) as Record<string, unknown>,
      results: (row.results ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
