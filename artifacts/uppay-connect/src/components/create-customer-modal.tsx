import { useState } from "react";
import { useCreateCustomer } from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCheck, Building2, User } from "lucide-react";

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

function SuccessState({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  return (
    <div className="space-y-5 pt-1">
      <div className="flex flex-col items-center justify-center py-4 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <UserCheck className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-lg">{customer.name}</p>
          <p className="text-sm text-muted-foreground">Cliente cadastrado com sucesso</p>
        </div>
      </div>

      <div className="space-y-2 border rounded-lg divide-y">
        {customer.email && (
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">E-mail</span>
            <span className="font-medium">{customer.email}</span>
          </div>
        )}
        {customer.document && (
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">{customer.document_type?.toUpperCase() ?? "Documento"}</span>
            <span className="font-mono text-sm">{customer.document}</span>
          </div>
        )}
        {customer.asaas_customer_id && (
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">ID Asaas</span>
            <Badge variant="outline" className="font-mono text-xs border-green-500/30 text-green-600">
              sincronizado
            </Badge>
          </div>
        )}
      </div>

      <Button onClick={onClose} className="w-full bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white">
        Fechar
      </Button>
    </div>
  );
}

export function CreateCustomerModal() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [docType, setDocType] = useState<"cpf" | "cnpj">("cpf");
  const [document, setDocument] = useState("");

  const queryClient = useQueryClient();
  const { mutate, isPending, error } = useCreateCustomer({
    mutation: {
      onSuccess: (customer) => {
        setCreated(customer);
        queryClient.invalidateQueries({ queryKey: ["/api/v1/customers"] });
      },
    },
  });

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setCreated(null);
      setName("");
      setEmail("");
      setPhone("");
      setDocType("cpf");
      setDocument("");
    }, 200);
  };

  const handleDocChange = (val: string) => {
    const digits = val.replace(/\D/g, "");
    const maxLen = docType === "cpf" ? 11 : 14;
    setDocument(formatDocument(digits.slice(0, maxLen), docType));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawDoc = document.replace(/\D/g, "");
    mutate({
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
    return e?.response?.data?.error ?? e?.message ?? "Erro ao cadastrar cliente.";
  })();

  const isValid = name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white gap-2">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{created ? "Cliente Cadastrado" : "Novo Cliente"}</DialogTitle>
          <DialogDescription>
            {created ? "O cliente foi salvo e sincronizado com a Asaas." : "Preencha os dados para cadastrar um novo cliente."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <SuccessState customer={created} onClose={handleClose} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nome completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: João da Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">
                E-mail <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="joao@exemplo.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Telefone / WhatsApp <span className="text-muted-foreground font-normal text-xs">(opcional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* Document */}
            <div className="space-y-1.5">
              <Label>
                Documento <span className="text-muted-foreground font-normal text-xs">(obrigatório para Pix/Boleto)</span>
              </Label>
              <div className="flex gap-2">
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  <button
                    type="button"
                    onClick={() => { setDocType("cpf"); setDocument(""); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      docType === "cpf"
                        ? "bg-[#FF6B2B] text-white"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    CPF
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDocType("cnpj"); setDocument(""); }}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                      docType === "cnpj"
                        ? "bg-[#FF6B2B] text-white"
                        : "bg-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    CNPJ
                  </button>
                </div>
                <Input
                  placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  value={document}
                  onChange={(e) => handleDocChange(e.target.value)}
                  className="font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Asaas note */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
              <p className="text-xs text-blue-600">
                O cliente será sincronizado automaticamente com a Asaas ao salvar, permitindo cobranças via Pix e Boleto imediatamente.
              </p>
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
                    Salvando...
                  </span>
                ) : "Cadastrar Cliente"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
