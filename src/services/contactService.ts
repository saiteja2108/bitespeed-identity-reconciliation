import { PrismaClient } from "@prisma/client";
import { IdentifyRequest, IdentifyResponse } from "../types/index";

const prisma = new PrismaClient();

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export async function identify(data: IdentifyRequest): Promise<IdentifyResponse> {
  const { email, phoneNumber } = data;

  return prisma.$transaction(async (tx) => {
    const whereClauses: any[] = [];
    if (email) whereClauses.push({ email });
    if (phoneNumber) whereClauses.push({ phoneNumber });

    const matches = whereClauses.length
      ? await tx.contact.findMany({ where: { OR: whereClauses } })
      : [];

    // 1️⃣ No matches → create new primary
    if (matches.length === 0) {
      const created = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: "primary",
        },
      });

      return {
        contact: {
          primaryContactId: created.id,
          emails: created.email ? [created.email] : [],
          phoneNumbers: created.phoneNumber ? [created.phoneNumber] : [],
          secondaryContactIds: [],
        },
      };
    }

    // 2️⃣ Collect primary IDs
    const primaryIdSet = new Set<number>();
    for (const c of matches) {
      if (c.linkPrecedence === "primary") {
        primaryIdSet.add(c.id);
      } else if (c.linkedId) {
        primaryIdSet.add(c.linkedId);
      }
    }

    const primaryIds = Array.from(primaryIdSet);

    const allRelated = await tx.contact.findMany({
      where: {
        OR: [
          { id: { in: primaryIds } },
          { linkedId: { in: primaryIds } },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    const currentPrimaries = allRelated.filter(
      (c) => c.linkPrecedence === "primary"
    );

    currentPrimaries.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const finalPrimary = currentPrimaries[0];

    // 3️⃣ Merge other primaries
    const otherPrimaries = currentPrimaries.filter(
      (p) => p.id !== finalPrimary.id
    );

    for (const other of otherPrimaries) {
      await tx.contact.updateMany({
        where: {
          OR: [{ id: other.id }, { linkedId: other.id }],
        },
        data: {
          linkPrecedence: "secondary",
          linkedId: finalPrimary.id,
        },
      });
    }

    // 4️⃣ Refresh unified group
    let group = await tx.contact.findMany({
      where: {
        OR: [
          { id: finalPrimary.id },
          { linkedId: finalPrimary.id },
        ],
      },
    });

    // 5️⃣ Add new secondary if new info provided
    const existingEmails = new Set(
      group.map((c) => c.email).filter(Boolean)
    );
    const existingPhones = new Set(
      group.map((c) => c.phoneNumber).filter(Boolean)
    );

    const needsCreate =
      (email && !existingEmails.has(email)) ||
      (phoneNumber && !existingPhones.has(phoneNumber));

    if (needsCreate) {
      const createdSecondary = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: "secondary",
          linkedId: finalPrimary.id,
        },
      });

      group.push(createdSecondary);
    }

    // 6️⃣ Build response arrays
    const emails = uniq(
      group
        .map((c) => c.email)
        .filter((e): e is string => Boolean(e))
    );

    const phones = uniq(
      group
        .map((c) => c.phoneNumber)
        .filter((p): p is string => Boolean(p))
    );

    // Ensure primary's values first
    if (finalPrimary.email) {
      emails.splice(emails.indexOf(finalPrimary.email), 1);
      emails.unshift(finalPrimary.email);
    }

    if (finalPrimary.phoneNumber) {
      phones.splice(phones.indexOf(finalPrimary.phoneNumber), 1);
      phones.unshift(finalPrimary.phoneNumber);
    }

    const secondaryContactIds = group
      .filter((c) => c.linkPrecedence === "secondary")
      .map((c) => c.id);

    return {
      contact: {
        primaryContactId: finalPrimary.id,
        emails,
        phoneNumbers: phones,
        secondaryContactIds,
      },
    };
  });
}