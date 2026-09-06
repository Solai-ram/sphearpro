# Billing & Business Rule Specification

**Phase 0 Deliverable #7** — Covers §17, §27, §43 rules

---

## 1. Central Billing Engine (Single Source of Truth)

```
BillableItem (abstract)
    │
    ├── OP_VISIT          → references op_cases.id
    ├── THERAPY_PACKAGE   → references patient_packages.id
    ├── THERAPY_SESSION   → references therapy_sessions.id
    ├── PRODUCT           → references products.id
    └── OTHER             → manual entry
           │
           ��
      INVOICE (1:N InvoiceItem)
           │
           ├── subtotal
           ├── discountTotal
           ├── taxTotal
           └── grandTotal = subtotal - discountTotal + taxTotal
           │
           ��
      PAYMENT (1:N per Invoice)
           │
           ├── amount
           ├── method
           └── status
           │
           ��
      RECEIPT (generated on payment completion)
```

**Rule (§1122, §1142):** One billing engine — no separate billing per module. All billables normalized to `InvoiceItem`.

---

## 2. Invoice Rules

| Rule | Detail |
|------|--------|
| Invoice numbering | Sequential: `INV-YYYY-NNNNNN` |
| Status flow | `PENDING` → `PARTIALLY_PAID` → `PAID` (or `REFUNDED`/`CANCELLED`) |
| Grand total | `Σ(lineTotal) - discountTotal + taxTotal` |
| Discount | Applied per line or invoice-level (configurable) |
| Tax | Per line based on product/service tax rate |
| Rounding | Final amount rounded to 2 decimals (INR) |
| Void/Cancel | Only if `status=PENDING` and no payments |

---

## 3. Invoice Item Calculation

```typescript
function calculateLineTotal(item: InvoiceItemInput): Decimal {
  const base = item.unitPrice * item.quantity;
  const afterDiscount = base - item.discount;
  const taxAmount = afterDiscount * (item.taxRate / 100);
  return afterDiscount + taxAmount; // rounded to 2dp
}

// lineTotal stored on InvoiceItem for audit
```

**Line fields:** `billableType`, `referenceId`, `description`, `quantity`, `unitPrice`, `discount`, `tax`, `lineTotal`

---

## 4. Payment Rules

| Rule | Detail |
|------|--------|
| Partial payments | Allowed (US-BILL-002) — multiple payments per invoice |
| Allocation | Payment → `PaymentAllocation` links to specific invoice(s) |
| Overpayment | Not allowed (validated: `sum(allocations) <= payment.amount`) |
| Refund | Creates `Refund` linked to invoice + optional payment; adjusts invoice status |
| Methods | CASH, CARD, UPI, NET_BANKING, WALLET, OTHER |
| Receipt | Generated automatically on successful payment (PDF via Puppeteer) |

---

## 5. Billable Scenarios (Mapping to Invoice Items)

### 5.1 OP Consultation
```
Billable: OP_VISIT
Reference: op_cases.id (or op_visits.id)
Price: From clinic fee schedule (configurable per provider/type)
Invoice: Created on OP case completion or manually
```

### 5.2 Therapy Package
```
Billable: THERAPY_PACKAGE
Reference: patient_packages.id
Price: Snapshot from TherapyPackage.price at assignment time
Invoice: Created on package assignment (US-THER-003)
Sessions: No per-session billing (covered by package)
```

### 5.3 Individual Therapy Session (No Package)
```
Billable: THERAPY_SESSION
Reference: therapy_sessions.id
Price: From TherapyPackage.unitPrice or clinic rate card
Invoice: Created when session marked PRESENT (or batched daily)
Rule: TherapySession.patientPackageId = NULL
```

### 5.4 Product Sale
```
Billable: PRODUCT
Reference: products.id
Price: product.unitPrice at time of sale
Stock: stock_transactions (type=SALE, quantity=-1, balance updated)
Invoice: Created at point of sale (US-INV-003)
```

---

## 6. Discount Rules

| Type | Application |
|------|-------------|
| Percentage | `%` off line or invoice subtotal |
| Fixed | Flat amount off line or invoice subtotal |
| Validity | `validFrom` / `validTo` dates |
| Stacking | Configurable: allow/disallow multiple discounts |
| Authorization | Only BILLING/ADMIN roles can apply discounts > threshold |

---

## 7. Refund Rules (US-BILL-004)

| Rule | Detail |
|------|--------|
| Eligibility | Invoice status `PAID` or `PARTIALLY_PAID` |
| Amount | ≤ paid amount on invoice |
| Types | Full refund, partial refund |
| Audit | `Refund` record + `audit_logs` (PAYMENT_REFUNDED) |
| Reversal | If refund fails → status `FAILED`, no state change |

---

## 8. Outstanding Balance Calculation

```typescript
function getOutstandingBalance(patientId: string): Decimal {
  const invoices = await prisma.invoice.findMany({
    where: { patientId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
    select: { grandTotal: true, payments: { select: { amount: true } } }
  });
  
  return invoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((p, pay) => p + pay.amount, 0);
    return sum + (inv.grandTotal - paid);
  }, new Decimal(0));
}
```

---

## 9. Revenue Recognition

| Revenue Type | Recognized At |
|--------------|---------------|
| OP Consultation | Invoice creation (service delivered) |
| Therapy Package | Package assignment (deferred, recognized per session attended) |
| Therapy Session | Session completion (PRESENT) |
| Product Sale | Invoice creation (goods transferred) |

**Deferred revenue tracking:** `patient_packages` with `usedSessions` → recognized revenue = `(price/totalSessions) * usedSessions`

---

## 10. Tax Rules

| Item | Tax Treatment |
|------|---------------|
| Medical services (OP, therapy) | GST exempt (configurable per jurisdiction) |
| Products (hearing aids, etc.) | GST applicable (product.taxRate) |
| Packages | Based on composition (service vs product) |

---

## 11. Integration Points (Events)

| Event | Payload | Consumer |
|-------|---------|----------|
| `invoice.created` | {invoiceId, patientId, grandTotal} | WhatsApp (send), Dashboard, Reports |
| `payment.received` | {paymentId, invoiceId, amount} | Dashboard, Outstanding calc, WhatsApp (receipt) |
| `refund.processed` | {refundId, invoiceId, amount} | Dashboard, Outstanding, Audit |
| `product.sold` | {productId, quantity, invoiceId} | Inventory (stock decrement) |

---

## 12. Test Cases

| Scenario | Expected |
|----------|----------|
| Create invoice with 2 items (OP + product) | grandTotal = sum(lineTotals) |
| Partial payment (50%) | Invoice status = PARTIALLY_PAID |
| Full payment | Invoice status = PAID, receipt generated |
| Refund on paid invoice | Refund record created, invoice status = REFUNDED |
| Package assigned → 20 sessions | 1 invoice item THERAPY_PACKAGE, no per-session items |
| Non-package session attended | Invoice item THERAPY_SESSION created |
| Product sale | Stock transaction SALE, balance decremented |
| Discount > threshold requires admin | 403 if BILLING user applies >10% |
| Overpayment rejected | Validation error on PaymentAllocation sum |