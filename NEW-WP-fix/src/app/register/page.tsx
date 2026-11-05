'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile } from '@/lib/firebase';
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Animation Variants ───────────────────────────────────────────────────

const containerVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
} as const;

const itemVariants = {
  initial: { opacity: 0, y: 24, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 28 },
  },
} as const;

// ─── Register Page Component ──────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Field-level Validation ────────────────────────────────────────────

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [fullName, email, password, confirmPassword]);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors((prev) => {
      if (prev[field]) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return prev;
    });
  }, []);

  // ─── Email/Password Registration ────────────────────────────────────────

  const handleRegister = useCallback(async () => {
    setError('');

    if (!validate()) return;

    setIsLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

      // Set display name on the Firebase Auth profile
      await updateProfile(credential.user, {
        displayName: fullName.trim(),
      });

      // Create Firestore user profile document
      const userProfile: Omit<UserProfile, 'uid'> = {
        displayName: fullName.trim(),
        email: email.trim(),
        photoURL: null,
        coinBalance: 0,
        totalEarned: 0,
        totalSpent: 0,
        isLive: false,
        liveChannelName: null,
        createdAt: new Date(),
        lastSeen: new Date(),
      };

      await setDoc(doc(db, 'users', credential.user.uid), {
        ...userProfile,
        uid: credential.user.uid,
        createdAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });

      toast({
        title: 'Account created!',
        description: 'Welcome! You can now log in with your credentials.',
        variant: 'default',
      });

      router.push('/login');
    } catch (err: any) {
      const firebaseMessage = err?.message || '';
      if (firebaseMessage.includes('email-already-in-use')) {
        setError('This email is already registered. Try logging in instead.');
      } else if (firebaseMessage.includes('invalid-email')) {
        setError('Invalid email address format.');
      } else if (firebaseMessage.includes('weak-password')) {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (firebaseMessage.includes('network-request-failed')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError('Registration failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, fullName, validate, router, toast]);

  // ─── Google Sign-Up ─────────────────────────────────────────────────────

  const completeGoogleSignUp = useCallback(
    async (credential: UserCredential) => {
      // Check if Firestore doc already exists (returning user via Google)
      const { getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', credential.user.uid));

      if (!userDoc.exists()) {
        // New Google user — create profile
        await setDoc(doc(db, 'users', credential.user.uid), {
          uid: credential.user.uid,
          displayName: credential.user.displayName || 'User',
          email: credential.user.email || '',
          photoURL: credential.user.photoURL || null,
          coinBalance: 0,
          totalEarned: 0,
          totalSpent: 0,
          isLive: false,
          liveChannelName: null,
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });

        toast({
          title: 'Account created!',
          description: `Welcome, ${credential.user.displayName || 'User'}!`,
        });
      }

      // Redirect to home
      router.push('/');
    },
    [router, toast]
  );

  const describeGoogleError = (code: string, message: string) => {
    if (code === 'auth/unauthorized-domain') {
      return `This domain isn't authorized for Google sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains. (${code})`;
    }
    if (code === 'auth/operation-not-allowed') {
      return `Google sign-in isn't enabled for this project. Enable it in Firebase Console → Authentication → Sign-in method. (${code})`;
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with this email. Try logging in with your password.';
    }
    if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
      return 'Firebase is misconfigured (invalid API key). Please contact support.';
    }
    return `Google sign-up failed (${code || message || 'unknown error'}).`;
  };

  // Complete a pending redirect-based sign-up (mobile fallback) when the page loads.
  useEffect(() => {
    getRedirectResult(auth)
      .then((credential) => {
        if (credential) {
          completeGoogleSignUp(credential);
        }
      })
      .catch((err: any) => {
        const code = err?.code || '';
        if (code && code !== 'auth/no-current-user') {
          setError(describeGoogleError(code, err?.message));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignUp = useCallback(async () => {
    setError('');
    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      let credential: UserCredential;

      try {
        credential = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        const popupCode = popupErr?.code || '';
        if (
          popupCode === 'auth/popup-blocked' ||
          popupCode === 'auth/cancelled-popup-request' ||
          popupCode === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, provider);
          return; // page will reload after redirect; handled by the useEffect above
        }
        if (popupCode === 'auth/popup-closed-by-user') {
          return;
        }
        throw popupErr;
      }

      await completeGoogleSignUp(credential);
    } catch (err: any) {
      setError(describeGoogleError(err?.code || '', err?.message || ''));
      console.error('[Google Sign-Up]', err);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [completeGoogleSignUp]);

  // ─── Shared Input Styles ────────────────────────────────────────────────

  const inputBaseClass =
    'w-full px-4 py-3.5 rounded-xl bg-[#1F2C34] border text-white text-sm placeholder-gray-500 outline-none transition-all duration-200';

  const inputNormal = `${inputBaseClass} border-[#2A3942] focus:border-[#25D366]/60 focus:shadow-[0_0_0_3px_rgba(37,211,102,0.1)]`;
  const inputError = `${inputBaseClass} border-red-500/60 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1)]`;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: '#0B141A' }}>
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#075E54] via-[#0B141A] to-[#1F2C34]" />

        {/* Floating teal blob 1 */}
        <motion.div
          className="absolute w-72 h-72 rounded-full bg-[#25D366]/8 blur-3xl"
          style={{ top: '5%', left: '-10%' }}
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -50, 30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating teal blob 2 */}
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-[#075E54]/20 blur-3xl"
          style={{ bottom: '-15%', right: '-15%' }}
          animate={{
            x: [0, -60, 40, 0],
            y: [0, 40, -60, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Floating teal blob 3 */}
        <motion.div
          className="absolute w-52 h-52 rounded-full bg-[#128C7E]/12 blur-3xl"
          style={{ top: '50%', left: '60%' }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -30, 50, 0],
            scale: [1, 0.8, 1.2, 1],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(0,168,132,0.3) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* ── Content ── */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-auto px-5 py-8"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {/* ── Logo / Brand ── */}
        <motion.div variants={itemVariants} className="text-center mb-8">
          {/* App icon */}
          <motion.div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              boxShadow: '0 8px 32px rgba(0, 168, 132, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
            animate={{
              boxShadow: [
                '0 8px 32px rgba(0, 168, 132, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                '0 12px 48px rgba(0, 168, 132, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
                '0 8px 32px rgba(0, 168, 132, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className="w-7 h-7 text-white" />
          </motion.div>

          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{
              background: 'linear-gradient(135deg, #25D366, #00A884)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Create Account
          </h1>
          <p className="text-sm text-gray-400">
            Join Wp-earn-money and start connecting with people worldwide
          </p>
        </motion.div>

        {/* ── Glassmorphism Card ── */}
        <motion.div
          variants={itemVariants}
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'rgba(31, 44, 52, 0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(42, 57, 66, 0.6)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          {/* ── Error Banner ── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20"
              >
                <p className="text-sm text-red-400 leading-relaxed">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Form Fields ── */}
          <div className="space-y-4">
            {/* Full Name */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearFieldError('fullName');
                    setError('');
                  }}
                  placeholder="John Doe"
                  autoComplete="name"
                  className={`${fieldErrors.fullName ? inputError : inputNormal} pl-11`}
                />
              </div>
              <AnimatePresence>
                {fieldErrors.fullName && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-red-400 mt-1 pl-1"
                  >
                    {fieldErrors.fullName}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Email */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                    setError('');
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`${fieldErrors.email ? inputError : inputNormal} pl-11`}
                />
              </div>
              <AnimatePresence>
                {fieldErrors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-red-400 mt-1 pl-1"
                  >
                    {fieldErrors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError('password');
                    setError('');
                  }}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className={`${fieldErrors.password ? inputError : inputNormal} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence>
                {fieldErrors.password && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-red-400 mt-1 pl-1"
                  >
                    {fieldErrors.password}
                  </motion.p>
                )}
              </AnimatePresence>
              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map((level) => {
                    const strength =
                      password.length >= 6 && /[A-Z]/.test(password) && /[0-9]/.test(password)
                        ? password.length >= 10
                          ? 4
                          : password.length >= 8
                            ? 3
                            : 2
                        : password.length >= 6
                          ? 1
                          : 0;
                    const filled = strength >= level;
                    const color =
                      strength <= 1 ? 'bg-red-500' : strength <= 2 ? 'bg-yellow-500' : strength <= 3 ? 'bg-blue-500' : 'bg-[#25D366]';
                    return (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${filled ? color : 'bg-[#2A3942]'}`}
                      />
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Confirm Password */}
            <motion.div variants={itemVariants}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearFieldError('confirmPassword');
                    setError('');
                  }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`${fieldErrors.confirmPassword ? inputError : inputNormal} pl-11 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence>
                {fieldErrors.confirmPassword && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-red-400 mt-1 pl-1"
                  >
                    {fieldErrors.confirmPassword}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* ── Sign Up Button ── */}
          <motion.div variants={itemVariants} className="mt-7">
            <motion.button
              onClick={handleRegister}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                boxShadow: '0 4px 20px rgba(37, 211, 102, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
              whileHover={
                !isLoading
                  ? {
                      scale: 1.02,
                      boxShadow: '0 8px 32px rgba(37, 211, 102, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                    }
                  : undefined
              }
              whileTap={!isLoading ? { scale: 0.98 } : undefined}
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </motion.div>

          {/* ── Divider ── */}
          <motion.div variants={itemVariants} className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#2A3942]" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-[#2A3942]" />
          </motion.div>

          {/* ── Google Sign-Up Button ── */}
          <motion.div variants={itemVariants}>
            <motion.button
              onClick={handleGoogleSignUp}
              disabled={isGoogleLoading}
              className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-white/[0.07] border border-[#2A3942] text-white hover:bg-white/[0.12] hover:border-[#3A4952]"
              whileHover={!isGoogleLoading ? { scale: 1.02 } : undefined}
              whileTap={!isGoogleLoading ? { scale: 0.98 } : undefined}
            >
              {isGoogleLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-5 h-5 text-gray-400" />
                </motion.div>
              ) : (
                <>
                  {/* Google SVG icon */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Sign up with Google</span>
                </>
              )}
            </motion.button>
          </motion.div>
        </motion.div>

        {/* ── Footer ── */}
        <motion.div variants={itemVariants} className="text-center mt-7">
          <p className="text-sm text-gray-400">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="font-semibold hover:underline transition-all"
              style={{ color: '#25D366' }}
            >
              Log in
            </button>
          </p>
        </motion.div>

        {/* ── Bottom safe area spacer ── */}
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
