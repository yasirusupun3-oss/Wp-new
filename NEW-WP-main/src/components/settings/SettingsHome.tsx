'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Bell,
  BellRing,
  Gift,
  Monitor,
  Wallet,
  Globe,
  Trash2,
  Info,
  ChevronRight,
  Camera,
  Palette,
  Moon,
  Sun,
  LogOut,
  User,
  Pencil,
  WalletMinimal,
  FileText,
  ArrowDownToLine,
} from 'lucide-react';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────
interface SettingItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onClick?: () => void;
  destructive?: boolean;
}

interface SettingsGroup {
  title: string;
  items: SettingItem[];
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Animation Variants ───────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
};

// ─── Main Component ───────────────────────────────────
export default function SettingsHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayUser = {
    displayName: user?.displayName || 'User',
    email: user?.email || '',
    initials: getInitials(user?.displayName || 'User'),
    color: '#075E54',
  };

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(displayUser.displayName);
  const [editPhotoURL, setEditPhotoURL] = useState(user?.photoURL || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');

  const DEFAULT_SETTINGS = {
    // Privacy
    showOnline: true,
    readReceipts: true,
    profilePhotoVisible: true,
    // Notifications
    pushNotifications: true,
    liveStreamAlerts: true,
    giftNotifications: true,
    // Streaming
    allowGifts: true,
    streamQuality: 'Auto' as 'Auto' | 'High' | 'Medium' | 'Low',
    minGiftValue: 10,
    // App
    darkMode: true,
  };

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savedWallet, setSavedWallet] = useState<{ address: string; network: string } | null>(null);

  // Load the user's real saved settings from Firestore (falls back to the
  // defaults above for a brand-new account that has never saved any yet),
  // and keep listening so a change made on another device stays in sync.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      if (data?.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
      setPhoneNumber(data?.phoneNumber || '');
      setSavedWallet(data?.withdrawal?.address ? data.withdrawal : null);
    });
    return () => unsub();
  }, [user?.uid]);

  // Persists to Firestore immediately — these are simple preference flags,
  // not something that needs debouncing or a separate "Save" step.
  const saveSettings = useCallback(async (next: typeof DEFAULT_SETTINGS) => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, 'users', user.uid), { settings: next }, { merge: true });
    } catch {
      // Non-fatal — the UI already reflects the change locally; it will
      // just fail to persist until the next successful save.
    }
  }, [user?.uid]);

  const toggleSetting = (key: keyof typeof DEFAULT_SETTINGS, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  };

  // ═══════════════════════════════════════════════════════
  //  Placeholder Click Handlers
  //  (Connect these to Firebase / real logic later)
  // ═══════════════════════════════════════════════════════

  const handleEditProfile = useCallback(() => {
    setEditName(displayUser.displayName);
    setEditPhotoURL(user?.photoURL || '');
    setProfileSaveError('');
    setShowEditProfile(true);
  }, [displayUser.displayName, user]);

  const handleSaveProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setProfileSaveError('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setProfileSaveError('');
    try {
      await updateProfile(auth.currentUser, {
        displayName: trimmedName,
        photoURL: editPhotoURL.trim() || null,
      });
      await setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { displayName: trimmedName, photoURL: editPhotoURL.trim() || null },
        { merge: true }
      );
      setShowEditProfile(false);
    } catch (err) {
      setProfileSaveError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }, [editName, editPhotoURL]);

  const handlePhoneClick = useCallback(() => {
    const input = prompt('Phone number:', phoneNumber || '');
    if (input === null || !user?.uid) return;
    const trimmed = input.trim();
    setPhoneNumber(trimmed);
    setDoc(doc(db, 'users', user.uid), { phoneNumber: trimmed }, { merge: true }).catch(() => {
      alert('Could not save your phone number. Please try again.');
    });
  }, [phoneNumber, user?.uid]);

  const handleEmailClick = useCallback(async () => {
    if (!auth.currentUser) return;
    const usesPassword = auth.currentUser.providerData.some((p) => p.providerId === 'password');
    if (!usesPassword) {
      alert(
        `Your account email is ${displayUser.email || 'not set'}.\n\nYou signed in with Google, so your email is managed by your Google account and can't be changed here.`
      );
      return;
    }
    const newEmail = prompt('New email address:', displayUser.email);
    if (!newEmail || newEmail.trim() === displayUser.email) return;
    const currentPassword = prompt('For security, enter your current password to confirm this change:');
    if (!currentPassword) return;
    try {
      const credential = EmailAuthProvider.credential(displayUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());
      alert(`A confirmation link was sent to ${newEmail.trim()}. Your email will update once you click it.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update email. Please check your password and try again.');
    }
  }, [displayUser.email]);

  const handle2FAClick = useCallback(() => {
    // Real two-factor auth needs Firebase's phone multi-factor enrollment
    // (reCAPTCHA + SMS verification + a second-factor challenge at every
    // login) — that's a genuine standalone feature, not a settings toggle,
    // and a fake "Enabled" switch here would be actively misleading for an
    // app that holds real balances. Being upfront about that instead of
    // faking it.
    alert(
      'Two-factor authentication isn\'t built yet.\n\nReal 2FA needs phone number verification (SMS code) wired into the login flow — it\'s a dedicated feature to build properly, not something a toggle here can safely turn on.'
    );
  }, []);

  const STREAM_QUALITY_OPTIONS = ['Auto', 'High', 'Medium', 'Low'] as const;
  const handleStreamQualityClick = useCallback(() => {
    setSettings((prev) => {
      const currentIndex = STREAM_QUALITY_OPTIONS.indexOf(prev.streamQuality);
      const nextQuality = STREAM_QUALITY_OPTIONS[(currentIndex + 1) % STREAM_QUALITY_OPTIONS.length];
      const next = { ...prev, streamQuality: nextQuality };
      saveSettings(next);
      return next;
    });
  }, [saveSettings]);

  const handleMinGiftValueClick = useCallback(() => {
    const input = prompt('Minimum gift value (in coins):', String(settings.minGiftValue));
    if (input === null) return;
    const parsed = parseInt(input, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert('Please enter a valid non-negative number of coins.');
      return;
    }
    setSettings((prev) => {
      const next = { ...prev, minGiftValue: parsed };
      saveSettings(next);
      return next;
    });
  }, [settings.minGiftValue, saveSettings]);

  const WITHDRAWAL_NETWORKS = [
    { id: 'trc20', label: 'TRC20 (Tron)' },
    { id: 'erc20', label: 'ERC20 (Ethereum)' },
    { id: 'bep20', label: 'BEP20 (BNB Chain)' },
  ];

  const saveWallet = useCallback((next: { address: string; network: string } | null) => {
    if (!user?.uid) return;
    setSavedWallet(next);
    setDoc(doc(db, 'users', user.uid), { withdrawal: next }, { merge: true }).catch(() => {
      alert('Could not save your wallet details. Please try again.');
    });
  }, [user?.uid]);

  const handleConnectedWalletsClick = useCallback(() => {
    const input = prompt(
      'Your withdrawal wallet address (this is what your coins get sent to):',
      savedWallet?.address || ''
    );
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
      saveWallet(null);
      return;
    }
    saveWallet({ address: trimmed, network: savedWallet?.network || 'trc20' });
  }, [savedWallet, saveWallet]);

  const handleTransactionHistoryClick = useCallback(() => {
    router.push('/');
    // The Wallet tab already shows real recent transactions — a dedicated
    // full-history page can be added as a follow-up if needed.
  }, [router]);

  const handleWithdrawalSettingsClick = useCallback(() => {
    const optionsList = WITHDRAWAL_NETWORKS.map((n, i) => `${i + 1}. ${n.label}`).join('\n');
    const input = prompt(`Preferred withdrawal network:\n${optionsList}\n\nEnter a number:`);
    if (input === null) return;
    const idx = parseInt(input, 10) - 1;
    const chosen = WITHDRAWAL_NETWORKS[idx];
    if (!chosen) {
      alert('Please enter a valid option number.');
      return;
    }
    saveWallet({ address: savedWallet?.address || '', network: chosen.id });
  }, [savedWallet, saveWallet]);

  const handleLanguageClick = useCallback(() => {
    // The app's UI text is written in English throughout every screen —
    // a language switch here would need a real translation system behind
    // it (a string catalog + a provider wrapping the whole app), not just
    // this dropdown relabeled. Flagging that honestly rather than shipping
    // a selector that doesn't actually translate anything.
    alert(
      'Language switching isn\'t built yet.\n\nThe app\'s screens are written in English text directly — supporting Sinhala would need a proper translation system added across the app, not just this setting.'
    );
  }, []);

  const handleClearCacheClick = useCallback(async () => {
    const confirmed = confirm(
      'Clear Cache?\n\nThis will clear locally stored data and log you out.\n\nThis action cannot be undone.'
    );
    if (confirmed) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // Storage access can fail in some restricted browser contexts — ignore.
      }
      await logout();
      router.push('/login');
    }
  }, [logout, router]);

  const handleAboutClick = useCallback(() => {
    alert('About Wp-earn-money\n\nA WhatsApp-inspired mobile-first PWA with live streaming, virtual gifts, and a coin economy.\n\nPowered by Next.js, Firebase, Agora, and OxaPay.');
  }, []);

  const handleLogoutClick = useCallback(async () => {
    const confirmed = confirm(
      'Log Out?\n\nYou will need to sign in again to access your chats, wallet, and live streams.'
    );
    if (confirmed) {
      await logout();
      router.push('/login');
    }
  }, [logout, router]);

  // ─── Settings Groups ────────────────────────────────
  const groups: SettingsGroup[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'phone',
          label: 'Phone Number',
          icon: <Phone className="w-[18px] h-[18px]" style={{ color: '#128C7E' }} />,
          value: phoneNumber || 'Not set',
          onClick: handlePhoneClick,
        },
        {
          id: 'email',
          label: 'Email',
          icon: <Mail className="w-[18px] h-[18px]" style={{ color: '#25D366' }} />,
          value: displayUser.email,
          onClick: handleEmailClick,
        },
        {
          id: '2fa',
          label: 'Two-Factor Auth',
          icon: <ShieldCheck className="w-[18px] h-[18px]" style={{ color: '#FFD700' }} />,
          value: 'Disabled',
          onClick: handle2FAClick,
        },
      ],
    },
    {
      title: 'Privacy',
      items: [
        {
          id: 'showOnline',
          label: 'Who Can See Me Online',
          icon: <Eye className="w-[18px] h-[18px]" style={{ color: '#25D366' }} />,
          value: 'Everyone',
          toggle: true,
          toggleValue: settings.showOnline,
          onToggle: (v) => toggleSetting('showOnline', v),
        },
        {
          id: 'readReceipts',
          label: 'Read Receipts',
          icon: <EyeOff className="w-[18px] h-[18px]" style={{ color: '#8696A0' }} />,
          toggle: true,
          toggleValue: settings.readReceipts,
          onToggle: (v) => toggleSetting('readReceipts', v),
        },
        {
          id: 'profilePhotoVisible',
          label: 'Profile Photo Visibility',
          icon: <Camera className="w-[18px] h-[18px]" style={{ color: '#805DE2' }} />,
          value: 'Everyone',
          toggle: true,
          toggleValue: settings.profilePhotoVisible,
          onToggle: (v) => toggleSetting('profilePhotoVisible', v),
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          id: 'pushNotifications',
          label: 'Push Notifications',
          icon: <Bell className="w-[18px] h-[18px]" style={{ color: '#25D366' }} />,
          toggle: true,
          toggleValue: settings.pushNotifications,
          onToggle: (v) => toggleSetting('pushNotifications', v),
        },
        {
          id: 'liveStreamAlerts',
          label: 'Live Stream Alerts',
          icon: <BellRing className="w-[18px] h-[18px]" style={{ color: '#FFD700' }} />,
          toggle: true,
          toggleValue: settings.liveStreamAlerts,
          onToggle: (v) => toggleSetting('liveStreamAlerts', v),
        },
        {
          id: 'giftNotifications',
          label: 'Gift Notifications',
          icon: <Gift className="w-[18px] h-[18px]" style={{ color: '#FF6B6B' }} />,
          toggle: true,
          toggleValue: settings.giftNotifications,
          onToggle: (v) => toggleSetting('giftNotifications', v),
        },
      ],
    },
    {
      title: 'Streaming',
      items: [
        {
          id: 'defaultQuality',
          label: 'Default Stream Quality',
          icon: <Monitor className="w-[18px] h-[18px]" style={{ color: '#128C7E' }} />,
          value: settings.streamQuality,
          onClick: handleStreamQualityClick,
        },
        {
          id: 'allowGifts',
          label: 'Allow Gifts on Stream',
          icon: <Gift className="w-[18px] h-[18px]" style={{ color: '#FFD700' }} />,
          toggle: true,
          toggleValue: settings.allowGifts,
          onToggle: (v) => toggleSetting('allowGifts', v),
        },
        {
          id: 'minGiftValue',
          label: 'Minimum Gift Value',
          icon: <Gift className="w-[18px] h-[18px]" style={{ color: '#8696A0' }} />,
          value: `${settings.minGiftValue} coins`,
          onClick: handleMinGiftValueClick,
        },
      ],
    },
    {
      title: 'Wallet',
      items: [
        {
          id: 'connectedWallets',
          label: 'Connected Wallets',
          icon: <Wallet className="w-[18px] h-[18px]" style={{ color: '#805DE2' }} />,
          value: savedWallet?.address ? '1 wallet' : 'Not set',
          onClick: handleConnectedWalletsClick,
        },
        {
          id: 'transactionHistory',
          label: 'Transaction History',
          icon: <Wallet className="w-[18px] h-[18px]" style={{ color: '#25D366' }} />,
          onClick: handleTransactionHistoryClick,
        },
        {
          id: 'withdrawalSettings',
          label: 'Withdrawal Settings',
          icon: <Wallet className="w-[18px] h-[18px]" style={{ color: '#FFD700' }} />,
          value: WITHDRAWAL_NETWORKS.find((n) => n.id === savedWallet?.network)?.label || 'Not set',
          onClick: handleWithdrawalSettingsClick,
        },
      ],
    },
    {
      title: 'App',
      items: [
        {
          id: 'theme',
          label: 'Theme',
          icon: settings.darkMode
            ? <Moon className="w-[18px] h-[18px]" style={{ color: '#128C7E' }} />
            : <Sun className="w-[18px] h-[18px]" style={{ color: '#FFD700' }} />,
          value: settings.darkMode ? 'Dark' : 'Light',
          toggle: true,
          toggleValue: settings.darkMode,
          onToggle: (v) => toggleSetting('darkMode', v),
        },
        {
          id: 'language',
          label: 'Language',
          icon: <Globe className="w-[18px] h-[18px]" style={{ color: '#25D366' }} />,
          value: 'English',
          onClick: handleLanguageClick,
        },
        {
          id: 'clearCache',
          label: 'Clear Cache',
          icon: <Trash2 className="w-[18px] h-[18px]" style={{ color: '#EA4335' }} />,
          destructive: true,
          onClick: handleClearCacheClick,
        },
        {
          id: 'about',
          label: 'About',
          icon: <Info className="w-[18px] h-[18px]" style={{ color: '#8696A0' }} />,
          onClick: handleAboutClick,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen pb-24 px-4 pt-4" style={{ background: '#111B21' }}>
      <motion.div variants={containerVariants} initial="hidden" animate="show">
        {/* ── Profile Section ── */}
        <motion.div variants={itemVariants}>
          <GlassmorphismCard className="flex items-center gap-4 mb-6">
            {/* Avatar */}
            <button
              onClick={handleEditProfile}
              className="group relative shrink-0"
              aria-label="Edit profile picture"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#25D366]/50"
                style={{
                  background: `linear-gradient(135deg, ${displayUser.color}, #128C7E)`,
                  color: '#fff',
                  boxShadow: `0 4px 16px ${displayUser.color}40`,
                }}
              >
                {displayUser.initials}
              </div>
              {/* Camera overlay on hover */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: 'rgba(0,0,0,0.45)' }}
              >
                <Pencil className="w-4 h-4 text-white" />
              </div>
            </button>

            <button className="flex-1 min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left" onClick={handleEditProfile}>
              <h2 className="text-base font-semibold truncate" style={{ color: '#E9EDEF' }}>
                {displayUser.displayName}
              </h2>
              <p className="text-sm truncate" style={{ color: '#8696A0' }}>
                {displayUser.email}
              </p>
            </button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleEditProfile}
              className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 active:scale-95"
              style={{
                background: 'rgba(7,94,84,0.3)',
                border: '1px solid rgba(18,140,126,0.4)',
                color: '#25D366',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(7,94,84,0.55)';
                e.currentTarget.style.borderColor = 'rgba(37,211,102,0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(7,94,84,0.3)';
                e.currentTarget.style.borderColor = 'rgba(18,140,126,0.4)';
              }}
              aria-label="Edit Profile"
            >
              Edit Profile
            </motion.button>
          </GlassmorphismCard>
        </motion.div>

        {/* ── Settings Groups ── */}
        {groups.map((group, groupIndex) => (
          <motion.div key={group.title} variants={itemVariants} className="mb-5">
            <h3
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: '#8696A0' }}
            >
              {group.title}
            </h3>
            <GlassmorphismCard noPadding hover={false}>
              {group.items.map((item, itemIndex) => {
                const isClickable = !!item.onClick || (item.toggle && !!item.onToggle);

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!isClickable}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-150"
                    style={{
                      borderBottom:
                        itemIndex < group.items.length - 1
                          ? '1px solid rgba(255,255,255,0.06)'
                          : 'none',
                      cursor: isClickable ? 'pointer' : 'default',
                      background: 'transparent',
                      borderLeft: 'none',
                      borderTop: 'none',
                      borderRight: 'none',
                    }}
                    onClick={() => {
                      if (item.toggle && item.onToggle) {
                        item.onToggle(!item.toggleValue);
                      } else if (item.onClick) {
                        item.onClick();
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (isClickable) {
                        e.currentTarget.style.background =
                          'rgba(255,255,255,0.04)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    aria-label={item.label}
                  >
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.05)' }}
                    >
                      {item.icon}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm"
                        style={{
                          color: item.destructive ? '#EA4335' : '#E9EDEF',
                        }}
                      >
                        {item.label}
                      </p>
                    </div>

                    {/* Right side: Toggle, Value+Chevron, or just Chevron */}
                    {item.toggle ? (
                      <div
                        className="w-10 h-[22px] rounded-full p-0.5 transition-all duration-200 shrink-0"
                        style={{
                          background: item.toggleValue
                            ? 'linear-gradient(135deg, #25D366, #128C7E)'
                            : 'rgba(255,255,255,0.15)',
                          justifyContent: item.toggleValue
                            ? 'flex-end'
                            : 'flex-start',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          className="w-[18px] h-[18px] rounded-full transition-all duration-200 shadow-sm"
                          style={{
                            background: item.toggleValue ? '#fff' : '#8696A0',
                          }}
                        />
                      </div>
                    ) : item.value ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className="text-xs"
                          style={{ color: '#8696A0' }}
                        >
                          {item.value}
                        </span>
                        <ChevronRight
                          className="w-4 h-4"
                          style={{ color: '#667781' }}
                        />
                      </div>
                    ) : (
                      <ChevronRight
                        className="w-4 h-4 shrink-0"
                        style={{ color: '#667781' }}
                      />
                    )}
                  </button>
                );
              })}
            </GlassmorphismCard>
          </motion.div>
        ))}

        {/* ── Admin Panel (visible only to the admin account) ── */}
        {user?.email === 'supunsasmithafamily@gmail.com' && (
          <motion.div variants={itemVariants} className="mb-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/admin')}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: 'rgba(37,211,102,0.1)',
                border: '1px solid rgba(37,211,102,0.25)',
                color: '#25D366',
              }}
            >
              <ShieldCheck className="w-[18px] h-[18px]" />
              Admin Panel
            </motion.button>
          </motion.div>
        )}

        {/* ── Log Out ── */}
        <motion.div variants={itemVariants} className="mb-5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleLogoutClick}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
            style={{
              background: 'rgba(234,67,53,0.08)',
              border: '1px solid rgba(234,67,53,0.2)',
              color: '#EA4335',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(234,67,53,0.16)';
              e.currentTarget.style.borderColor = 'rgba(234,67,53,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(234,67,53,0.08)';
              e.currentTarget.style.borderColor = 'rgba(234,67,53,0.2)';
            }}
          >
            <LogOut className="w-[18px] h-[18px]" />
            Log Out
          </motion.button>
        </motion.div>

        {/* ── Version ── */}
        <motion.div variants={itemVariants} className="text-center pb-4">
          <p className="text-[11px]" style={{ color: '#667781' }}>
            App Version 1.0.0
          </p>
        </motion.div>
      </motion.div>

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => !savingProfile && setShowEditProfile(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-5"
            style={{ background: '#1F2C34' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-4" style={{ color: '#E9EDEF' }}>
              Edit Profile
            </h3>

            {profileSaveError && (
              <div
                className="mb-3 px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(220, 38, 38, 0.12)', color: '#FCA5A5' }}
              >
                {profileSaveError}
              </div>
            )}

            <label className="block text-xs mb-1.5" style={{ color: '#8696A0' }}>
              Display Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full mb-4 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#2A3942', color: '#E9EDEF' }}
              maxLength={50}
            />

            <label className="block text-xs mb-1.5" style={{ color: '#8696A0' }}>
              Photo URL (optional)
            </label>
            <input
              type="text"
              value={editPhotoURL}
              onChange={(e) => setEditPhotoURL(e.target.value)}
              placeholder="https://..."
              className="w-full mb-5 px-3.5 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#2A3942', color: '#E9EDEF' }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowEditProfile(false)}
                disabled={savingProfile}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#2A3942', color: '#E9EDEF' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
                style={{ background: '#25D366', color: '#0B141A' }}
              >
                {savingProfile ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
