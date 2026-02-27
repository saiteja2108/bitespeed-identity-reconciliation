/**
 * Identity Reconciliation API Types
 * Follows Bitespeed specification
 */

export interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

export interface IdentifyContact {
  primaryContactId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: IdentifyContact;
}
