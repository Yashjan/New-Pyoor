import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage } from '@/components/legal/InfoPage';
import { CONTACT } from '@/lib/content/contact';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about Pyoor salts, packs, orders, shipping and payments.',
  alternates: { canonical: '/faq' },
};

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Where does Pyoor salt come from?',
    a: 'From Sambhar Lake in Rajasthan, India’s largest inland salt lake. We pack it at the lake.',
  },
  {
    q: 'What is Herbal Black Salt made of?',
    a: 'Sambhar lake salt, harad, baheda, amla and babul bark, fired in clay pots, as printed on the label.',
  },
  {
    q: 'What sizes do you sell?',
    a: 'Each salt comes in a 1 kg jar (₹199) and a 1 kg refill pouch (₹149) [CONFIRM].',
  },
  {
    q: 'How should I store it?',
    a: 'In a cool, dry place, away from direct heat and sunlight. Close the lid after use.',
  },
  {
    q: 'How long does delivery take?',
    a: (
      <>
        Usually 2–8 working days after dispatch, depending on where you are [CONFIRM]. See{' '}
        <Link href="/shipping">Shipping</Link>.
      </>
    ),
  },
  {
    q: 'Do you offer cash on delivery?',
    a: 'Yes, on most pin codes [CONFIRM]. You can also pay online by UPI, card or net banking through Razorpay.',
  },
  {
    q: 'My order arrived damaged. What do I do?',
    a: (
      <>
        Send us a photo within 48 hours of delivery and we’ll replace it or refund you. See{' '}
        <Link href="/returns">Refunds and returns</Link>.
      </>
    ),
  },
  {
    q: 'Is Pyoor licensed by FSSAI?',
    a: `Yes. Our FSSAI licence number is ${CONTACT.fssai}.`,
  },
  {
    q: 'Do you sell in bulk or to shops?',
    a: (
      <>
        Yes [CONFIRM]. WhatsApp us at <a href={CONTACT.whatsapp.url}>{CONTACT.whatsapp.label}</a>{' '}
        with what you need.
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <InfoPage eyebrow="Help" title="Questions, answered" lead="If yours isn’t here, write to us.">
      {QA.map(({ q, a }) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </InfoPage>
  );
}
