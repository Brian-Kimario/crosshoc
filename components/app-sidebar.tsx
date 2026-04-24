"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUserClient } from "@/components/nav-user-client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { 
  LayoutDashboard, 
  Users, 
  Receipt, 
  Settings, 
  HelpCircle, 
  Send,
  Wallet,
  Layers
} from "lucide-react"

// Smart Logo Component - routes to /dashboard if logged in, / if not
function BrandLogo() {
  // Check for auth token to determine smart routing
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Check for auth cookie
    const hasAuth = document.cookie.includes('authToken=')
    setIsAuthenticated(hasAuth)
    setIsLoading(false)
  }, [])

  // While loading, render a non-clickable placeholder to prevent hydration mismatch
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 px-2">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/20">
          <Layers className="size-4 text-emerald-400" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium text-white">SplitEasy</span>
          <span className="truncate text-xs text-slate-400">Expense Splitter</span>
        </div>
      </div>
    )
  }

  const href = isAuthenticated ? "/dashboard" : "/"

  return (
    <Link href={href} className="flex items-center gap-3 px-2 hover:opacity-80 transition-opacity">
      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/20">
        <Layers className="size-4 text-emerald-400" />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium text-white">SplitEasy</span>
        <span className="truncate text-xs text-slate-400">Expense Splitter</span>
      </div>
    </Link>
  )
}

// Navigation data for SplitEasy
const navData = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: <LayoutDashboard className="size-4" />,
      isActive: true,
    },
    {
      title: "Groups",
      url: "/groups",
      icon: <Users className="size-4" />,
    },
    {
      title: "Expenses",
      url: "/expenses",
      icon: <Receipt className="size-4" />,
    },
    {
      title: "Settlements",
      url: "/settlements",
      icon: <Wallet className="size-4" />,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings className="size-4" />,
    },
  ],
  navSecondary: [
    {
      title: "Help & Support",
      url: "/help",
      icon: <HelpCircle className="size-4" />,
    },
    {
      title: "Feedback",
      url: "/feedback",
      icon: <Send className="size-4" />,
    },
  ],
}

// Custom NavMain with active state styling
function NavMainCustom({ items }: { items: typeof navData.navMain }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname === item.url || pathname?.startsWith(`${item.url}/`)
        
        return (
          <Link
            key={item.title}
            href={item.url}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive 
                ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500" 
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }
            `}
          >
            <span className={isActive ? "text-emerald-400" : ""}>
              {item.icon}
            </span>
            {item.title}
          </Link>
        )
      })}
    </div>
  )
}

// Custom NavSecondary
function NavSecondaryCustom({ items, className }: { items: typeof navData.navSecondary; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {items.map((item) => (
        <Link
          key={item.title}
          href={item.url}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200"
        >
          {item.icon}
          {item.title}
        </Link>
      ))}
    </div>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" className="bg-[#0F172A] border-r border-slate-800" {...props}>
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="w-full justify-start p-0 hover:bg-transparent">
              <BrandLogo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        <div className="mb-4 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Menu
        </div>
        <NavMainCustom items={navData.navMain} />
        
        <div className="mt-auto pt-8">
          <div className="mb-4 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Support
          </div>
          <NavSecondaryCustom items={navData.navSecondary} />
        </div>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-slate-800">
        <NavUserClient />
      </SidebarFooter>
    </Sidebar>
  )
}
