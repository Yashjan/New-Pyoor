'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button/Button';
import { rupees, type OrderView } from '@/lib/checkout';
import styles from './Admin.module.css';

const KEY = 'pyoor:admin:token';
const STATUSES = [
  'pending',
  'paid',
  'cod_confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
] as const;
const LABEL: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  cod_confirmed: 'COD confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

type Row = {
  ref: string;
  status: string;
  payment: 'online' | 'cod';
  totalPaise: number;
  name: string;
  phone: string;
  city: string;
  createdAt: string;
};
type Detail = OrderView & {
  phone: string;
  email: string | null;
  tracking: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  next: string[];
  events: { type: string; payload: string | null; created_at: string }[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/** The private orders page (/admin): a Bearer ADMIN_TOKEN, kept for this tab only. */
export function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after hydration
      setToken(sessionStorage.getItem(KEY));
    } catch {
      // storage blocked: ask every time
    }
  }, []);

  const api = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`/api/admin${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        try {
          sessionStorage.removeItem(KEY);
        } catch {}
        setToken(null);
        setNote('That token wasn’t accepted.');
        throw new Error('unauthorized');
      }
      return res;
    },
    [token],
  );

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api(`/orders${status ? `?status=${status}` : ''}`).catch(() => null);
    if (res?.ok) setRows(((await res.json()) as { orders: Row[] }).orders);
  }, [api, status, token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the list is fetched; state is set after the response
    void load();
  }, [load]);

  const open = async (ref: string) => {
    setNote('');
    setTracking('');
    const res = await api(`/orders/${encodeURIComponent(ref)}`).catch(() => null);
    if (res?.ok) setDetail((await res.json()) as Detail);
  };

  const change = async (to: string) => {
    if (!detail) return;
    if (to === 'shipped' && !tracking.trim()) {
      setNote('Add the tracking number first.');
      return;
    }
    if (to === 'cancelled' && !window.confirm(`Cancel order ${detail.ref}?`)) return;
    const res = await api(`/orders/${encodeURIComponent(detail.ref)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: to, tracking: tracking.trim() || undefined }),
    }).catch(() => null);
    if (!res) return;
    const data = (await res.json()) as { error?: string };
    setNote(res.ok ? `Marked ${LABEL[to]?.toLowerCase()}.` : (data.error ?? 'Failed.'));
    await open(detail.ref);
    await load();
  };

  const exportCsv = async () => {
    const res = await api('/orders.csv').catch(() => null);
    if (!res?.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `pyoor-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!token)
    return (
      <form
        className={styles.login}
        onSubmit={(e) => {
          e.preventDefault();
          const t = input.trim();
          if (!t) return;
          try {
            sessionStorage.setItem(KEY, t);
          } catch {}
          setInput('');
          setNote('');
          setToken(t);
        }}
      >
        <label htmlFor="admin-token">Admin token</label>
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <Button type="submit" variant="primary">
          Sign in
        </Button>
        {note && <p className={styles.note}>{note}</p>}
      </form>
    );

  return (
    <div className={styles.admin}>
      <div className={styles.bar}>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setDetail(null);
            }}
            aria-label="Filter by status"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.link} onClick={() => void load()}>
          Refresh
        </button>
        <button type="button" className={styles.link} onClick={() => void exportCsv()}>
          Export CSV
        </button>
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            try {
              sessionStorage.removeItem(KEY);
            } catch {}
            setToken(null);
            setRows(null);
            setDetail(null);
          }}
        >
          Sign out
        </button>
      </div>

      <div className={styles.cols}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order</th>
              <th>Placed</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr
                key={r.ref}
                data-selected={detail?.ref === r.ref ? '' : undefined}
                onClick={() => void open(r.ref)}
              >
                <td>
                  <button type="button" className={styles.ref} onClick={() => void open(r.ref)}>
                    {r.ref}
                  </button>
                </td>
                <td>{when(r.createdAt)}</td>
                <td>
                  {r.name}
                  <small>{r.city}</small>
                </td>
                <td>
                  {rupees(r.totalPaise)}
                  <small>{r.payment === 'cod' ? 'COD' : 'Online'}</small>
                </td>
                <td>
                  <span className={styles.status} data-status={r.status}>
                    {LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5}>No orders.</td>
              </tr>
            )}
          </tbody>
        </table>

        {detail && (
          <section className={styles.detail} aria-label={`Order ${detail.ref}`}>
            <h2>
              {detail.ref}{' '}
              <span className={styles.status} data-status={detail.status} data-detail-status>
                {LABEL[detail.status]}
              </span>
            </h2>
            <p>
              {detail.name} · {detail.phone}
              {detail.email ? ` · ${detail.email}` : ''}
            </p>
            <p>{detail.address.join(', ')}</p>
            <ul>
              {detail.items.map((i) => (
                <li key={i.id}>
                  {i.name} ({i.format}) × {i.qty} · {rupees(i.unitPaise * i.qty)}
                </li>
              ))}
              <li>
                Shipping {rupees(detail.shippingPaise)} ·{' '}
                <strong>{rupees(detail.totalPaise)}</strong> (
                {detail.payment === 'cod' ? 'cash on delivery' : 'online'})
              </li>
            </ul>
            {detail.tracking && <p>Tracking: {detail.tracking}</p>}
            {detail.razorpayPaymentId && <p>Razorpay payment: {detail.razorpayPaymentId}</p>}

            {detail.next.length > 0 && (
              <div className={styles.actions}>
                {detail.next.includes('shipped') && (
                  <label>
                    <span>Tracking number</span>
                    <input value={tracking} onChange={(e) => setTracking(e.target.value)} />
                  </label>
                )}
                <div className={styles.buttons}>
                  {detail.next.map((s) => (
                    <Button
                      key={s}
                      variant={s === 'cancelled' ? 'secondary' : 'primary'}
                      onClick={() => void change(s)}
                    >
                      Mark {LABEL[s]?.toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {note && (
              <p className={styles.note} role="status">
                {note}
              </p>
            )}

            <h3>History</h3>
            <ol className={styles.events}>
              {detail.events.map((e, i) => (
                <li key={i}>
                  <time>{when(e.created_at)}</time> {e.type}
                  {e.payload && <code>{e.payload}</code>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
