import { prisma } from "@/shared/infrastructure/prisma";
import { ProgressService } from "../application/progress-service";
import { PrismaProgressRepository } from "./prisma-progress-repository";

export const progressService = new ProgressService(new PrismaProgressRepository(prisma));
