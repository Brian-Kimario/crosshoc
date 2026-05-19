import { Button, Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface GroupInviteEmailProps {
  recipientName?: string;
  inviterName: string;
  groupName: string;
  inviteUrl: string;
  expiresAt: string;
}

export function GroupInviteEmail({
  recipientName,
  inviterName,
  groupName,
  inviteUrl,
  expiresAt,
}: GroupInviteEmailProps) {
  return (
    <EmailLayout
      previewText={`${inviterName} has invited you to join ${groupName} on SplitEasy`}
    >
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        You&apos;ve been invited to join a group
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 16px 0",
        }}
      >
        {recipientName ? `Hi ${recipientName},` : "Hi there,"}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{inviterName}</span>{" "}
        has invited you to join the group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>{" "}
        on SplitEasy. Accept the invitation to start splitting expenses together.
      </Text>

      <Button
        href={inviteUrl}
        style={{
          backgroundColor: "#10B981",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: "600",
          padding: "12px 24px",
          borderRadius: "8px",
          textDecoration: "none",
          display: "inline-block",
        }}
      >
        Accept Invitation
      </Button>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "12px 0 24px 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={inviteUrl} style={{ color: "#10B981" }}>
          {inviteUrl}
        </Link>
      </Text>

      <Text
        style={{
          fontSize: "14px",
          color: "#F59E0B",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        This invitation expires on {expiresAt}. If you did not expect this
        email, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

export default GroupInviteEmail;
