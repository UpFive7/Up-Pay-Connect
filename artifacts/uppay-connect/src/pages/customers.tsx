import { useState } from "react";
import { useListCustomers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import { CreateCustomerModal } from "@/components/create-customer-modal";

function DocumentBadge({ document, type }: { document?: string | null; type?: string | null }) {
  if (!document) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs">{document}</span>
      {type && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 uppercase">
          {type}
        </Badge>
      )}
    </div>
  );
}

function AsaasStatus({ id }: { id?: string | null }) {
  if (!id) return <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">não sincronizado</Badge>;
  return <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600">Asaas ✓</Badge>;
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListCustomers(search ? { search } : {});

  const customers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Cadastre e gerencie sua base de clientes.</p>
        </div>
        <CreateCustomerModal />
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Asaas</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex items-center gap-2 font-medium text-[#2563EB] hover:underline"
                      >
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{customer.email ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{customer.phone ?? "—"}</TableCell>
                    <TableCell>
                      <DocumentBadge document={customer.document} type={customer.document_type} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.address_city && customer.address_state
                        ? `${customer.address_city} — ${customer.address_state}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <AsaasStatus id={customer.asaas_customer_id} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(customer.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search ? `Nenhum cliente encontrado para "${search}".` : "Nenhum cliente cadastrado ainda."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
