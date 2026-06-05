import { useListWebhookDeliveries, useGetWebhookStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Webhooks() {
  const { data: stats, isLoading: isLoadingStats } = useGetWebhookStats();
  const { data: deliveries, isLoading } = useListWebhookDeliveries();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">Monitor webhook deliveries.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {isLoadingStats ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-[100px] w-full" />)
        ) : stats ? (
          <>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats.total}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-emerald-600">Success</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">{stats.success}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Failed</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-600">{stats.failed}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-amber-600">Pending</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-amber-600">{stats.pending}</CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-blue-600">Retrying</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-blue-600">{stats.retrying}</CardContent></Card>
          </>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : deliveries?.data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.data.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium text-xs">{delivery.event}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{delivery.url}</TableCell>
                    <TableCell>
                      <Badge variant={delivery.status === 'success' ? 'outline' : 'secondary'} className={delivery.status === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : delivery.status === 'failed' ? 'bg-red-500/10 text-red-600 border-red-500/20' : ''}>
                        {delivery.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{delivery.http_status || '-'}</TableCell>
                    <TableCell>{delivery.attempts}</TableCell>
                    <TableCell>{formatDate(delivery.created_at)}</TableCell>
                    <TableCell>
                      {delivery.status !== 'success' && (
                        <Button variant="ghost" size="sm">Resend</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
