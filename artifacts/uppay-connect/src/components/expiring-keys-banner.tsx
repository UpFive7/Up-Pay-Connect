import { useListApiKeys } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/format";

const WARNING_WINDOW_DAYS = 7;

export function ExpiringKeysBanner() {
  const { data } = useListApiKeys();

  const expiringSoon = (data ?? []).filter((key) => {
    if (key.status !== "active" || !key.expires_at) return false;
    const msUntilExpiry = new Date(key.expires_at).getTime() - Date.now();
    return msUntilExpiry > 0 && msUntilExpiry <= WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  });

  if (expiringSoon.length === 0) return null;

  return (
    <Link href="/api-keys">
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 cursor-pointer hover:bg-amber-100/70 transition-colors">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-800">
          <span className="font-medium">
            {expiringSoon.length} {expiringSoon.length === 1 ? "API key expira" : "API keys expiram"} nos próximos {WARNING_WINDOW_DAYS} dias:
          </span>{" "}
          {expiringSoon.map((key, i) => (
            <span key={key.id}>
              {i > 0 && ", "}
              <span className="font-medium">{key.name}</span> ({formatDate(key.expires_at)})
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
