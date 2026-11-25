import type { Metadata } from 'next';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'WhatsApp, email and address for Pyoor Global Enterprises, Sambhar Lake, Rajasthan.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="Contact"
      title="Write to us"
      lead="We’re a small family business at Sambhar Lake. WhatsApp is the quickest way to reach us."
    >
      <h2>WhatsApp</h2>
      <p>
        <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a>, Monday to Saturday, 10:00 to
        18:00 IST.
      </p>
      <h2>Email</h2>
      <p>
        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
      </p>
      <h2>Address</h2>
      <p>
        {CONTACT.legalName}
        <br />
        {CONTACT.address}
      </p>
      <h2>Instagram</h2>
      <p>
        <a href={site.instagram}>@pyoorglobal</a>
      </p>
      <p>FSSAI Lic. No. {CONTACT.fssai}</p>
    </InfoPage>
  );
}
