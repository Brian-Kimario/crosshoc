import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { GlobalDialogs } from '@/components/dashboard/GlobalDialogs';
import { MobileSidebarDrawer } from '@/components/dashboard/MobileSidebarDrawer';
import { NetworkStatusBanner } from '@/components/NetworkStatusBanner';
import { RoutePrefetcher } from '@/components/dashboard/RoutePrefetcher';
import { verifyAuth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Group from '@/lib/models/Group';
import User from '@/lib/models/User';
import Notification from '@/lib/models/Notification';

interface DashboardLayoutProps {
  children: ReactNode;
}

async function getUserData(userId: string) {
  try {
    await dbConnect();
    const user = await User.findById(userId).lean();
    return user;
  } catch (e) {
    console.error("[Layout] getUserData failed:", e);
    return null;
  }
}

async function getUserGroups(userId: string) {
  try {
    await dbConnect();
    const groups = await Group.find({ 'members.user': userId })
      .select('_id name')
      .sort({ updatedAt: -1 })
      .lean();
    return groups.map((g) => ({ _id: String(g._id), name: g.name }));
  } catch (e) {
    console.error("[Layout] getUserGroups failed:", e);
    return [];
  }
}

async function getUserNotifications(userId: string) {
  try {
    await dbConnect();
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    return { notifications, unreadCount };
  } catch (e) {
    console.error("[Layout] getUserNotifications failed:", e);
    return { notifications: [], unreadCount: 0 };
  }
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const userId = await verifyAuth();
  if (!userId) {
    redirect('/login');
  }

  const [user, groups, notificationData] = await Promise.all([
    getUserData(userId),
    getUserGroups(userId),
    getUserNotifications(userId),
  ]);

  if (!user) {
    redirect('/login');
  }

  const userData = {
    name: user.name || 'User',
    email: user.email || '',
  };

  const groupsData = groups.map((g) => ({ ...g, color: '' }));

  // Format notifications for the header
  const notifications = notificationData.notifications.map((n) => ({
    id: String(n._id),
    title: n.title,
    message: n.body,
    time: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '',
    unread: !n.read,
  }));

  const notificationCount = notificationData.unreadCount;

  return (
    <>
      <RoutePrefetcher />
      <div className="min-h-screen bg-[#0A0F1E] flex">
        {/* Sidebar */}
        <DashboardSidebar user={userData} groups={groupsData} />

        {/* Main Content */}
        <div className="flex-1 md:ml-60 flex flex-col min-h-screen pb-16 md:pb-0 overflow-x-hidden w-full">
          {/* Header */}
          <DashboardHeader
            notificationCount={notificationCount}
            notifications={notifications}
          />

          {/* Page Content */}
          <main className="flex-1 p-4 lg:p-6 overflow-y-auto overflow-x-hidden w-full">{children}</main>
        </div>
      </div>

      {/* Bottom tab bar — mobile only (outside all containers) */}
      <MobileBottomNav />

      {/* Global Dialogs - Group Selection and Add Expense */}
      <GlobalDialogs groups={groupsData} currentUserId={userId} />

      {/* Mobile Sidebar Drawer */}
      <MobileSidebarDrawer userName={userData.name} userEmail={userData.email} />

      {/* Network Status Banner - shows offline/online state */}
      <NetworkStatusBanner />
    </>
  );
}
