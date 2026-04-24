"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-slate-500 font-semibold uppercase tracking-wider text-xs">
        Menu
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url || pathname?.startsWith(item.url + "/")
          return (
            <Collapsible
              key={item.title}
              defaultOpen={item.isActive}
              render={<SidebarMenuItem />}
            >
              <Link href={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  className={`
                    ${isActive 
                      ? "bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-400" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }
                    transition-all duration-200
                  `}
                >
                  <span className={isActive ? "text-emerald-400" : ""}>
                    {item.icon}
                  </span>
                  <span className={isActive ? "font-medium" : ""}>{item.title}</span>
                </SidebarMenuButton>
              </Link>
              {item.items?.length ? (
                <>
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuAction className="aria-expanded:rotate-90 text-slate-400" />
                    }
                  >
                    <ChevronRightIcon className="text-slate-400" />
                    <span className="sr-only">Toggle</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <Link href={subItem.url}>
                            <SidebarMenuSubButton className="text-slate-400 hover:text-slate-200">
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </Link>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              ) : null}
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
