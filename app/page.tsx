import Link from "next/link";

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="mr-4 hidden md:flex">
            <Link className="mr-6 flex items-center space-x-2 font-bold" href="/">
              <span className="hidden font-mono sm:inline-block">x402_store</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
          <div className="container mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center">
            <div className="rounded-2xl bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              v1.0 Release
            </div>

            <h1 className="font-heading text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
              The Conceptual Good
            </h1>

            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              A purely abstract digital artifact. Stored nowhere, owned everywhere.
              The ultimate minimalist asset for the discerning collector.
            </p>

            <div className="mt-8 flex flex-col gap-4 min-[400px]:flex-row">
              <Link
                href="/checkout"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                Purchase — $0.50
              </Link>
              <a
                href="https://docs.stripe.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Learn More
              </a>
            </div>
          </div>
        </section>

        <section className="container mx-auto max-w-5xl space-y-6 bg-slate-50 py-8 dark:bg-transparent md:py-12 lg:py-24">
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            {[
              "Instant Delivery",
              "Cryptographically Signed",
              "Carbon Neutral",
              "x402 Compatible",
              "Resalable",
              "Perpetual License",
            ].map((feature) => (
              <div
                key={feature}
                className="relative overflow-hidden rounded-lg border bg-background p-2"
              >
                <div className="flex h-[180px] flex-col justify-between rounded-md p-6">
                  <CheckIcon className="h-8 w-8 text-primary" />
                  <div className="space-y-2">
                    <h3 className="font-bold">{feature}</h3>
                    <p className="text-sm text-muted-foreground">
                      Guaranteed by the protocol.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with Hono, Stripe, and Next.js.
          </p>
        </div>
      </footer>
    </div>
  );
}