import { useListSystems } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Systems() {
  const { data, isLoading } = useListSystems();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrated Systems</h1>
          <p className="text-muted-foreground">Manage systems that connect to UpPay.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add System
        </Button>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Webhook URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((system) => (
                  <TableRow key={system.id}>
                    <TableCell className="font-medium">{system.name}</TableCell>
                    <TableCell className="font-mono text-xs">{system.slug}</TableCell>
                    <TableCell>
                      <Badge variant={system.environment === 'production' ? 'default' : 'secondary'}>
                        {system.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={system.status === 'active' ? 'outline' : 'secondary'} className={system.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                        {system.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">
                      {system.default_webhook_url || "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      No systems found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
