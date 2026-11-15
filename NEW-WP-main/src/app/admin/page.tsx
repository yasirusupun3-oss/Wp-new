'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import {
  Users,
  Receipt,
  Wallet,
  Radio,
  Shield,
  Loader2,
  Check,
  X,
  Ban,
  ShieldCheck,
} from 'lucide-react';

// Client-side gate only decides whether to show the admin UI — the real
// protection is server-side (requireAdmin in every /api/admin/* route
// verifies the signed-in user's Firebase ID token against ADMIN_EMAIL).
// Needs the NEXT_PUBLIC_ prefix since this runs in the browser.
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';

type Tab = 'users' | 'transactions' | 'withdrawals' | 'live';

interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  coinBalance: number;
  totalEarned: number;
  totalSpent: number;
  banned: boolean;
  createdAt: number | null;
}

interface AdminTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: number | null;
}

interface AdminWithdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  walletAddress: string;
  networkName: string;
  currency: string;
  finalPayoutAmount: number;
  status: string;
  createdAt: number | null;
}

interface AdminLiveStream {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  viewerCount: number;
  totalGifts: number;
  totalCoins: number;
  createdAt: number | null;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    },
  });
  return res.json();
}

function fmtDate(ms: number | null) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

  const isAdmin = !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B141A]">
        <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#0B141A] px-6 text-center">
        <Shield className="w-10 h-10 text-red-400" />
        <p className="text-white font-medium">Access denied</p>
        <p className="text-white/50 text-sm">This page is only available to the admin account.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B141A] pb-10">
      <div className="sticky top-0 z-10 bg-[#111B21] border-b border-white/10 px-4 py-3">
        <h1 className="text-white text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#25D366]" /> Admin Panel
        </h1>
        <div className="flex gap-1 mt-3 overflow-x-auto no-scrollbar">
          {([
            { id: 'users', label: 'Users', icon: Users },
            { id: 'transactions', label: 'Transactions', icon: Receipt },
            { id: 'withdrawals', label: 'Withdrawals', icon: Wallet },
            { id: 'live', label: 'Live Streams', icon: Radio },
          ] as { id: Tab; label: string; icon: typeof Users }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${
                tab === id ? 'bg-[#25D366] text-black' : 'bg-white/5 text-white/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {tab === 'users' && <UsersTab />}
        {tab === 'transactions' && <TransactionsTab />}
        {tab === 'withdrawals' && <WithdrawalsTab />}
        {tab === 'live' && <LiveStreamsTab />}
      </div>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch('/api/admin/users');
    if (data.success) setUsers(data.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBan = async (uid: string, ban: boolean) => {
    setBusyUid(uid);
    await authedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ action: ban ? 'ban' : 'unban', uid }),
    });
    await load();
    setBusyUid(null);
  };

  const handleAdjust = async (uid: string) => {
    const raw = adjustAmount[uid];
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount) || amount === 0) return;
    setBusyUid(uid);
    await authedFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ action: 'adjustCoins', uid, amount, reason: 'Manual admin adjustment' }),
    });
    setAdjustAmount((prev) => ({ ...prev, [uid]: '' }));
    await load();
    setBusyUid(null);
  };

  if (loading) return <Centered />;

  return (
    <div className="space-y-3">
      {users.length === 0 && <EmptyState text="No users yet." />}
      {users.map((u) => (
        <div key={u.uid} className="bg-white/5 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-semibold">{u.displayName}</p>
              <p className="text-white/40 text-xs">{u.email}</p>
            </div>
            {u.banned && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Banned</span>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-white/60">
            <span>Balance: <span className="text-[#FFD700] font-medium">{u.coinBalance.toLocaleString()}</span></span>
            <span>Earned: {u.totalEarned.toLocaleString()}</span>
            <span>Spent: {u.totalSpent.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number"
              placeholder="± coins"
              value={adjustAmount[u.uid] || ''}
              onChange={(e) => setAdjustAmount((prev) => ({ ...prev, [u.uid]: e.target.value }))}
              className="flex-1 min-w-0 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
            />
            <button
              disabled={busyUid === u.uid}
              onClick={() => handleAdjust(u.uid)}
              className="px-3 py-1.5 rounded-lg bg-[#25D366] text-black text-xs font-semibold disabled:opacity-50"
            >
              Apply
            </button>
            <button
              disabled={busyUid === u.uid}
              onClick={() => handleBan(u.uid, !u.banned)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-50 ${
                u.banned ? 'bg-white/10 text-white' : 'bg-red-500/20 text-red-400'
              }`}
            >
              {u.banned ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {u.banned ? 'Unban' : 'Ban'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Transactions Tab ───────────────────────────────────────────────────
function TransactionsTab() {
  const [txs, setTxs] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch('/api/admin/transactions').then((data) => {
      if (data.success) setTxs(data.transactions);
      setLoading(false);
    });
  }, []);

  if (loading) return <Centered />;

  return (
    <div className="space-y-2">
      {txs.length === 0 && <EmptyState text="No transactions yet." />}
      {txs.map((tx) => (
        <div key={tx.id} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-medium truncate">{tx.description}</p>
            <p className="text-white/35 text-[10px] mt-0.5">{tx.userId} • {fmtDate(tx.createdAt)}</p>
          </div>
          <span className={`text-sm font-semibold shrink-0 ml-2 ${tx.amount >= 0 ? 'text-[#25D366]' : 'text-red-400'}`}>
            {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Withdrawals Tab ────────────────────────────────────────────────────
function WithdrawalsTab() {
  const [reqs, setReqs] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch('/api/admin/withdrawals');
    if (data.success) setReqs(data.requests);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setBusyId(requestId);
    setError('');
    const data = await authedFetch('/api/admin/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ action, requestId }),
    });
    if (!data.success) setError(data.error || 'Action failed.');
    await load();
    setBusyId(null);
  };

  if (loading) return <Centered />;

  return (
    <div className="space-y-3">
      {error && <div className="bg-red-500/10 text-red-400 text-xs rounded-lg px-3 py-2">{error}</div>}
      {reqs.length === 0 && <EmptyState text="No withdrawal requests yet." />}
      {reqs.map((r) => (
        <div key={r.id} className="bg-white/5 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">{r.userName}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                r.status === 'pending'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : r.status === 'paid'
                  ? 'bg-[#25D366]/20 text-[#25D366]'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {r.status}
            </span>
          </div>
          <p className="text-white/50 text-xs mt-1">
            {r.amount.toLocaleString()} coins → {r.finalPayoutAmount.toFixed(2)} {r.currency} ({r.networkName})
          </p>
          <p className="text-white/35 text-[10px] mt-0.5 break-all">{r.walletAddress}</p>
          <p className="text-white/35 text-[10px] mt-0.5">{fmtDate(r.createdAt)}</p>
          {r.status === 'pending' && (
            <div className="flex gap-2 mt-3">
              <button
                disabled={busyId === r.id}
                onClick={() => handleAction(r.id, 'approve')}
                className="flex-1 py-1.5 rounded-lg bg-[#25D366] text-black text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" /> Approve & Pay
              </button>
              <button
                disabled={busyId === r.id}
                onClick={() => handleAction(r.id, 'reject')}
                className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Reject & Refund
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Live Streams Tab ───────────────────────────────────────────────────
function LiveStreamsTab() {
  const [streams, setStreams] = useState<AdminLiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await authedFetch('/api/admin/live-streams');
    if (data.success) setStreams(data.streams);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleEnd = async (streamId: string) => {
    setBusyId(streamId);
    await authedFetch('/api/admin/live-streams', {
      method: 'POST',
      body: JSON.stringify({ streamId }),
    });
    await load();
    setBusyId(null);
  };

  if (loading) return <Centered />;

  return (
    <div className="space-y-3">
      {streams.length === 0 && <EmptyState text="No one is live right now." />}
      {streams.map((s) => (
        <div key={s.id} className="bg-white/5 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">{s.hostName}</p>
            <button
              disabled={busyId === s.id}
              onClick={() => handleEnd(s.id)}
              className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold disabled:opacity-50"
            >
              Force End
            </button>
          </div>
          <p className="text-white/50 text-xs mt-1">{s.title}</p>
          <div className="flex gap-4 mt-2 text-xs text-white/40">
            <span>{s.viewerCount} viewers</span>
            <span>{s.totalGifts} gifts</span>
            <span>{s.totalCoins.toLocaleString()} coins</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Centered() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-white/30 text-sm text-center py-12">{text}</p>;
}
