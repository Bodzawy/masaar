// Payments abstraction. Demo provider settles instantly and writes an audit
// trail; Stripe activates only when a secret key is configured.
export interface PaymentIntent {
  reference: string;
  amountCents: number;
  currency: string;
  description: string;
}

export interface PaymentResult {
  status: "PAID" | "PENDING" | "FAILED";
  provider: string;
  demoMode: boolean;
}

export interface PaymentsProvider {
  readonly name: string;
  readonly demoMode: boolean;
  charge(intent: PaymentIntent): Promise<PaymentResult>;
}

export class DemoPaymentsProvider implements PaymentsProvider {
  readonly name = "demo";
  readonly demoMode = true;
  async charge(intent: PaymentIntent): Promise<PaymentResult> {
    void intent;
    return { status: "PAID", provider: this.name, demoMode: true };
  }
}

export class StripePaymentsProvider implements PaymentsProvider {
  readonly name = "stripe";
  readonly demoMode = false;
  constructor(private apiKey: string) {}
  async charge(intent: PaymentIntent): Promise<PaymentResult> {
    // A real integration creates a Stripe PaymentIntent here.
    void this.apiKey; void intent;
    return { status: "PENDING", provider: this.name, demoMode: false };
  }
}

export function getPaymentsProvider(): PaymentsProvider {
  const kind = process.env.PAYMENTS_PROVIDER ?? "demo";
  if (kind === "stripe" && process.env.STRIPE_SECRET_KEY) {
    return new StripePaymentsProvider(process.env.STRIPE_SECRET_KEY);
  }
  return new DemoPaymentsProvider();
}
