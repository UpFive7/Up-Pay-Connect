import { useGetCustomer, getGetCustomerQueryKey, useGetCustomerPayments, getGetCustomerPaymentsQueryKey } from "@workspace/api-client-react";
import type { Payment } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EditCustomerModal } from "@/components/edit-customer-modal";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  MapPin,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  ExternalLink,
} from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  payment_link: "Link de Pagamento",
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function computeStats(payments: Payment[]) {
  const total = payments.length;
  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPending = payments
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);
  const paidCount = payments.filter((p) => p.status === "paid").length;
  return { total, totalPaid, totalPending, paidCount };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-foreground",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-muted`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });

  const { data: payments, isLoading: isLoadingPayments } = useGetCustomerPayments(id, {
    query: { enabled: !!id, queryKey: getGetCustomerPaymentsQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="col-span-2 h-64" />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Link href="/customers" className="text-[#2563EB] text-sm hover:underline">
          Voltar para Clientes
        </Link>
      </div>
    );
  }

  const paymentList = payments ?? [];
  const stats = computeStats(paymentList);

  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FF6B2B]/10 flex items-center justify-center">
              <span className="text-sm font-bold text-[#FF6B2B]">{initials}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{customer.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {customer.email && (
                  <span className="text-sm text-muted-foreground">{customer.email}</span>
                )}
                {customer.document && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-sm font-mono text-muted-foreground">{customer.document}</span>
                    {customer.document_type && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 uppercase">
                        {customer.document_type}
                      </Badge>
                    )}
                  </>
                )}
                {customer.asaas_customer_id ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-green-500/30 text-green-600">
                    Asaas ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                    sem sync Asaas
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <EditCustomerModal customer={customer} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={CreditCard}
          label="Total de Cobranças"
          value={String(stats.total)}
          sub={`${stats.paidCount} paga(s)`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Total Recebido"
          value={formatCurrency(stats.totalPaid)}
          color="text-emerald-600"
          sub="pagamentos confirmados"
        />
        <StatCard
          icon={Clock}
          label="A Receber"
          value={formatCurrency(stats.totalPending)}
          color="text-amber-600"
          sub="pendente / processando"
        />
        <StatCard
          icon={TrendingUp}
          label="Volume Total"
          value={formatCurrency(paymentList.reduce((s, p) => s + p.amount, 0))}
          sub="todas as cobranças"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Customer info card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {customer.email && (
              <InfoRow icon={Mail} label="E-mail" value={customer.email} />
            )}
            {customer.phone && (
              <InfoRow icon={Phone} label="Telefone" value={customer.phone} />
            )}
            {customer.document && (
              <InfoRow
                icon={FileText}
                label={customer.document_type?.toUpperCase() ?? "Documento"}
                value={<span className="font-mono">{customer.document}</span>}
              />
            )}
            {(customer.address_city || customer.address_state) && (
              <InfoRow
                icon={MapPin}
                label="Localização"
                value={[customer.address_city, customer.address_state].filter(Boolean).join(" — ")}
              />
            )}
            <InfoRow
              icon={User}
              label="Cadastrado em"
              value={formatDate(customer.created_at)}
            />

            {/* Asaas section */}
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Integração Asaas
              </p>
              {customer.asaas_customer_id ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700 font-medium">Sincronizado</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground pl-6 break-all">
                    {customer.asaas_customer_id}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Não sincronizado</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment history */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Histórico de Pagamentos
              {stats.total > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                  {stats.total} cobrança{stats.total !== 1 ? "s" : ""}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isLoadingPayments ? (
              <div className="space-y-2 px-5 pb-5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : paymentList.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="pr-5"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentList.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="pl-5 font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                      </TableCell>
                      <TableCell className="capitalize text-sm text-muted-foreground">
                        {payment.provider}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </TableCell>
                      <TableCell className="pr-5">
                        <Link
                          href={`/payments/${payment.id}`}
                          className="text-muted-foreground hover:text-[#2563EB] transition-colors"
                          title="Ver detalhe"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhuma cobrança para este cliente.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
