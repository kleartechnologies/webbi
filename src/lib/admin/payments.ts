import "server-only";
import type { DocumentData, Query } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { PAYMENT_FIELDS, REFUND_REASONS, toPaymentDto, type AdminPaymentDto } from "./dto";
import { queryPage } from "./paging";
import type { PaymentView } from "./schemas";
import { emailsFor } from "./users";

/** Payments for the admin panel, read only. checkoutUrl is never read (PAYMENT_FIELDS). */

function viewQuery(view: PaymentView): Query<DocumentData> {
  const payments = adminDb().collection("payments");
  const query =
    view === "paid"
      ? payments.where("status", "==", "paid").orderBy("paidAt", "desc")
      : view === "pending"
        ? payments.where("status", "==", "pending").orderBy("createdAt", "desc")
        : view === "failed"
          ? payments.where("status", "==", "failed").orderBy("createdAt", "desc")
          : view === "attention"
            ? payments.where("needsAttention", "==", true).orderBy("updatedAt", "desc")
            : view === "refund"
              ? payments.where("needsAttention", "==", true).where("attentionReason", "in", REFUND_REASONS).orderBy("updatedAt", "desc")
              : payments.orderBy("createdAt", "desc");
  return query.select(...PAYMENT_FIELDS);
}

export async function listPayments(input: { view: PaymentView; limit: number; cursor?: string }): Promise<{
  payments: AdminPaymentDto[];
  nextCursor: string | null;
}> {
  const page = await queryPage(viewQuery(input.view), "payments", input.cursor, input.limit);
  const emails = await emailsFor(page.docs.map((doc) => doc.get("ownerUid")));
  return {
    payments: page.docs.map((doc) => toPaymentDto(doc.id, doc.data(), emails.get(doc.get("ownerUid")) ?? null)),
    nextCursor: page.nextCursor,
  };
}
