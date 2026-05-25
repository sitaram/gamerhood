"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Check,
  Link as LinkIcon,
  Mail,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Share2,
  ThumbsUp,
  X as XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ShareMenuProps {
  url: string;
  title: string;
  description?: string;
}

const subscribeNoop = () => () => {};
const getServerSnapshotFalse = () => false;

function getCanNativeShareSnapshot(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const hasShare = typeof navigator.share === "function";
  const isTouch =
    "ontouchstart" in window ||
    (typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 0);
  return hasShare && isTouch;
}

export function ShareMenu({ url, title, description }: ShareMenuProps) {
  const [copied, setCopied] = useState(false);
  const canNativeShare = useSyncExternalStore(
    subscribeNoop,
    getCanNativeShareSnapshot,
    getServerSnapshotFalse,
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied!");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return;
    }
    try {
      await navigator.share({ title, text: description ?? title, url });
    } catch {
      /* user cancelled */
    }
  }

  const smsBody = `Check out this design on Gamerhood: ${url}`;
  const emailSubject = "Check this out on Gamerhood";
  const emailBody = `I found this on Gamerhood: ${url}`;
  const socialText = `${title} on Gamerhood`;

  const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}&url=${encodeURIComponent(url)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${socialText} ${url}`)}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="lg"
            variant="outline"
            aria-label="Share this product"
            className="border-border/50"
          >
            <Share2 className="h-5 w-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopy} closeOnClick={false}>
          {copied ? (
            <Check className="text-neon-green" aria-hidden="true" />
          ) : (
            <LinkIcon aria-hidden="true" />
          )}
          <span>{copied ? "Copied!" : "Copy link"}</span>
        </DropdownMenuItem>
        <span aria-live="polite" className="sr-only">
          {copied ? "Link copied to clipboard" : ""}
        </span>

        <DropdownMenuItem
          render={
            <a href={smsHref} aria-label="Share via text message">
              <MessageCircle aria-hidden="true" />
              <span>Text message</span>
            </a>
          }
        />
        <DropdownMenuItem
          render={
            <a href={mailHref} aria-label="Share via email">
              <Mail aria-hidden="true" />
              <span>Email</span>
            </a>
          }
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          render={
            <a
              href={twitterHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on X"
            >
              <XIcon aria-hidden="true" />
              <span>X (Twitter)</span>
            </a>
          }
        />
        <DropdownMenuItem
          render={
            <a
              href={facebookHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on Facebook"
            >
              <ThumbsUp aria-hidden="true" />
              <span>Facebook</span>
            </a>
          }
        />
        <DropdownMenuItem
          render={
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Share on WhatsApp"
            >
              <MessageSquare aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
          }
        />

        {canNativeShare && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleNativeShare}>
              <MoreHorizontal aria-hidden="true" />
              <span>More options</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
