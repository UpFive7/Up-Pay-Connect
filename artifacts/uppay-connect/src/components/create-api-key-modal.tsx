import { useState } from "react";
import { useCreateApiKey, useListSystems } from "@workspace/api-client-react";
import type { ApiKeyWithSecret } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KeyRound, Copy, Check } from "lucide-react";

const PERMISSION_OPTIONS = [
  { value: "payments:read", label: "Pagamentos — leitura" },
  { value: "payments:write", label: "Pagamentos — escrita" },
  { value: "customers:read", label: "Clientes — leitura" },
  { value: "customers:write", label: "Clientes — escrita" },
  { value: "subscriptions:read", label: "Assinaturas — leitura" },
  { value: "subscriptions:write", label: "Assinaturas — escrita" },
  { value: "webhooks:read", label: "Webhooks — leitura" },
];

const EXPIRY_OPTIONS = [
  { value: "never", label: "Nunca expira" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
];

function SecretRevealState({ apiKey, onClose }: { apiKey: ApiKeyWithSecret; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs text-amber-700">
          Copie esta chave agora — ela não será exibida novamente.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <code className="flex-1 text-xs font-mono break-all">{apiKey.key}</code>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </Button>
      </div>

      <div className="space-y-2 border rounded-lg divide-y">
        <div className="flex justify-between px-3 py-2 text-sm">
          <span className="text-muted-foreground">Ambiente</span>
          <span className="font-medium">{apiKey.environment}</span>
        </div>
        <div className="flex justify-between px-3 py-2 text-sm">
          <span className="text-muted-foreground">Expira em</span>
          <span className="font-medium">
            {apiKey.expires_at ? new Date(apiKey.expires_at).toLocaleDateString("pt-BR") : "Nunca"}
          </span>
        </div>
      </div>

      <Button onClick={onClose} className="w-full bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white">
        Fechar
      </Button>
    </div>
  );
}

export function CreateApiKeyModal() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ApiKeyWithSecret | null>(null);

  const [systemId, setSystemId] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("never");

  const queryClient = useQueryClient();
  const { data: systems } = useListSystems();
  const { mutate, isPending, error } = useCreateApiKey({
    mutation: {
      onSuccess: (apiKey) => {
        setCreated(apiKey);
        queryClient.invalidateQueries({ queryKey: ["/api/v1/api-keys"] });
      },
    },
  });

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setCreated(null);
      setSystemId("");
      setName("");
      setEnvironment("sandbox");
      setPermissions([]);
      setExpiry("never");
    }, 200);
  };

  const togglePermission = (value: string) => {
    setPermissions((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expiresAt =
      expiry === "never" ? undefined : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1000).toISOString();
    mutate({
      data: {
        system_id: systemId,
        name,
        environment,
        permissions,
        expires_at: expiresAt,
      },
    });
  };

  const errorMessage = (() => {
    if (!error) return null;
    const e = error as { response?: { data?: { error?: string } }; message?: string };
    return e?.response?.data?.error ?? e?.message ?? "Erro ao criar a chave.";
  })();

  const isValid = systemId.length > 0 && name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white gap-2">
          <KeyRound className="w-4 h-4" />
          Create Key
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "Chave Criada" : "Nova API Key"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Guarde a chave em local seguro."
              : "Crie uma chave de API para um sistema integrado, com permissões e validade opcional."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <SecretRevealState apiKey={created} onClose={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>
                Sistema <span className="text-red-500">*</span>
              </Label>
              <Select value={systemId} onValueChange={setSystemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um sistema" />
                </SelectTrigger>
                <SelectContent>
                  {systems?.map((system) => (
                    <SelectItem key={system.id} value={system.id}>
                      {system.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="key-name">
                Nome <span className="text-red-500">*</span>
              </Label>
              <Input
                id="key-name"
                placeholder="Ex: Integração produção"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "production")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Validade</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Permissões</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {PERMISSION_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={permissions.includes(opt.value)}
                      onCheckedChange={() => togglePermission(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={isPending}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white"
                disabled={isPending || !isValid}
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando...
                  </span>
                ) : "Criar Chave"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
