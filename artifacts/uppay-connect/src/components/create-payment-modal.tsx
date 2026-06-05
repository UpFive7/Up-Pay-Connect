import { useState } from "react";
import { useCreatePayment, useListSystems } from "@workspace/api-client-react";
import type { Payment } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Plus, Copy, Check, ExternalLink, QrCode, FileText, Link2 } from "lucide-react";

type Step = "form" | "result";

const METHOD_OPTIONS = [
  { value: "pix", label: "Pix", icon: QrCode, provider: "Asaas" },
  { value: "boleto", label: "Boleto", icon: FileText, provider: "Asaas" },
  { value: "payment_link", label: "Link de Pagamento", icon: Link2, provider: "PagBank" },
  { value: "credit_card", label: "Cartão de Crédito", icon: ExternalLink, provider: "PagBank" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title="Copiar"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function PaymentResult({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const method = payment.payment_method;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/40 border">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
          <p className="text-xl font-bold text-[#FF6B2B]">{formatCurrency(payment.amount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-0.5">Status</p>
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 border">
            {payment.status}
          </Badge>
        </div>
      </div>

      {method === "pix" && payment.copy_paste && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pix Copia e Cola
          </Label>
          <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg border">
            <code className="text-xs break-all flex-1 leading-relaxed font-mono text-foreground/80">
              {payment.copy_paste}
            </code>
            <CopyButton text={payment.copy_paste} />
          </div>
        </div>
      )}

      {method === "boleto" && (
        <div className="space-y-3">
          {payment.boleto_digitable_line && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Linha Digitável
              </Label>
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border">
                <code className="text-xs flex-1 font-mono">{payment.boleto_digitable_line}</code>
                <CopyButton text={payment.boleto_digitable_line} />
              </div>
            </div>
          )}
          {payment.boleto_url && (
            <a
              href={payment.boleto_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 w-full justify-center py-2.5 px-4 rounded-lg border border-[#2563EB]/30 text-[#2563EB] text-sm font-medium hover:bg-[#2563EB]/5 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Visualizar Boleto
            </a>
          )}
          {payment.due_date && (
            <p className="text-xs text-center text-muted-foreground">
              Vencimento: <span className="font-medium">{payment.due_date}</span>
            </p>
          )}
        </div>
      )}

      {method === "payment_link" && payment.payment_link_url && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Link de Pagamento
          </Label>
          <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border">
            <span className="text-sm flex-1 text-[#2563EB] truncate">{payment.payment_link_url}</span>
            <CopyButton text={payment.payment_link_url} />
          </div>
          <a
            href={payment.payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full justify-center py-2.5 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#2563EB]/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Link
          </a>
        </div>
      )}

      {(method === "credit_card" || method === "debit_card") && payment.checkout_url && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Link de Checkout
          </Label>
          <a
            href={payment.checkout_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full justify-center py-2.5 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#2563EB]/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Ir para Checkout
          </a>
        </div>
      )}

      <div className="pt-1 border-t">
        <p className="text-xs text-muted-foreground text-center">
          ID: <span className="font-mono">{payment.id}</span>
        </p>
      </div>

      <Button onClick={onClose} className="w-full bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white">
        Fechar
      </Button>
    </div>
  );
}

export function CreatePaymentModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [createdPayment, setCreatedPayment] = useState<Payment | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [sourceSystem, setSourceSystem] = useState("");
  const [description, setDescription] = useState("");
  const [externalRef, setExternalRef] = useState("");

  const { data: systemsData } = useListSystems();
  const queryClient = useQueryClient();
  const { mutate, isPending, error } = useCreatePayment({
    mutation: {
      onSuccess: (payment) => {
        setCreatedPayment(payment);
        setStep("result");
        queryClient.invalidateQueries({ queryKey: ["/api/v1/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/v1/dashboard"] });
      },
    },
  });

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep("form");
      setCreatedPayment(null);
      setAmount("");
      setMethod("pix");
      setSourceSystem("");
      setDescription("");
      setExternalRef("");
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!cents || cents <= 0 || !sourceSystem) return;

    mutate({
      data: {
        amount: cents,
        currency: "BRL",
        payment_method: method,
        source_system: sourceSystem,
        description: description || undefined,
        external_reference: externalRef || undefined,
      },
    });
  };

  const selectedMethod = METHOD_OPTIONS.find((m) => m.value === method);
  const systems = Array.isArray(systemsData) ? systemsData : [];

  const isFormValid =
    amount.length > 0 &&
    parseFloat(amount.replace(",", ".")) > 0 &&
    sourceSystem.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white gap-2">
          <Plus className="w-4 h-4" />
          Novo Pagamento
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "form" ? "Criar Pagamento" : "Pagamento Criado"}
          </DialogTitle>
        </DialogHeader>

        {step === "result" && createdPayment ? (
          <PaymentResult payment={createdPayment} onClose={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Method selector */}
            <div className="space-y-1.5">
              <Label htmlFor="method">Método de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                {METHOD_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMethod(opt.value)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left ${
                        method === opt.value
                          ? "border-[#FF6B2B] bg-[#FF6B2B]/5 text-[#FF6B2B]"
                          : "border-border hover:border-muted-foreground/40 text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div>
                        <div className="leading-tight">{opt.label}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{opt.provider}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                  R$
                </span>
                <Input
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9,\.]/g, "");
                    setAmount(v);
                  }}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Source system */}
            <div className="space-y-1.5">
              <Label htmlFor="system">Sistema de Origem</Label>
              <Select value={sourceSystem} onValueChange={setSourceSystem} required>
                <SelectTrigger id="system">
                  <SelectValue placeholder="Selecione o sistema..." />
                </SelectTrigger>
                <SelectContent>
                  {systems.map((s) => (
                    <SelectItem key={s.id} value={s.slug}>
                      <div className="flex items-center gap-2">
                        <span>{s.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 h-4 ${
                            s.environment === "production"
                              ? "border-green-500/30 text-green-600"
                              : "border-amber-500/30 text-amber-600"
                          }`}
                        >
                          {s.environment}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">
                Descrição <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="desc"
                placeholder="Ex: Mensalidade Julho/2026"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* External reference */}
            <div className="space-y-1.5">
              <Label htmlFor="ref">
                Referência Externa <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="ref"
                placeholder="Ex: order_123"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
              />
            </div>

            {/* Summary */}
            {selectedMethod && amount && parseFloat(amount.replace(",", ".")) > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border text-sm">
                <span className="text-muted-foreground">
                  {selectedMethod.label} via {selectedMethod.provider}
                </span>
                <span className="font-semibold text-[#FF6B2B]">
                  {formatCurrency(Math.round(parseFloat(amount.replace(",", ".")) * 100))}
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-500 text-center">
                Erro ao criar pagamento. Tente novamente.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white"
                disabled={isPending || !isFormValid}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : (
                  "Criar Pagamento"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
