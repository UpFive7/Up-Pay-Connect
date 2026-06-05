export function formatCurrency(cents: number | undefined | null) {
  if (cents == null) return "-";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(dateString: string | undefined | null) {
  if (!dateString) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateString));
}

export function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "processing":
    case "authorized":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "failed":
    case "refused":
    case "chargeback":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "expired":
    case "cancelled":
      return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    case "refunded":
    case "partially_refunded":
      return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    case "under_review":
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
