import type { Metadata } from 'next';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Shipping',
  description: 'Where Pyoor ships, how long dispatch and delivery take, and cash on delivery.',
  alternates: { canonical: '/shipping' },
};

export default function ShippingPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="Shipping"
      lead="We pack every order at Sambhar Lake and send it across India."
    >
      <h2>Where we ship</h2>
      <p>
        We ship across India through Shiprocket’s courier partners. If your pin code isn’t
        serviceable, we’ll tell you at checkout or contact you before dispatch. We don’t ship
        outside India yet.
      </p>

      <h2>When your order leaves</h2>
      <p>
        Orders are packed and dispatched within 1–2 working days. Orders placed on Sundays and
        public holidays are dispatched on the next working day.
      </p>

      <h2>How long delivery takes</h2>
      <ul>
        <li>Anywhere in India: 3–7 working days</li>
      </ul>
      <p>These are our couriers’ estimates. Remote areas and weather can add a few days.</p>

      <h2>Shipping charges</h2>
      <p>
        Shipping is free on orders of ₹{site.shipping.freeFrom} and above. Below that, it is a flat
        ₹{site.shipping.charge} per order. Your bag shows how close you are to free shipping.
      </p>

      <h2>Cash on delivery</h2>
      <p>
        Cash on delivery is available on orders up to ₹2,000, with no extra fee. Please keep the
        exact amount ready.
      </p>

      <h2>Tracking</h2>
      <p>
        Once your order is dispatched we send the tracking link by SMS, email or WhatsApp. If it
        hasn’t moved in 3 days, write to us.
      </p>

      <h2>Questions</h2>
      <p>
        WhatsApp <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a> or email{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
      </p>
    </InfoPage>
  );
}
