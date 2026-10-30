'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Mail, ShieldCheck, Eye, EyeOff, Bell, BellRing, Gift,
  Monitor, Wallet, Globe, Trash2, Info, ChevronRight, Camera,
  Moon, Sun, LogOut, Pencil, ShieldCheck as ShieldCheckIcon,
  Loader2, User, MapPin, Calendar, FileText,
} from 'lucide-react';
import { GlassmorphismCard } from '@/components/three/GlassmorphismCard';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase';

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
};

interface SettingItem {
  id: string; label: string; icon: React.ReactNode;
  value?: string; toggle?: boolean; toggleValue?: boolean;
  onToggle?: (v: boolean) => void; onClick?: () => void; destructive?: boolean;
}
interface SettingsGroup { title: string; items: SettingItem[]; }

const DEFAULT_SETTINGS = {
  showOnline: true, readReceipts: true, profilePhotoVisible: true,
  pushNotifications: true, liveStreamAlerts: true, giftNotifications: true,
  allowGifts: true, streamQuality: 'Auto' as 'Auto'|'High'|'Medium'|'Low',
  minGiftValue: 10, darkMode: true,
};

export default function SettingsHome() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUser = {
    displayName: user?.displayName || 'User',
    email: user?.email || '',
    initials: getInitials(user?.displayName || 'User'),
    photoURL: user?.photoURL || null,
  };

  // ─── Profile Modal State ───────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName]     = useState('');
  const [editAge, setEditAge]       = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [editCity, setEditCity]     = useState('');
  const [editGender, setEditGender] = useState<'male'|'female'|'other'|''>('');
  const [editBio, setEditBio]       = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');

  // ─── Firestore live profile data ──────────────────────────────────────
  const [profileData, setProfileData] = useState<any>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savedWallet, setSavedWallet] = useState<{address:string;network:string}|null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      if (data) {
        setProfileData(data);
        if (data.settings) setSettings((p) => ({ ...p, ...data.settings }));
        setPhoneNumber(data.phoneNumber || '');
        setSavedWallet(data.withdrawal?.address ? data.withdrawal : null);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const saveSettings = useCallback(async (next: typeof DEFAULT_SETTINGS) => {
    if (!user?.uid) return;
    await setDoc(doc(db, 'users', user.uid), { settings: next }, { merge: true }).catch(() => {});
  }, [user?.uid]);

  const toggleSetting = (key: keyof typeof DEFAULT_SETTINGS, value: boolean) => {
    setSettings((prev) => { const next = { ...prev, [key]: value }; saveSettings(next); return next; });
  };

  // ─── Open Edit Profile Modal ───────────────────────────────────────────
  const handleEditProfile = useCallback(() => {
    setEditName(profileData?.displayName || displayUser.displayName);
    setEditAge(profileData?.age ? String(profileData.age) : '');
    setEditBirthday(profileData?.birthday || '');
    setEditCity(profileData?.city || '');
    setEditGender(profileData?.gender || '');
    setEditBio(profileData?.bio || '');
    setEditPhotoURL(profileData?.photoURL || displayUser.photoURL || '');
    setProfileSaveError('');
    setShowEditProfile(true);
  }, [profileData, displayUser]);

  // ─── Photo Upload ──────────────────────────────────────────────────────
  const handlePhotoFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (!file.type.startsWith('image/')) { setProfileSaveError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setProfileSaveError('Image must be under 5MB.'); return; }

    setIsUploading(true);
    setUploadProgress(0);
    setProfileSaveError('');
    try {
      const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file, { contentType: file.type });
      task.on('state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => { setProfileSaveError('Upload failed: ' + err.message); setIsUploading(false); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setEditPhotoURL(url);
          setIsUploading(false);
          setUploadProgress(0);
        }
      );
    } catch (err: any) {
      setProfileSaveError('Upload failed.');
      setIsUploading(false);
    }
  }, [user?.uid]);

  // ─── Save Profile ──────────────────────────────────────────────────────
  const handleSaveProfile = useCallback(async () => {
    if (!auth.currentUser || !user?.uid) return;
    const trimmedName = editName.trim();
    if (!trimmedName) { setProfileSaveError('Name cannot be empty.'); return; }
    setSavingProfile(true);
    setProfileSaveError('');
    try {
      await updateProfile(auth.currentUser, {
        displayName: trimmedName,
        photoURL: editPhotoURL.trim() || null,
      });
      await setDoc(doc(db, 'users', user.uid), {
        displayName: trimmedName,
        photoURL: editPhotoURL.trim() || null,
        age: editAge ? parseInt(editAge) : null,
        birthday: editBirthday || null,
        city: editCity.trim() || null,
        gender: editGender || null,
        bio: editBio.trim() || null,
      }, { merge: true });
      setShowEditProfile(false);
    } catch (err: any) {
      setProfileSaveError(err.message || 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }, [editName, editPhotoURL, editAge, editBirthday, editCity, editGender, editBio, user?.uid]);

  // ─── Other handlers ────────────────────────────────────────────────────
  const handlePhoneClick = useCallback(() => {
    const input = prompt('Phone number:', phoneNumber || '');
    if (input === null || !user?.uid) return;
    const trimmed = input.trim();
    setPhoneNumber(trimmed);
    setDoc(doc(db, 'users', user.uid), { phoneNumber: trimmed }, { merge: true }).catch(() => {});
  }, [phoneNumber, user?.uid]);

  const handleEmailClick = useCallback(async () => {
    if (!auth.currentUser) return;
    const usesPassword = auth.currentUser.providerData.some((p) => p.providerId === 'password');
    if (!usesPassword) { alert(`Your email is managed by Google and can't be changed here.`); return; }
    const newEmail = prompt('New email address:', displayUser.email);
    if (!newEmail || newEmail.trim() === displayUser.email) return;
    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;
    try {
      const credential = EmailAuthProvider.credential(displayUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());
      alert(`Confirmation sent to ${newEmail.trim()}.`);
    } catch (err: any) {
      alert(err.message || 'Could not update email.');
    }
  }, [displayUser.email]);

  const STREAM_QUALITY_OPTIONS = ['Auto', 'High', 'Medium', 'Low'] as const;
  const handleStreamQualityClick = useCallback(() => {
    setSettings((prev) => {
      const idx = STREAM_QUALITY_OPTIONS.indexOf(prev.streamQuality);
      const next = { ...prev, streamQuality: STREAM_QUALITY_OPTIONS[(idx + 1) % STREAM_QUALITY_OPTIONS.length] };
      saveSettings(next); return next;
    });
  }, [saveSettings]);

  const handleMinGiftValueClick = useCallback(() => {
    const input = prompt('Minimum gift value (coins):', String(settings.minGiftValue));
    if (input === null) return;
    const parsed = parseInt(input, 10);
    if (!Number.isFinite(parsed) || parsed < 0) { alert('Enter a valid number.'); return; }
    setSettings((prev) => { const next = { ...prev, minGiftValue: parsed }; saveSettings(next); return next; });
  }, [settings.minGiftValue, saveSettings]);

  const WITHDRAWAL_NETWORKS = [
    { id: 'trc20', label: 'TRC20 (Tron)' },
    { id: 'erc20', label: 'ERC20 (Ethereum)' },
    { id: 'bep20', label: 'BEP20 (BNB Chain)' },
  ];
  const saveWallet = useCallback((next: {address:string;network:string}|null) => {
    if (!user?.uid) return;
    setSavedWallet(next);
    setDoc(doc(db, 'users', user.uid), { withdrawal: next }, { merge: true }).catch(() => {});
  }, [user?.uid]);

  const handleConnectedWalletsClick = useCallback(() => {
    const input = prompt('Withdrawal wallet address:', savedWallet?.address || '');
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) { saveWallet(null); return; }
    saveWallet({ address: trimmed, network: savedWallet?.network || 'trc20' });
  }, [savedWallet, saveWallet]);

  const handleWithdrawalSettingsClick = useCallback(() => {
    const list = WITHDRAWAL_NETWORKS.map((n, i) => `${i+1}. ${n.label}`).join('\n');
    const input = prompt(`Preferred network:\n${list}\n\nEnter number:`);
    if (input === null) return;
    const chosen = WITHDRAWAL_NETWORKS[parseInt(input,10)-1];
    if (!chosen) { alert('Invalid option.'); return; }
    saveWallet({ address: savedWallet?.address || '', network: chosen.id });
  }, [savedWallet, saveWallet]);

  const handleLogoutClick = useCallback(async () => {
    if (confirm('Log out?')) { await logout(); router.push('/login'); }
  }, [logout, router]);

  const handleClearCacheClick = useCallback(async () => {
    if (!confirm('Clear cache and log out?')) return;
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
    await logout(); router.push('/login');
  }, [logout, router]);

  // ─── Settings Groups ───────────────────────────────────────────────────
  const groups: SettingsGroup[] = [
    {
      title: 'Account',
      items: [
        { id: 'phone', label: 'Phone Number', icon: <Phone className="w-[18px] h-[18px]" style={{color:'#128C7E'}}/>, value: phoneNumber||'Not set', onClick: handlePhoneClick },
        { id: 'email', label: 'Email', icon: <Mail className="w-[18px] h-[18px]" style={{color:'#25D366'}}/>, value: displayUser.email, onClick: handleEmailClick },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { id: 'showOnline', label: 'Show Online Status', icon: <Eye className="w-[18px] h-[18px]" style={{color:'#25D366'}}/>, toggle: true, toggleValue: settings.showOnline, onToggle: (v)=>toggleSetting('showOnline',v) },
        { id: 'readReceipts', label: 'Read Receipts', icon: <EyeOff className="w-[18px] h-[18px]" style={{color:'#8696A0'}}/>, toggle: true, toggleValue: settings.readReceipts, onToggle: (v)=>toggleSetting('readReceipts',v) },
        { id: 'profilePhotoVisible', label: 'Profile Photo Visibility', icon: <Camera className="w-[18px] h-[18px]" style={{color:'#805DE2'}}/>, toggle: true, toggleValue: settings.profilePhotoVisible, onToggle: (v)=>toggleSetting('profilePhotoVisible',v) },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { id: 'pushNotifications', label: 'Push Notifications', icon: <Bell className="w-[18px] h-[18px]" style={{color:'#25D366'}}/>, toggle: true, toggleValue: settings.pushNotifications, onToggle: (v)=>toggleSetting('pushNotifications',v) },
        { id: 'liveStreamAlerts', label: 'Live Stream Alerts', icon: <BellRing className="w-[18px] h-[18px]" style={{color:'#FFD700'}}/>, toggle: true, toggleValue: settings.liveStreamAlerts, onToggle: (v)=>toggleSetting('liveStreamAlerts',v) },
        { id: 'giftNotifications', label: 'Gift Notifications', icon: <Gift className="w-[18px] h-[18px]" style={{color:'#FF6B6B'}}/>, toggle: true, toggleValue: settings.giftNotifications, onToggle: (v)=>toggleSetting('giftNotifications',v) },
      ],
    },
    {
      title: 'Streaming',
      items: [
        { id: 'defaultQuality', label: 'Default Stream Quality', icon: <Monitor className="w-[18px] h-[18px]" style={{color:'#128C7E'}}/>, value: settings.streamQuality, onClick: handleStreamQualityClick },
        { id: 'allowGifts', label: 'Allow Gifts on Stream', icon: <Gift className="w-[18px] h-[18px]" style={{color:'#FFD700'}}/>, toggle: true, toggleValue: settings.allowGifts, onToggle: (v)=>toggleSetting('allowGifts',v) },
        { id: 'minGiftValue', label: 'Minimum Gift Value', icon: <Gift className="w-[18px] h-[18px]" style={{color:'#8696A0'}}/>, value: `${settings.minGiftValue} coins`, onClick: handleMinGiftValueClick },
      ],
    },
    {
      title: 'Wallet',
      items: [
        { id: 'connectedWallets', label: 'Connected Wallets', icon: <Wallet className="w-[18px] h-[18px]" style={{color:'#805DE2'}}/>, value: savedWallet?.address ? '1 wallet' : 'Not set', onClick: handleConnectedWalletsClick },
        { id: 'withdrawalSettings', label: 'Withdrawal Network', icon: <Wallet className="w-[18px] h-[18px]" style={{color:'#FFD700'}}/>, value: WITHDRAWAL_NETWORKS.find(n=>n.id===savedWallet?.network)?.label||'Not set', onClick: handleWithdrawalSettingsClick },
      ],
    },
    {
      title: 'App',
      items: [
        { id: 'theme', label: 'Theme', icon: settings.darkMode ? <Moon className="w-[18px] h-[18px]" style={{color:'#128C7E'}}/> : <Sun className="w-[18px] h-[18px]" style={{color:'#FFD700'}}/>, value: settings.darkMode?'Dark':'Light', toggle: true, toggleValue: settings.darkMode, onToggle: (v)=>toggleSetting('darkMode',v) },
        { id: 'language', label: 'Language', icon: <Globe className="w-[18px] h-[18px]" style={{color:'#25D366'}}/>, value: 'English' },
        { id: 'clearCache', label: 'Clear Cache', icon: <Trash2 className="w-[18px] h-[18px]" style={{color:'#EA4335'}}/>, destructive: true, onClick: handleClearCacheClick },
        { id: 'about', label: 'About', icon: <Info className="w-[18px] h-[18px]" style={{color:'#8696A0'}}/>, onClick: ()=>alert('Wp-earn-money v1.0.0') },
      ],
    },
  ];

  return (
    <div className="min-h-screen pb-24 px-4 pt-4" style={{background:'#111B21'}}>
      <motion.div variants={containerVariants} initial="hidden" animate="show">

        {/* ── Profile Card ── */}
        <motion.div variants={itemVariants}>
          <GlassmorphismCard className="mb-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <button onClick={handleEditProfile} className="group relative shrink-0" aria-label="Edit photo">
                <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold"
                  style={{background:'linear-gradient(135deg,#075E54,#128C7E)',color:'#fff',boxShadow:'0 4px 16px rgba(7,94,84,0.4)'}}>
                  {editPhotoURL || displayUser.photoURL || profileData?.photoURL ? (
                    <img src={editPhotoURL || displayUser.photoURL || profileData?.photoURL} alt="avatar"
                      className="w-full h-full object-cover" />
                  ) : (
                    <span>{displayUser.initials}</span>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{background:'rgba(0,0,0,0.45)'}}>
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </button>

              <button className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer" onClick={handleEditProfile}>
                <h2 className="text-base font-semibold truncate" style={{color:'#E9EDEF'}}>{displayUser.displayName}</h2>
                <p className="text-xs truncate" style={{color:'#8696A0'}}>{displayUser.email}</p>
                {profileData?.bio && (
                  <p className="text-xs mt-1 truncate" style={{color:'#667781'}}>{profileData.bio}</p>
                )}
                {(profileData?.city || profileData?.age) && (
                  <p className="text-xs mt-0.5" style={{color:'#667781'}}>
                    {[profileData.city, profileData.age ? `Age ${profileData.age}` : null].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>

              <motion.button whileTap={{scale:0.92}} onClick={handleEditProfile}
                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{background:'rgba(7,94,84,0.3)',border:'1px solid rgba(18,140,126,0.4)',color:'#25D366'}}>
                Edit
              </motion.button>
            </div>
          </GlassmorphismCard>
        </motion.div>

        {/* ── Settings Groups ── */}
        {groups.map((group) => (
          <motion.div key={group.title} variants={itemVariants} className="mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{color:'#8696A0'}}>{group.title}</h3>
            <GlassmorphismCard noPadding hover={false}>
              {group.items.map((item, idx) => {
                const isClickable = !!item.onClick || (item.toggle && !!item.onToggle);
                return (
                  <button key={item.id} type="button" disabled={!isClickable}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                    style={{borderBottom: idx < group.items.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      cursor: isClickable?'pointer':'default', background:'transparent',
                      border: idx < group.items.length-1 ? 'none' : 'none',
                      borderBottomWidth: idx < group.items.length-1 ? '1px' : '0',
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                      borderBottomStyle: 'solid'}}
                    onClick={() => { if (item.toggle && item.onToggle) item.onToggle(!item.toggleValue); else item.onClick?.(); }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(255,255,255,0.05)'}}>{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{color: item.destructive?'#EA4335':'#E9EDEF'}}>{item.label}</p>
                    </div>
                    {item.toggle ? (
                      <div className="w-10 h-[22px] rounded-full p-0.5 transition-all shrink-0 flex items-center"
                        style={{background: item.toggleValue?'linear-gradient(135deg,#25D366,#128C7E)':'rgba(255,255,255,0.15)',
                          justifyContent: item.toggleValue?'flex-end':'flex-start'}}>
                        <div className="w-[18px] h-[18px] rounded-full shadow-sm" style={{background: item.toggleValue?'#fff':'#8696A0'}} />
                      </div>
                    ) : item.value ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs" style={{color:'#8696A0'}}>{item.value}</span>
                        <ChevronRight className="w-4 h-4" style={{color:'#667781'}} />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" style={{color:'#667781'}} />
                    )}
                  </button>
                );
              })}
            </GlassmorphismCard>
          </motion.div>
        ))}

        {/* ── Admin Panel ── */}
        {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
          <motion.div variants={itemVariants} className="mb-3">
            <motion.button whileTap={{scale:0.97}} onClick={()=>router.push('/admin')}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{background:'rgba(37,211,102,0.1)',border:'1px solid rgba(37,211,102,0.25)',color:'#25D366'}}>
              <ShieldCheckIcon className="w-[18px] h-[18px]" /> Admin Panel
            </motion.button>
          </motion.div>
        )}

        {/* ── Log Out ── */}
        <motion.div variants={itemVariants} className="mb-5">
          <motion.button whileTap={{scale:0.97}} onClick={handleLogoutClick}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{background:'rgba(234,67,53,0.08)',border:'1px solid rgba(234,67,53,0.2)',color:'#EA4335'}}>
            <LogOut className="w-[18px] h-[18px]" /> Log Out
          </motion.button>
        </motion.div>

        <motion.div variants={itemVariants} className="text-center pb-4">
          <p className="text-[11px]" style={{color:'#667781'}}>App Version 1.0.0</p>
        </motion.div>
      </motion.div>

      {/* ══════════ Edit Profile Modal ══════════ */}
      <AnimatePresence>
        {showEditProfile && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{background:'rgba(0,0,0,0.7)'}}
            onClick={()=>!savingProfile && !isUploading && setShowEditProfile(false)}>
            <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
              className="w-full max-w-lg rounded-t-2xl p-5 overflow-y-auto"
              style={{background:'#1F2C34', maxHeight:'90vh'}}
              onClick={(e)=>e.stopPropagation()}>

              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{background:'rgba(255,255,255,0.2)'}} />
              <h3 className="text-base font-semibold mb-5" style={{color:'#E9EDEF'}}>Edit Profile</h3>

              {profileSaveError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm" style={{background:'rgba(220,38,38,0.12)',color:'#FCA5A5'}}>
                  {profileSaveError}
                </div>
              )}

              {/* ── Photo Upload ── */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold"
                    style={{background:'linear-gradient(135deg,#075E54,#128C7E)',color:'#fff'}}>
                    {editPhotoURL ? (
                      <img src={editPhotoURL} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{displayUser.initials}</span>
                    )}
                  </div>
                  {isUploading && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center"
                      style={{background:'rgba(0,0,0,0.6)'}}>
                      <span className="text-white text-xs font-bold">{uploadProgress}%</span>
                    </div>
                  )}
                  <button onClick={()=>fileInputRef.current?.click()} disabled={isUploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{background:'#25D366',boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
                {isUploading && (
                  <div className="mt-2 w-40 h-1.5 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,0.1)'}}>
                    <div className="h-full rounded-full transition-all" style={{width:`${uploadProgress}%`,background:'#25D366'}} />
                  </div>
                )}
                <p className="text-xs mt-2" style={{color:'#8696A0'}}>Tap camera to change photo</p>
              </div>

              {/* ── Fields ── */}
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="block text-xs mb-1" style={{color:'#8696A0'}}>Display Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#8696A0'}} />
                    <input type="text" value={editName} onChange={(e)=>setEditName(e.target.value)} maxLength={50}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{background:'#2A3942',color:'#E9EDEF'}} placeholder="Your name" />
                  </div>
                </div>

                {/* Age + Gender row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{color:'#8696A0'}}>Age</label>
                    <input type="number" value={editAge} onChange={(e)=>setEditAge(e.target.value)} min={13} max={120}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{background:'#2A3942',color:'#E9EDEF'}} placeholder="25" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs mb-1" style={{color:'#8696A0'}}>Gender</label>
                    <select value={editGender} onChange={(e)=>setEditGender(e.target.value as any)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{background:'#2A3942',color: editGender?'#E9EDEF':'#8696A0'}}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Birthday */}
                <div>
                  <label className="block text-xs mb-1" style={{color:'#8696A0'}}>Birthday</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#8696A0'}} />
                    <input type="date" value={editBirthday} onChange={(e)=>setEditBirthday(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{background:'#2A3942',color:'#E9EDEF',colorScheme:'dark'}} />
                  </div>
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs mb-1" style={{color:'#8696A0'}}>City</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{color:'#8696A0'}} />
                    <input type="text" value={editCity} onChange={(e)=>setEditCity(e.target.value)} maxLength={60}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{background:'#2A3942',color:'#E9EDEF'}} placeholder="Colombo" />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs mb-1" style={{color:'#8696A0'}}>Bio</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4" style={{color:'#8696A0'}} />
                    <textarea value={editBio} onChange={(e)=>setEditBio(e.target.value)} maxLength={150} rows={3}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                      style={{background:'#2A3942',color:'#E9EDEF'}} placeholder="Tell something about you... (150 chars)" />
                  </div>
                  <p className="text-right text-[10px] mt-0.5" style={{color:'#667781'}}>{editBio.length}/150</p>
                </div>
              </div>

              {/* ── Buttons ── */}
              <div className="flex gap-3 mt-5">
                <button onClick={()=>setShowEditProfile(false)} disabled={savingProfile||isUploading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{background:'#2A3942',color:'#E9EDEF'}}>
                  Cancel
                </button>
                <button onClick={handleSaveProfile} disabled={savingProfile||isUploading}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{background:'#25D366',color:'#0B141A'}}>
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
