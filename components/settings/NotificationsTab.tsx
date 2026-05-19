import { NotificationPreferences } from "./NotificationPreferences";
import { EmailNotificationPreferences } from "./EmailNotificationPreferences";

export function NotificationsTab() {
  return (
    <div className="space-y-4">
      <NotificationPreferences />
      <EmailNotificationPreferences />
    </div>
  );
}
