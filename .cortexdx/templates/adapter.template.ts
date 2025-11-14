import { z } from 'zod';

const RequestSchema = z.object({
	amountCents: z.number().int().nonnegative(),
	currency: z.string().length(3),
	sourceToken: z.string(),
	idempotencyKey: z.string().min(16).max(255),
});

export type CreateChargeInput = z.infer<typeof RequestSchema>;

export interface PaymentsSdk {
	createCharge: (payload: unknown) => Promise<unknown>;
}

export const createChargeAdapter = (sdk: PaymentsSdk) => async (input: CreateChargeInput) => {
	const payload = RequestSchema.parse(input);
	/**
	 * DOC: payments.createCharge
	 * @docsnap: docs/docsnap/payments-createCharge.docsnap.md
	 * @openapi: docs/vendor/openapi/payments-v1.json#/paths/~1charges/post
	 */
	return sdk.createCharge({
		amount: payload.amountCents,
		currency: payload.currency,
		source: payload.sourceToken,
		idempotency_key: payload.idempotencyKey,
	});
};
