import type { Metadata } from 'next';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Pyoor collects when you order or join the newsletter, and how we use it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Policies"
      title="Privacy"
      lead={`${CONTACT.legalName} (“Pyoor”, “we”) collects only what we need to deliver your order and, if you ask, to write to you.`}
    >
      <h2>What we collect</h2>
      <h3>When you order</h3>
      <p>
        Your name, phone number, email, delivery address and the items you bought. Payments are
        handled by Razorpay: we never see or store your full card or bank details.
      </p>
      <h3>When you join the newsletter</h3>
      <p>Your email address, and the date you signed up.</p>
      <h3>When you browse</h3>
      <p>
        Your bag is kept in your own browser (local storage) so it is still there when you come
        back. We use basic, privacy-friendly analytics to see which pages are visited [CONFIRM]. We
        don’t use advertising trackers [CONFIRM].
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To pack, ship and deliver your order, and to keep you updated on it</li>
        <li>To answer your messages and handle returns</li>
        <li>To send the newsletter, only if you signed up; every email has an unsubscribe link</li>
        <li>To keep the records the law requires (for example, tax invoices)</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only the partners who help us deliver your order: our courier partners [CONFIRM], Razorpay
        for payments, and our email provider [CONFIRM] for the newsletter. We never sell your data.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order records for as long as tax law requires (currently 8 years) [CONFIRM]; newsletter
        details until you unsubscribe.
      </p>

      <h2>Your choices</h2>
      <p>
        You can ask to see, correct or delete your details, or unsubscribe at any time. Write to{' '}
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> [CONFIRM EMAIL] or WhatsApp{' '}
        <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a>.
      </p>

      <h2>Contact</h2>
      <p>
        {CONTACT.legalName}, {CONTACT.address}.
      </p>
    </InfoPage>
  );
}
