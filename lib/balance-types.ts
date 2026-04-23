// Type definitions for balance calculations
// These are separated from balance-server.ts to avoid "use server" export issues

export interface UserBalanceSummary {
  totalOwedToMe: number; // Positive - others owe me
  totalIOwe: number; // Positive - I owe others
  netBalance: number; // Positive = I'm owed, Negative = I owe
  groupCount: number;
}

export interface GroupMemberBalance {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  paid: number;
  owed: number;
  balance: number;
}

export interface SimplifiedDebt {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}
