"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for the listing edit page. Server-side
 * crashes during render get streamed here instead of replacing the whole
 * page with Next's default `global-error` ("A server error occurred…").
 *
 * The `digest` is the Vercel-side correlation id — surfacing it lets us
 * jump straight to the matching log line when a creator pastes the screen
 * into support.
 */
export default function EditListingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      "[dashboard/listings/[id]/edit] render error",
      { digest: error.digest, message: error.message, stack: error.stack },
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/listings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to listings
      </Link>
      <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-6">
        <h1 className="text-xl font-semibold text-destructive">
          We couldn&apos;t load this listing
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong rendering the edit screen. The error has been
          reported. You can retry, or head back to your listings and try a
          different one.
        </p>
        {error.digest && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            Reference id: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => reset()} className="bg-primary hover:bg-primary/90">
            Retry
          </Button>
          <Link href="/dashboard/listings">
            <Button variant="outline">Back to listings</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
