import { Link, Text } from "@react-email/components";
import { EmailLayout } from "./components/EmailLayout";

interface NewLoginEmailProps {
  name: string;
  loginAt: string;
  ipAddress: string;
  location?: string;
  settingsUrl: string;
  supportEmail: string;
}

export function NewLoginEmail({
  name,
  loginAt,
  ipAddress,
  location,
  settingsUrl,
  supportEmail,
}: NewLoginEmailProps) {
  return (
    <EmailLayout previewText="New login detected on your SplitEasy account">
      <Text
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: "#F1F5F9",
          margin: "0 0 16px 0",
        }}
      >
        New login detected
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
        We detected a new login to your SplitEasy account from an unrecognised
        location. Here are the details:
      </Text>

      {/* Login details block */}
      <Text
        style={{
          backgroundColor: "#1E293B",
          borderRadius: "8px",
          padding: "16px",
          fontSize: "14px",
          color: "#CBD5E1",
          lineHeight: "1.8",
          margin: "0 0 24px 0",
        }}
      >
        <Text
          style={{
            fontSize: "14px",
            color: "#CBD5E1",
            margin: "0 0 4px 0",
          }}
        >
          <strong style={{ color: "#F1F5F9" }}>Time (UTC):</strong> {loginAt}
        </Text>
        <Text
          style={{
            fontSize: "14px",
            color: "#CBD5E1",
            margin: "0 0 4px 0",
          }}
        >
          <strong style={{ color: "#F1F5F9" }}>IP address:</strong> {ipAddress}
        </Text>
        {location && (
          <Text
            style={{
              fontSize: "14px",
              color: "#CBD5E1",
              margin: "0",
            }}
          >
            <strong style={{ color: "#F1F5F9" }}>Location:</strong> {location}
          </Text>
        )}
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 24px 0",
        }}
      >
        If this was you, no action is needed. If you don&apos;t recognise this
        login, we recommend reviewing your recent account activity and changing
        your password immediately.
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0 0 8px 0",
        }}
      >
        Review your account activity in{" "}
        <Link href={settingsUrl} style={{ color: "#10B981", textDecoration: "none" }}>
          account settings
        </Link>
        .
      </Text>

      <Text
        style={{
          fontSize: "13px",
          color: "#64748B",
          margin: "0 0 24px 0",
        }}
      >
        Or copy and paste this link into your browser:{" "}
        <Link href={settingsUrl} style={{ color: "#10B981" }}>
          {settingsUrl}
        </Link>
      </Text>

      <Text
        style={{
          fontSize: "16px",
          color: "#94A3B8",
          lineHeight: "1.6",
          margin: "0",
        }}
      >
        If you need help, contact us at{" "}
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

export default NewLoginEmail;
