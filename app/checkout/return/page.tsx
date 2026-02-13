"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function ReturnPage() {
    const [status, setStatus] = useState<string>("processing");
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const stripe = await stripePromise;
            const clientSecret = new URLSearchParams(window.location.search).get(
                "payment_intent_client_secret"
            );

            if (!stripe || !clientSecret) {
                setStatus("error");
                return;
            }

            const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

            if (paymentIntent) {
                setStatus(paymentIntent.status);
                if (paymentIntent.receipt_email) setEmail(paymentIntent.receipt_email);
            }
        })();
    }, []);

    // Icons
    const SuccessIcon = () => (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        </div>
    );

    const ProcessingIcon = () => (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
        </div>
    );

    const ErrorIcon = () => (
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </div>
    );

    let content;
    if (status === 'succeeded') {
        content = (
            <>
                <SuccessIcon />
                <h1 className="mb-2 text-2xl font-bold">Payment Successful</h1>
                <p className="mb-8 text-muted-foreground">
                    Thank you for your purchase. {email ? `A receipt has been sent to ${email}.` : ""}
                </p>
                <div className="rounded-lg border bg-muted/50 p-4 text-left text-sm">
                    <p className="font-mono text-xs uppercase text-muted-foreground">Item</p>
                    <p className="font-medium">Conceptual Good v1</p>
                </div>
            </>
        );
    } else if (status === 'processing') {
        content = (
            <>
                <ProcessingIcon />
                <h1 className="mb-2 text-2xl font-bold">Processing Payment</h1>
                <p className="text-muted-foreground">Please wait while we confirm your transaction...</p>
            </>
        );
    } else {
        content = (
            <>
                <ErrorIcon />
                <h1 className="mb-2 text-2xl font-bold">Payment Failed</h1>
                <p className="mb-6 text-muted-foreground">Something went wrong with your transaction.</p>
                <Link href="/checkout" className="text-primary hover:underline">Try again</Link>
            </>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
            <div className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-sm">
                {content}

                <div className="mt-8 border-t pt-6">
                    <Link
                        href="/"
                        className="block w-full rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                    >
                        Return to Store
                    </Link>
                </div>
            </div>
        </div>
    );
}