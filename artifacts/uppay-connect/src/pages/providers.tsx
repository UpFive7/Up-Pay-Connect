import { useListProviders } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function Providers() {
  const { data, isLoading } = useListProviders();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Providers</h1>
          <p className="text-muted-foreground">Manage payment providers.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : data ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Supported Methods</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium capitalize">{provider.provider}</TableCell>
                    <TableCell>
                      <Badge variant={provider.environment === 'production' ? 'default' : 'secondary'}>
                        {provider.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={provider.status === 'active' ? 'outline' : 'secondary'} className={provider.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                        {provider.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{provider.priority || '-'}</TableCell>
                    <TableCell className="text-xs">
                      {provider.supported_methods?.join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Configure</Button>
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
