import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface SettlementVoidedEmailProps {
  name: string;
  amount: string;
  groupName: string;
  fromUserName: string;
  toUserName: string;
  reason: string;
  supportEmail: string;
}

export function SettlementVoidedEmail({
  name,
  amount,
  groupName,
  fromUserName,
  toUserName,
  reason,
  supportEmail,
}: SettlementVoidedEmailProps) {
  return (
    <EmailLayout
      previewText={`A settlement in ${groupName} has been voided`}
    >
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        A settlement has been voided
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 16px 0",
        }}
      >
        Hi {name},
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        An administrator has voided a settlement in the group{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{groupName}</span>
        .
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 4px 0",
        }}
      >
        Settlement details:
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 4px 0",
        }}
      >
        Amount:{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{amount}</span>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 4px 0",
        }}
      >
        From:{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>
          {fromUserName}
        </span>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        To:{" "}
        <span style={{ color: "#CBD5E1", fontWeight: "600" }}>{toUserName}</span>
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#F59E0B",
          margin: "0 0 16px 0",
        }}
      >
        ⚠ This action is irreversible.
      </Text>

      <Text
        style={{
          fontSize: "14px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 4px 0",
        }}
      >
        Reason provided:
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        {reason}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          fontWeight: "600",
          color: "#CBD5E1",
          margin: "0 0 8px 0",
        }}
      >
        How to appeal
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If you believe this action was taken in error, please contact our
        support team. Include your account email address and the group name in
        your message.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        Contact support at{" "}
        <Link
          href={`mailto:${supportEmail}`}
          style={{ color: "#10B981", textDecoration: "none" }}
        >
          {supportEmail}
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}

export default SettlementVoidedEmail;
