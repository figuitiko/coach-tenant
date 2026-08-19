import { prisma } from "@/shared/infrastructure/prisma";
import { TrainingService } from "../application/training-service";
import { PrismaTrainingRepository } from "./prisma-training-repository";

export const trainingService = new TrainingService(new PrismaTrainingRepository(prisma));
