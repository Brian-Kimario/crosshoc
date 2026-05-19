import { Types } from "mongoose";

export type GroupRole = "owner" | "admin" | "member";

export type GroupPermission =
  | "addExpense"
  | "editAnyExpense"
  | "deleteAnyExpense"
  | "editOwnExpense"
  | "inviteMembers"
  | "removeMember"
  | "changeRole"
  | "leaveGroup"
  | "editGroupSettings"
  | "archiveGroup"
  | "deleteGroup"
  | "setBudget"
  | "manageRecurring"
  | "addComment"
  | "deleteOwnComment"
  | "deleteAnyComment";

export interface GroupMember {
  user: Types.ObjectId | string;
  role: GroupRole;
  joinedAt: Date;
}

/**
 * Static permission matrix — no DB calls required.
 * Each role maps to the set of permissions it grants.
 */
export const PERMISSION_MATRIX: Record<GroupRole, Set<GroupPermission>> = {
  owner: new Set<GroupPermission>([
    "addExpense",
    "editOwnExpense",
    "addComment",
    "deleteOwnComment",
    "leaveGroup",
    "editAnyExpense",
    "deleteAnyExpense",
    "inviteMembers",
    "removeMember",
    "setBudget",
    "manageRecurring",
    "deleteAnyComment",
    "editGroupSettings",
    "archiveGroup",
    "changeRole",
    "deleteGroup",
  ]),
  admin: new Set<GroupPermission>([
    "addExpense",
    "editOwnExpense",
    "addComment",
    "deleteOwnComment",
    "leaveGroup",
    "editAnyExpense",
    "deleteAnyExpense",
    "inviteMembers",
    "removeMember",
    "setBudget",
    "manageRecurring",
    "deleteAnyComment",
    "editGroupSettings",
  ]),
  member: new Set<GroupPermission>([
    "addExpense",
    "editOwnExpense",
    "addComment",
    "deleteOwnComment",
    "leaveGroup",
  ]),
};

/**
 * Returns the role of a user within a group's members array,
 * or null if the user is not a member.
 * Falls back to "owner" if the member has no role set (legacy data).
 */
export function getUserRole(
  members: GroupMember[],
  userId: string
): GroupRole | null {
  const member = members.find(
    (m) => m.user.toString() === userId
  );
  if (!member) return null;
  // Fallback for legacy documents that predate the role system
  return (member.role as GroupRole) ?? "owner";
}

/**
 * Asserts that a user has the required permission within a group.
 * Throws { status: 403, message: "Forbidden: insufficient permissions" }
 * if the user is not a member or their role does not grant the permission.
 */
export function assertCan(
  members: GroupMember[],
  userId: string,
  permission: GroupPermission
): void {
  const role = getUserRole(members, userId);
  if (role === null || !PERMISSION_MATRIX[role].has(permission)) {
    throw { status: 403, message: "Forbidden: insufficient permissions" };
  }
}
