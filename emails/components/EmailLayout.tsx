import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  children: ReactNode;
  previewText: string;
}

const supportEmail =
  process.env.SUPPORT_EMAIL ?? "support@spliteasy.app";

export function EmailLayout({ children, previewText }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: "#0F172A",
          margin: "0",
          padding: "0",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            padding: "40px 20px",
          }}
        >
          {/* Header — SplitEasy wordmark */}
          <Text
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#10B981",
              margin: "0 0 32px 0",
              textAlign: "center",
              letterSpacing: "-0.5px",
            }}
          >
            SplitEasy
          </Text>

          {/* Email body content */}
          {children}

          {/* Footer */}
          <Hr
            style={{
              borderColor: "#1E293B",
              margin: "32px 0 24px 0",
            }}
          />
          <Text
            style={{
              fontSize: "13px",
              color: "#64748B",
              textAlign: "center",
              margin: "0 0 8px 0",
            }}
          >
            SplitEasy — split expenses with ease
          </Text>
          <Text
            style={{
              fontSize: "13px",
              color: "#64748B",
              textAlign: "center",
              margin: "0 0 8px 0",
            }}
          >
            Need help? Contact us at{" "}
            <Link
              href={`mailto:${supportEmail}`}
              style={{ color: "#10B981", textDecoration: "none" }}
            >
              {supportEmail}
            </Link>
          </Text>
          <Text
            style={{
              fontSize: "12px",
              color: "#475569",
              textAlign: "center",
              margin: "0",
            }}
          >
            You received this email because an action was taken on your SplitEasy
            account. This is a transactional email and cannot be unsubscribed from
            for security-critical notifications.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default EmailLayout;
