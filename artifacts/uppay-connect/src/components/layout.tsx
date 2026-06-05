import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CreditCard, 
  Users, 
  Server, 
  Key, 
  RefreshCw, 
  Webhook, 
  DollarSign, 
  Activity, 
  Settings 
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/payments", label: "Payments", icon: CreditCard },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/systems", label: "Systems", icon: Server },
    { href: "/api-keys", label: "API Keys", icon: Key },
    { href: "/subscriptions", label: "Subscriptions", icon: RefreshCw },
    { href: "/webhooks", label: "Webhooks", icon: Webhook },
    { href: "/fees", label: "Fees", icon: DollarSign },
    { href: "/audit-logs", label: "Audit Logs", icon: Activity },
    { href: "/providers", label: "Providers", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background w-full">
      <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col fixed inset-y-0 z-10">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-black">UP</span>
            </div>
            UpPay Connect
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive 
                      ? "bg-sidebar-accent text-white" 
                      : "text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground/50 text-center">
            v0.1.0 • Logged in as Admin
          </div>
        </div>
      </div>
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
