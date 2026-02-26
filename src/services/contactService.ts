import { PrismaClient, Contact, LinkPrecedence } from '@prisma/client';

const prisma = new PrismaClient();

interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

import { PrismaClient, LinkPrecedence } from '@prisma/client';

const prisma = new PrismaClient();

interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export async function identify(data: IdentifyRequest): Promise<IdentifyResponse> {
  const { email, phoneNumber } = data;

  return prisma.$transaction(async (tx) => {
    const whereClauses: any[] = [];
    if (email) whereClauses.push({ email });
    if (phoneNumber) whereClauses.push({ phoneNumber });

    // Find any contacts that match incoming identifiers
    const matches = await tx.contact.findMany({ where: { OR: whereClauses } });

    // If no matches, create a new primary contact
    if (matches.length === 0) {
      const created = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: LinkPrecedence.PRIMARY,
        },
      });

      const emails = created.email ? [created.email] : [];
      const phones = created.phoneNumber ? [created.phoneNumber] : [];

      return {
        contact: {
          primaryContactId: created.id,
          emails,
          phoneNumbers: phones,
          secondaryContactIds: [],
        },
      };
    }

    // Determine primary contact ids for matched contacts
    const primaryIdSet = new Set<number>();
    for (const c of matches) {
      if (c.linkPrecedence === LinkPrecedence.PRIMARY) {
        primaryIdSet.add(c.id);
      } else if (c.linkedId) {
        primaryIdSet.add(c.linkedId);
      }
    }

    const primaryIds = Array.from(primaryIdSet);

    // Fetch all contacts that belong to these primaries (the primaries and their secondaries)
    const allRelated = await tx.contact.findMany({
      where: {
        OR: [{ id: { in: primaryIds } }, { linkedId: { in: primaryIds } }],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Identify current primary contacts among the related set
    const currentPrimaries = allRelated.filter((c) => c.linkPrecedence === LinkPrecedence.PRIMARY);

    // Choose the oldest primary (by createdAt) as the final primary
    currentPrimaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const finalPrimary = currentPrimaries[0];

    // If there are other primaries, merge them into finalPrimary
    const otherPrimaries = currentPrimaries.filter((p) => p.id !== finalPrimary.id);
    for (const other of otherPrimaries) {
      // reassign the other primary and all of its secondaries to point to finalPrimary
      await tx.contact.updateMany({
        where: { OR: [{ id: other.id }, { linkedId: other.id }] },
        data: { linkPrecedence: LinkPrecedence.SECONDARY, linkedId: finalPrimary.id },
      });
    }

    // Re-fetch the unified group (final primary + its secondaries)
    const group = await tx.contact.findMany({ where: { OR: [{ id: finalPrimary.id }, { linkedId: finalPrimary.id }] } });

    // If the incoming payload contains new information not present in the group, create a new secondary
    const existingEmails = new Set(group.map((c) => c.email).filter(Boolean));
    const existingPhones = new Set(group.map((c) => c.phoneNumber).filter(Boolean));

    const needsCreate = (email && !existingEmails.has(email)) || (phoneNumber && !existingPhones.has(phoneNumber));
    if (needsCreate) {
      const createdSecondary = await tx.contact.create({
        data: {
          email: email ?? null,
          phoneNumber: phoneNumber ?? null,
          linkPrecedence: LinkPrecedence.SECONDARY,
          linkedId: finalPrimary.id,
        },
      });
      group.push(createdSecondary);
    }

    // Build unique lists of emails and phone numbers
    const emails = uniq(group.map((c) => c.email).filter((e): e is string => Boolean(e)));
    const phones = uniq(group.map((c) => c.phoneNumber).filter((p): p is string => Boolean(p)));

    // Ensure primary's email/phone are first in arrays
    if (finalPrimary.email) {
      const idx = emails.indexOf(finalPrimary.email);
      if (idx > -1) {
        emails.splice(idx, 1);
      }
      emails.unshift(finalPrimary.email);
    }

    if (finalPrimary.phoneNumber) {
      const idx = phones.indexOf(finalPrimary.phoneNumber);
      if (idx > -1) {
        phones.splice(idx, 1);
      }
      phones.unshift(finalPrimary.phoneNumber);
    }

    const secondaryContactIds = group.filter((c) => c.linkPrecedence === LinkPrecedence.SECONDARY).map((c) => c.id);

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
