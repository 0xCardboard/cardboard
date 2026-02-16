import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type {
  CardInstanceInput,
  CardInstanceWithDetails,
  CardInstanceFilters,
} from "@/types/order";
import type { PaginatedResult } from "@/types/card";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const CARD_INSTANCE_INCLUDE = {
  card: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      set: { select: { id: true, name: true } },
    },
  },
  owner: { select: { id: true, name: true } },
} as const;

export async function registerCardInstance(
  userId: string,
  input: CardInstanceInput,
): Promise<CardInstanceWithDetails> {
  // Validate card exists
  const card = await prisma.card.findUnique({ where: { id: input.cardId } });
  if (!card) {
    throw new AppError("NOT_FOUND", `Card not found: ${input.cardId}`);
  }

  // Validate cert number is unique
  const existing = await prisma.cardInstance.findUnique({
    where: { certNumber: input.certNumber },
  });
  if (existing) {
    throw new AppError("CONFLICT", `Cert number already registered: ${input.certNumber}`);
  }

  // Validate grade range
  if (input.grade < 1 || input.grade > 10) {
    throw new AppError("VALIDATION_ERROR", "Grade must be between 1 and 10");
  }

  const instance = await prisma.cardInstance.create({
    data: {
      cardId: input.cardId,
      ownerId: userId,
      gradingCompany: input.gradingCompany,
      certNumber: input.certNumber,
      grade: input.grade,
      status: "PENDING_SHIPMENT",
    },
    include: CARD_INSTANCE_INCLUDE,
  });

  return instance as CardInstanceWithDetails;
}

export async function getCardInstanceById(
  instanceId: string,
): Promise<CardInstanceWithDetails> {
  const instance = await prisma.cardInstance.findUnique({
    where: { id: instanceId },
    include: CARD_INSTANCE_INCLUDE,
  });

  if (!instance) {
    throw new AppError("NOT_FOUND", `Card instance not found: ${instanceId}`);
  }

  return instance as CardInstanceWithDetails;
}

export async function getUserCardInstances(
  userId: string,
  filters: CardInstanceFilters,
): Promise<PaginatedResult<CardInstanceWithDetails>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { ownerId: userId };

  if (filters.cardId) where.cardId = filters.cardId;
  if (filters.status) where.status = filters.status;

  const [data, total] = await prisma.$transaction([
    prisma.cardInstance.findMany({
      where,
      include: CARD_INSTANCE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.cardInstance.count({ where }),
  ]);

  return {
    data: data as CardInstanceWithDetails[],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function searchCardInstances(
  filters: CardInstanceFilters,
): Promise<PaginatedResult<CardInstanceWithDetails>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (filters.cardId) where.cardId = filters.cardId;
  if (filters.status) where.status = filters.status;
  if (filters.ownerId) where.ownerId = filters.ownerId;

  const [data, total] = await prisma.$transaction([
    prisma.cardInstance.findMany({
      where,
      include: CARD_INSTANCE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.cardInstance.count({ where }),
  ]);

  return {
    data: data as CardInstanceWithDetails[],
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
