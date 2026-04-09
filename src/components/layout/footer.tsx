import Link from "next/link";
import { Gamepad2 } from "lucide-react";

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
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Gamepad2 className="h-4 w-4" />
              </div>
              <span className="text-lg font-bold gradient-text">Gamerhood</span>
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

        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Gamerhood. Made with love for young creators everywhere.
        </div>
      </div>
    </footer>
  );
}
