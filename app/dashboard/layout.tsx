import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { verifyAuth } from "@/lib/auth";
import dbConnect from "@/lib/db";
import Group from "@/lib/models/Group";
import User from "@/lib/models/User";
import Notification from "@/lib/models/Notification";

interface DashboardLayoutProps {
  children: ReactNode;
}

async function getUserData(userId: string) {
  await dbConnect();
  const user = await User.findById(userId).lean();
  return user;
}

async function getUserGroups(userId: string) {
  await dbConnect();
  const groups = await Group.find({ "members.user": userId })
    .select("_id name")
    .sort({ updatedAt: -1 })
    .lean();
  return groups.map((g) => ({ _id: String(g._id), name: g.name }));
}

async function getUserNotifications(userId: string) {
  await dbConnect();
  const notifications = await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  const unreadCount = await Notification.countDocuments({ userId, read: false });
  return { notifications, unreadCount };
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const userId = await verifyAuth();
  if (!userId) {
    redirect("/login");
  }

  const [user, groups, notificationData] = await Promise.all([
    getUserData(userId),
    getUserGroups(userId),
    getUserNotifications(userId),
  ]);

  if (!user) {
    redirect("/login");
  }

  const userData = {
    name: user.name || "User",
    email: user.email || "",
  };

  const groupsData = groups.map((g) => ({ ...g, color: "" }));

  const notifications = notificationData.notifications.map((n) => ({
    id: String(n._id),
    title: n.title,
    message: n.body,
    time: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "",
    unread: !n.read,
  }));

  const notificationCount = notificationData.unreadCount;

  return (
    <div className="min-h-screen bg-[#0A0F1E] flex overflow-x-hidden">
      <DashboardSidebar user={userData} groups={groupsData} />
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen pb-16 md:pb-0 w-full min-w-0">
        <DashboardHeader notificationCount={notificationCount} notifications={notifications} />
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden w-full min-w-0">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
