import { useState } from "react";
import { useListApiKeys, useRevokeApiKey, useRotateApiKey } from "@workspace/api-client-react";
import type { ApiKeyWithSecret } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateApiKeyModal } from "@/components/create-api-key-modal";
import { ExpiringKeysBanner } from "@/components/expiring-keys-banner";
import { RefreshCw, Copy, Check, Clock } from "lucide-react";

function statusBadge(status: string) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
        active
      </Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
        expired
      </Badge>
    );
  }
  return <Badge variant="destructive">{status}</Badge>;
}

function RotatedKeyDialog({ apiKey, onClose }: { apiKey: ApiKeyWithSecret | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!apiKey) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={!!apiKey} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chave Rotacionada</DialogTitle>
          <DialogDescription>
            A chave anterior foi invalidada imediatamente. Copie a nova chave agora — ela não será exibida novamente.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <code className="flex-1 text-xs font-mono break-all">{apiKey.key}</code>
          <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <Button onClick={onClose} className="w-full bg-[#FF6B2B] hover:bg-[#FF6B2B]/90 text-white">
          Fechar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default function ApiKeys() {
  const { data, isLoading } = useListApiKeys();
  const queryClient = useQueryClient();
  const [rotatedKey, setRotatedKey] = useState<ApiKeyWithSecret | null>(null);

  const { mutate: revoke, isPending: isRevoking } = useRevokeApiKey({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/api-keys"] }) },
  });
  const { mutate: rotate, isPending: isRotating } = useRotateApiKey({
    mutation: {
      onSuccess: (apiKey) => {
        setRotatedKey(apiKey);
        queryClient.invalidateQueries({ queryKey: ["/api/v1/api-keys"] });
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Manage API keys for integrated systems.</p>
        </div>
        <CreateApiKeyModal />
      </div>

      <ExpiringKeysBanner />

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((apiKey) => (
                  <TableRow key={apiKey.id}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell className="font-mono text-xs">{apiKey.key_prefix}...</TableCell>
                    <TableCell>
                      <Badge variant={apiKey.environment === 'production' ? 'default' : 'secondary'}>
                        {apiKey.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>{statusBadge(apiKey.status)}</TableCell>
                    <TableCell>{formatDate(apiKey.last_used_at)}</TableCell>
                    <TableCell>
                      {apiKey.expires_at ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDate(apiKey.expires_at)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(apiKey.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {apiKey.status !== 'revoked' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRotating}
                            onClick={() => rotate({ id: apiKey.id, data: {} })}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Rotate
                          </Button>
                        )}
                        {apiKey.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={isRevoking}
                            onClick={() => revoke({ id: apiKey.id })}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No API keys found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <RotatedKeyDialog apiKey={rotatedKey} onClose={() => setRotatedKey(null)} />
    </div>
  );
}
