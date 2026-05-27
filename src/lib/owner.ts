import { prisma } from "@/lib/db";
import type { OwnerProfile } from "@prisma/client";

export async function getOrCreateOwner(): Promise<OwnerProfile> {
  let owner = await prisma.ownerProfile.findFirst();
  if (!owner) {
    owner = await prisma.ownerProfile.create({
      data: { name: "Owner" },
    });
  }
  return owner;
}
