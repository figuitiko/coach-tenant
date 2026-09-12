import { prisma } from "@/shared/infrastructure/prisma";
import { MarketingService } from "../application/marketing-service";
import { PrismaMarketingRepository } from "./prisma-marketing-repository";

export const marketingService = new MarketingService(new PrismaMarketingRepository(prisma));
