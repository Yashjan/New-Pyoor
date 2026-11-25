import type { Metadata } from 'next';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';

export const metadata: Metadata = {
  title: 'Refunds and returns',
  description:
    'Pyoor salt is a food product: we replace or refund damaged or wrong items reported with a photo within 48 hours.',
  alternates: { canonical: '/returns' },
};

export default function ReturnsPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Refunds and returns"
      lead="Salt is a food product, so we can’t take back opened or unwanted items. If something arrives damaged or wrong, we’ll put it right."
    >
      <h2>What we replace or refund</h2>
      <ul>
        <li>A jar or pouch that arrives broken, leaking or with a damaged seal</li>
        <li>A wrong product, size or quantity</li>
        <li>A missing item from your order</li>
      </ul>

      <h2>How to tell us</h2>
      <ol>
        <li>
          Within <strong>48 hours</strong> of delivery, WhatsApp{' '}
          <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a> or email{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
        </li>
        <li>Send your order number and a clear photo of the item and the outer box.</li>
        <li>We reply within 1 working day and arrange a replacement or a refund.</li>
      </ol>
      <p>
        You usually don’t need to send anything back. If we need the item, we arrange the pickup at
        no cost to you.
      </p>

      <h2>What we can’t take back</h2>
      <ul>
        <li>Opened jars or pouches, unless the product was damaged or wrong</li>
        <li>Orders reported more than 48 hours after delivery</li>
        <li>A change of mind after the order has been dispatched</li>
      </ul>

      <h2>Cancelling an order</h2>
      <p>
        You can cancel free of charge until your order is dispatched. Write to us with your order
        number.
      </p>

      <h2>Refunds</h2>
      <p>
        Prepaid orders are refunded to the original payment method through Razorpay within 5–7
        working days of approval. For cash-on-delivery orders we refund by UPI or bank transfer.
      </p>
    </InfoPage>
  );
}
