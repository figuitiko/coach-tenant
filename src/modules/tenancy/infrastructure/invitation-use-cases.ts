import { InvitationService } from "@/modules/tenancy/application/invitation-service";
import { prisma } from "@/shared/infrastructure/prisma";
import { PrismaInvitationRepository } from "./prisma-invitation-repository";

export const invitationService = new InvitationService(new PrismaInvitationRepository(prisma));
