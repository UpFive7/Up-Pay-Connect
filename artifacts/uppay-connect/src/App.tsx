import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Payments from "@/pages/payments";
import PaymentDetail from "@/pages/payment-detail";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Systems from "@/pages/systems";
import ApiKeys from "@/pages/api-keys";
import Subscriptions from "@/pages/subscriptions";
import Webhooks from "@/pages/webhooks";
import Fees from "@/pages/fees";
import AuditLogs from "@/pages/audit-logs";
import Providers from "@/pages/providers";
import NotFound from "@/pages/not-found";
import { useAuth } from "@workspace/replit-auth-web";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101010]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#FF6B2B] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101010]">
        <div className="flex flex-col items-center gap-6 text-center px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF6B2B] flex items-center justify-center text-white font-bold text-lg">
              UP
            </div>
            <span className="text-white text-2xl font-bold">UpPay Connect</span>
          </div>
          <p className="text-white/60 text-sm max-w-xs">
            Painel interno de infraestrutura de pagamentos da UpFive7.
          </p>
          <button
            onClick={login}
            className="px-8 py-3 bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white font-semibold rounded-lg transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/payments" component={Payments} />
        <Route path="/payments/:id" component={PaymentDetail} />
        <Route path="/customers" component={Customers} />
        <Route path="/customers/:id" component={CustomerDetail} />
        <Route path="/systems" component={Systems} />
        <Route path="/api-keys" component={ApiKeys} />
        <Route path="/subscriptions" component={Subscriptions} />
        <Route path="/webhooks" component={Webhooks} />
        <Route path="/fees" component={Fees} />
        <Route path="/audit-logs" component={AuditLogs} />
        <Route path="/providers" component={Providers} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGate>
            <Router />
          </AuthGate>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
