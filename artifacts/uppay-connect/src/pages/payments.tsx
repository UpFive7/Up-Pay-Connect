import { useState } from "react";
import { useListPayments } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreatePaymentModal } from "@/components/create-payment-modal";

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  payment_link: "Link de Pagamento",
  checkout: "Checkout",
  subscription: "Assinatura",
};

interface SyncResult { checked: number; updated: number; errors: number; }

export default function Payments() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const { data, isLoading, refetch } = useListPayments();
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/v1/payments/sync?older_than_minutes=0", {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json() as SyncResult;
      setSyncResult(result);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/v1/dashboard"] });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = data?.data?.filter((p) =>
    statusFilter === "all" ? true : p.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-muted-foreground">Visualize e gerencie todas as transações.</p>
        </div>
        <div className="flex items-center gap-2">
          {syncResult && (
            <span className="text-xs text-muted-foreground">
              {syncResult.updated > 0
                ? `✓ ${syncResult.updated} atualizado(s)`
                : `${syncResult.checked} verificado(s), sem mudanças`}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <CreatePaymentModal />
        </div>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar pagamentos..." className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="refunded">Estornado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered && filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Sistema</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Link href={`/payments/${payment.id}`} className="font-mono text-xs text-[#2563EB] hover:underline">
                        {payment.id.substring(0, 8)}…
                      </Link>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-sm">{METHOD_LABELS[payment.payment_method] ?? payment.payment_method}</TableCell>
                    <TableCell className="capitalize text-sm">{payment.provider}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{payment.source_system}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(payment.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {statusFilter !== "all"
                ? `Nenhum pagamento com status "${statusFilter}".`
                : "Nenhum pagamento encontrado."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
