import Link from "next/link";
import { BrandWordmark } from "@/components/brand/brand-logo";

const LINKS = {
  Create: [
    { href: "/create", label: "Design Studio" },
    { href: "/shop", label: "Browse Merch" },
    { href: "/dashboard", label: "Creator Dashboard" },
  ],
  Company: [
    { href: "/about", label: "About Us" },
    { href: "/safety", label: "Kid Safety" },
    { href: "/faq", label: "FAQ" },
  ],
  Legal: [
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/dmca", label: "DMCA Policy" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block w-full max-w-[min(100%,28rem)]">
              <BrandWordmark className="object-center !h-auto !max-h-28 w-full md:!max-h-32" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Where young creators turn ideas into real merch. For the kids, by the kids.
            </p>
          </div>

          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground space-y-1">
          <p>
            &copy; {new Date().getFullYear()} GamerHood.GG &middot; GamerHood LLC
          </p>
          <p>California Entity No. B20260245578</p>
          <p className="pt-1">Made with love for young creators everywhere.</p>
        </div>
      </div>
    </footer>
  );
}
