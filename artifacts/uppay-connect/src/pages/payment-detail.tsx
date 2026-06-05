import { useGetPayment, getGetPaymentQueryKey, useGetPaymentEvents, getGetPaymentEventsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, getStatusColor } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  
  const { data: payment, isLoading } = useGetPayment(id, {
    query: { enabled: !!id, queryKey: getGetPaymentQueryKey(id) }
  });

  const { data: events, isLoading: isLoadingEvents } = useGetPaymentEvents(id, {
    query: { enabled: !!id, queryKey: getGetPaymentEventsQueryKey(id) }
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-[200px]" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (!payment) {
    return <div>Payment not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/payments" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            Payment {payment.id.substring(0, 8)}
            <Badge variant="outline" className={getStatusColor(payment.status)}>
              {payment.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground">Processed by {payment.provider} via {payment.source_system}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium capitalize">{payment.payment_method.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Created At</span>
              <span className="font-medium">{formatDate(payment.created_at)}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Paid At</span>
              <span className="font-medium">{formatDate(payment.paid_at)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingEvents ? (
              <Skeleton className="h-[200px] w-full" />
            ) : events && events.length > 0 ? (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-4 items-start">
                    <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-medium text-sm">{event.event}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No events found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
