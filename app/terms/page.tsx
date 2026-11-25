import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms for buying from Pyoor Global Enterprises.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Policies"
      title="Terms of sale"
      lead={`These terms apply when you order from ${CONTACT.legalName}, Sambhar Lake, Rajasthan, on this website.`}
    >
      <h2>The products</h2>
      <p>
        Our salts are food products, packed under FSSAI licence {CONTACT.fssai}. What’s in each pack
        is printed on its label. Photos on the site show the product as closely as we can; natural
        salt varies a little in colour and crystal size from batch to batch.
      </p>

      <h2>Prices and payment</h2>
      <p>
        Prices are in Indian rupees and include GST [CONFIRM]. Shipping is shown at checkout. You
        can pay online through Razorpay (UPI, cards, net banking) or by cash on delivery where it’s
        available.
      </p>

      <h2>Your order</h2>
      <p>
        Your order is confirmed when we send you a confirmation. We may cancel an order (and refund
        it in full) if a product is out of stock, a price was shown wrongly, or we can’t deliver to
        your address.
      </p>

      <h2>Delivery</h2>
      <p>
        See <Link href="/shipping">Shipping</Link>. The risk in the goods passes to you on delivery.
      </p>

      <h2>Returns</h2>
      <p>
        See <Link href="/returns">Refunds and returns</Link>. Nothing in these terms affects your
        rights under the Consumer Protection Act, 2019.
      </p>

      <h2>Liability</h2>
      <p>
        We’re responsible for delivering what you ordered in good condition. Our liability for any
        order is limited to the amount you paid for it, except where the law says otherwise.
      </p>

      <h2>Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Courts in Jaipur, Rajasthan have jurisdiction
        [CONFIRM].
      </p>

      <h2>Grievances</h2>
      <p>
        Grievance officer: [CONFIRM NAME], {CONTACT.legalName}, {CONTACT.address}. WhatsApp{' '}
        <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a> or email{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> [CONFIRM EMAIL]. We acknowledge
        complaints within 48 hours and resolve them within 30 days [CONFIRM].
      </p>
    </InfoPage>
  );
}
