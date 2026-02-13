"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./CheckoutForm";
import Link from "next/link";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutPage() {
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/stripe/create-payment-intent", {
                    method: "POST",
                });
                const data = await res.json();
                setClientSecret(data.clientSecret);
            } catch (err) {
                console.error("Failed to init payment", err);
            }
        })();
    }, []);

    const options = useMemo(() => {
        if (!clientSecret) return undefined;
        return {
            clientSecret,
            appearance: {
                theme: "stripe" as const, // Automatically detects system preference or set explicitly
                variables: {
                    colorPrimary: "#18181b",
                    colorBackground: "#ffffff",
                    colorText: "#18181b",
                    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    borderRadius: '12px',
                },
            },
        };
    }, [clientSecret]);

    return (
        <div className="min-h-screen bg-muted/30">
            <header className="flex h-16 items-center border-b bg-background px-6">
                <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                    &larr; Cancel and return
                </Link>
            </header>

            <main className="container mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 py-10 lg:grid-cols-2 lg:px-8">
                {/* Order Summary Column */}
                <div className="order-2 lg:order-1">
                    <div className="sticky top-10 space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold">Order Summary</h2>
                            <p className="text-sm text-muted-foreground">Review your purchase details.</p>
                        </div>

                        <div className="rounded-xl border bg-background p-6 shadow-sm">
                            <div className="flex items-start justify-between border-b pb-6">
                                <div className="flex gap-4">
                                    <div className="h-16 w-16 rounded-lg bg-zinc-100 flex items-center justify-center text-2xl">
                                        📦
                                    </div>
                                    <div>
                                        <h3 className="font-medium">Conceptual Good v1</h3>
                                        <p className="text-sm text-muted-foreground">Digital License</p>
                                    </div>
                                </div>
                                <p className="font-medium">$0.50</p>
                            </div>
                            <div className="space-y-2 pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span>$0.50</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Taxes</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="flex justify-between border-t pt-4 font-semibold">
                                    <span>Total</span>
                                    <span>$0.50</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment Column */}
                <div className="order-1 lg:order-2">
                    <div className="rounded-xl border bg-background p-6 shadow-sm lg:p-8">
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold">Payment Details</h2>
                            <p className="text-sm text-muted-foreground">Complete your transaction securely.</p>
                        </div>

                        {!clientSecret || !options ? (
                            <div className="flex h-48 w-full items-center justify-center space-x-2">
                                <div className="h-4 w-4 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]"></div>
                                <div className="h-4 w-4 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]"></div>
                                <div className="h-4 w-4 animate-bounce rounded-full bg-zinc-400"></div>
                            </div>
                        ) : (
                            <Elements stripe={stripePromise} options={options}>
                                <CheckoutForm />
                            </Elements>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}