import {
  LayoutDashboard,
  Users,
  ListChecks,
  FileText,
  Send,
  BarChart3,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const primaryNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Contacts", href: "/contacts", icon: Users },
  { title: "Lists", href: "/lists", icon: ListChecks },
  { title: "Templates", href: "/templates", icon: FileText },
  { title: "Campaigns", href: "/campaigns", icon: Send },
  { title: "Reports", href: "/reports", icon: BarChart3 },
];

export const secondaryNavItems: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Help", href: "/help", icon: HelpCircle },
];

export const allNavItems: NavItem[] = [...primaryNavItems, ...secondaryNavItems];

export function getPageTitle(pathname: string): string {
  const match = allNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return match?.title ?? "BoilerTech";
}
