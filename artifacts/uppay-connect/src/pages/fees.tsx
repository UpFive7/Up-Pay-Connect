import { useListFees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Fees() {
  const { data, isLoading } = useListFees();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Provider Fees</h1>
          <p className="text-muted-foreground">Configure payment provider fees.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Fee Configuration
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fixed</TableHead>
                  <TableHead>Percentage</TableHead>
                  <TableHead>Settlement</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium capitalize">{fee.provider}</TableCell>
                    <TableCell className="capitalize">{fee.payment_method.replace('_', ' ')}</TableCell>
                    <TableCell className="capitalize">{fee.fee_type}</TableCell>
                    <TableCell>{fee.fixed_amount ? formatCurrency(fee.fixed_amount) : '-'}</TableCell>
                    <TableCell>{fee.percentage_rate ? `${fee.percentage_rate}%` : '-'}</TableCell>
                    <TableCell>{fee.settlement_days ? `${fee.settlement_days} days` : 'Instant'}</TableCell>
                    <TableCell>
                      <Badge variant={fee.active ? 'outline' : 'secondary'} className={fee.active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                        {fee.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
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
