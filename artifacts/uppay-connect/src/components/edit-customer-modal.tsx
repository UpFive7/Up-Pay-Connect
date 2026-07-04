import { useState, useEffect } from "react";
import { useUpdateCustomer, getGetCustomerQueryKey, getListCustomersQueryKey } from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, User, Building2 } from "lucide-react";

function formatDocument(value: string, type: string) {
  const digits = value.replace(/\D/g, "");
  if (type === "cpf") {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").slice(0, 14);
  }
  if (type === "cnpj") {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").slice(0, 18);
  }
  return value;
}

export function EditCustomerModal({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [docType, setDocType] = useState<"cpf" | "cnpj">(
    (customer.document_type as "cpf" | "cnpj") ?? "cpf"
  );
  const [document, setDocument] = useState(customer.document ?? "");

  useEffect(() => {
    if (open) {
      setName(customer.name);
      setEmail(customer.email ?? "");
      setPhone(customer.phone ?? "");
      setDocType((customer.document_type as "cpf" | "cnpj") ?? "cpf");
      setDocument(customer.document ?? "");
    }
  }, [open, customer]);

  const queryClient = useQueryClient();
  const { mutate, isPending, error } = useUpdateCustomer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customer.id) });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
        setOpen(false);
      },
    },
  });

  const handleDocChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    const maxLen = docType === "cpf" ? 11 : 14;
    setDocument(formatDocument(digits.slice(0, maxLen), docType));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawDoc = document.replace(/\D/g, "");
    mutate({
      id: customer.id,
      data: {
        name,
        email: email || undefined,
        phone: phone || undefined,
        document: rawDoc || undefined,
        document_type: rawDoc ? docType : undefined,
      },
    });
  };

  const errorMessage = (() => {
    if (!error) return null;
    const e = error as { response?: { data?: { error?: string } }; message?: string };
    return e?.response?.data?.error ?? e?.message ?? "Erro ao atualizar cliente.";
  })();

  const isValid = name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5" />
        Editar
      </Button>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Atualize os dados do cliente. As mudanças serão sincronizadas com a Asaas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">
              Nome completo <span className="text-red-500">*</span>
            </Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email">E-mail</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone">Telefone / WhatsApp</Label>
            <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Documento</Label>
            <div className="flex gap-2">
              <div className="flex rounded-md border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => { setDocType("cpf"); setDocument(""); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    docType === "cpf" ? "bg-[#FF6B2B] text-white" : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  CPF
                </button>
                <button
                  type="button"
                  onClick={() => { setDocType("cnpj"); setDocument(""); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    docType === "cnpj" ? "bg-[#FF6B2B] text-white" : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  CNPJ
                </button>
              </div>
              <Input
                value={document}
                onChange={(e) => handleDocChange(e.target.value)}
                className="font-mono"
                inputMode="numeric"
                placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
              />
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1" disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white" disabled={isPending || !isValid}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
