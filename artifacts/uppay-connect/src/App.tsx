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

const queryClient = new QueryClient();

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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
