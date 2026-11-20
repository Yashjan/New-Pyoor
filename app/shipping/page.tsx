import type { Metadata } from 'next';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';

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
        We ship to most pin codes in India through our courier partners [CONFIRM]. If your pin code
        isn’t serviceable, we’ll tell you at checkout or contact you before dispatch. We don’t ship
        outside India yet.
      </p>

      <h2>When your order leaves</h2>
      <p>
        Orders placed before 2 pm IST [CONFIRM] on a working day are packed and dispatched within
        1–2 working days [CONFIRM]. Orders placed on Sundays and public holidays are dispatched on
        the next working day.
      </p>

      <h2>How long delivery takes</h2>
      <ul>
        <li>Rajasthan: 2–4 working days after dispatch [CONFIRM]</li>
        <li>Metro cities: 3–5 working days [CONFIRM]</li>
        <li>Rest of India: 4–8 working days [CONFIRM]</li>
      </ul>
      <p>
        These are estimates from our courier partners. Remote areas and weather can add a few days.
      </p>

      <h2>Shipping charges</h2>
      <p>
        Shipping is charged at checkout based on your pin code and the weight of your order
        [CONFIRM]. If we offer free shipping above an order value, it is shown in your bag.
      </p>

      <h2>Cash on delivery</h2>
      <p>
        Cash on delivery is available on most pin codes [CONFIRM], up to an order value of ₹2,000
        [CONFIRM]. A COD fee of ₹0 [CONFIRM] may apply. Please keep the exact amount ready.
      </p>

      <h2>Tracking</h2>
      <p>
        Once your order is dispatched we send the tracking link by SMS, email or WhatsApp. If it
        hasn’t moved in 3 days, write to us.
      </p>

      <h2>Questions</h2>
      <p>
        WhatsApp <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a> or email{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> [CONFIRM EMAIL].
      </p>
    </InfoPage>
  );
}
