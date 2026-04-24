import { ReactNode, Suspense } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import DashboardLoading from './loading';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-[#0F172A] min-h-screen">
        <Suspense fallback={<DashboardLoading />}>
          {children}
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
