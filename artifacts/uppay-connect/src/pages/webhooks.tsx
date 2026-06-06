import { useState } from "react";
import { useListWebhookDeliveries, useGetWebhookStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Copy, Check, Zap } from "lucide-react";

// ─── Asaas Webhook Setup Panel ────────────────────────────────────────────────

interface WebhookStatus {
  configured: boolean;
  enabled: boolean;
  interrupted: boolean;
  url: string | null;
  expected_url: string;
  token_set: boolean;
}

interface SetupResult {
  success: boolean;
  webhook_url: string;
  token_used: boolean;
  generated_token?: string;
  asaas?: { id?: string; url?: string; enabled?: boolean };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function AsaasWebhookPanel() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const checkStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/webhooks/asaas/status", { credentials: "include" });
      const data = await res.json() as WebhookStatus;
      setStatus(data);
    } catch {
      setError("Falha ao verificar status.");
    } finally {
      setLoading(false);
    }
  };

  const setupWebhook = async () => {
    setSetting(true);
    setError(null);
    setSetupResult(null);
    try {
      const res = await fetch("/api/v1/webhooks/asaas/setup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json() as SetupResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setSetupResult(data);
      // Refresh status
      const statusRes = await fetch("/api/v1/webhooks/asaas/status", { credentials: "include" });
      setStatus(await statusRes.json() as WebhookStatus);
      queryClient.invalidateQueries({ queryKey: ["/api/v1/webhooks/stats"] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao configurar webhook.");
    } finally {
      setSetting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6B2B]" />
              Webhook Asaas
            </CardTitle>
            <CardDescription>
              Receba atualizações automáticas de status quando pagamentos Pix/Boleto forem pagos.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkStatus}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Verificar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status display */}
        {status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {status.configured && status.enabled && !status.interrupted ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : status.configured ? (
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {status.configured
                    ? status.enabled && !status.interrupted
                      ? "Webhook ativo e recebendo eventos"
                      : "Webhook configurado mas inativo"
                    : "Webhook não configurado"}
                </p>
                {status.url && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{status.url}</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Badge variant="outline" className={status.configured ? "border-green-500/30 text-green-600" : "border-red-500/30 text-red-600"}>
                  {status.configured ? "configurado" : "não configurado"}
                </Badge>
                {status.token_set && (
                  <Badge variant="outline" className="border-blue-500/30 text-blue-600">
                    token ativo
                  </Badge>
                )}
              </div>
            </div>

            {/* Expected URL */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">URL do endpoint</p>
              <div className="flex items-center gap-2 p-2 rounded bg-muted/40 border">
                <code className="text-xs flex-1 font-mono text-foreground/80 truncate">{status.expected_url}</code>
                <CopyButton text={status.expected_url} />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Clique em <strong>Verificar</strong> para checar o status atual, ou em{" "}
              <strong>Ativar Webhook</strong> para configurar automaticamente.
            </p>
          </div>
        )}

        {/* Setup result */}
        {setupResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 space-y-2">
            <p className="text-sm font-medium text-green-700">Webhook registrado com sucesso!</p>
            {setupResult.generated_token && (
              <div className="space-y-1">
                <p className="text-xs text-green-600">
                  Token gerado — salve como secret <code className="font-mono">ASAAS_WEBHOOK_TOKEN</code> para verificação:
                </p>
                <div className="flex items-center gap-2 p-2 rounded bg-white border border-green-200">
                  <code className="text-xs flex-1 font-mono text-gray-700 break-all">{setupResult.generated_token}</code>
                  <CopyButton text={setupResult.generated_token} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          onClick={setupWebhook}
          disabled={setting}
          className="w-full bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white gap-2"
        >
          {setting ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Configurando...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              {status?.configured ? "Reconfigurar Webhook" : "Ativar Webhook na Asaas"}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Eventos recebidos: pagamento pago, boleto vencido, estorno, chargeback.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Webhooks() {
  const { data: stats, isLoading: isLoadingStats } = useGetWebhookStats();
  const { data: deliveries, isLoading } = useListWebhookDeliveries();

  const statusBadge = (s: string) => {
    if (s === "success") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 border";
    if (s === "failed") return "bg-red-500/10 text-red-600 border-red-500/20 border";
    if (s === "retrying") return "bg-blue-500/10 text-blue-600 border-blue-500/20 border";
    return "bg-amber-500/10 text-amber-600 border-amber-500/20 border";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">Monitoramento de entregas e configuração de eventos.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        {isLoadingStats ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-[90px] w-full" />)
        ) : stats ? (
          <>
            {[
              { label: "Total", value: stats.total, cls: "" },
              { label: "Sucesso", value: stats.success, cls: "text-emerald-600" },
              { label: "Falhas", value: stats.failed, cls: "text-red-600" },
              { label: "Pendentes", value: stats.pending, cls: "text-amber-600" },
              { label: "Retentativas", value: stats.retrying, cls: "text-blue-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className={`text-xs font-medium ${s.cls}`}>{s.label}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <span className={`text-2xl font-bold ${s.cls}`}>{s.value}</span>
                </CardContent>
              </Card>
            ))}
          </>
        ) : null}
      </div>

      {/* Asaas webhook setup */}
      <AsaasWebhookPanel />

      {/* Delivery log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log de Entregas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : deliveries?.data && deliveries.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.data.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-mono text-xs">{delivery.event}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">{delivery.url}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(delivery.status)}>
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{delivery.http_status ?? "—"}</TableCell>
                    <TableCell className="text-sm">{delivery.attempts}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(delivery.created_at)}</TableCell>
                    <TableCell>
                      {delivery.status !== "success" && (
                        <Button variant="ghost" size="sm" className="text-xs">Reenviar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma entrega registrada. Os eventos da Asaas aparecerão aqui.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
