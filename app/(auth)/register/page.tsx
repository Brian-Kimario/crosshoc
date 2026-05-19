'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Shield, Zap, Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

// Password strength calculator
function getPasswordStrength(password: string): { score: number; label: string; color: string; width: string } {
  if (password.length === 0) return { score: 0, label: '', color: '', width: '0%' };
  if (password.length < 6) return { score: 1, label: 'Too short', color: '#F43F5E', width: '20%' };
  if (password.length < 8) return { score: 2, label: 'Weak', color: '#F59E0B', width: '40%' };
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const extras = [hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  if (extras === 0) return { score: 2, label: 'Weak', color: '#F59E0B', width: '50%' };
  if (extras === 1) return { score: 3, label: 'Fair', color: '#F59E0B', width: '70%' };
  if (extras === 2) return { score: 4, label: 'Good', color: '#10B981', width: '85%' };
  return { score: 5, label: 'Strong', color: '#10B981', width: '100%' };
}

function RegisterPageSkeleton() {
  return (
    <AuthLayout brandPanel={<AuthBrandPanel />}>
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-3/4" />
        <div className="h-4 bg-slate-800 rounded w-1/2" />
        <div className="h-20 bg-slate-800 rounded mt-8" />
        <div className="h-20 bg-slate-800 rounded" />
        <div className="h-20 bg-slate-800 rounded" />
      </div>
    </AuthLayout>
  );
}

function RegisterPageContent() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        const inviteToken = searchParams.get('inviteToken');
        if (inviteToken) {
          router.push(`/join/${inviteToken}`);
        } else {
          router.push('/dashboard');
        }
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [success, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <AuthLayout brandPanel={<AuthBrandPanel />}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-2">
            Create your account
          </h1>
          <p className="text-sm text-slate-400">
            Free forever. No credit card.
          </p>
        </div>

        {/* Error Message */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-400 text-sm flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                <span className="text-xs">!</span>
              </div>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Full name
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                disabled={loading || success}
                autoCapitalize="words"
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-12 pr-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                disabled={loading || success}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-12 pr-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading || success}
                className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-12 pr-12 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1">
                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: strength.width }}
                      transition={{ duration: 0.3 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: strength.color }}
                    />
                  </div>
                  <span
                    className="text-xs ml-2 font-medium"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Trust Signals */}
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Shield className="w-3.5 h-3.5" />
              <span>Your data is encrypted end-to-end</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3.5 h-3.5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Zap className="w-3.5 h-3.5" />
              <span>Account ready in 30 seconds</span>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading || success}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              <>
                Create free account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer Link */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            Sign in →
          </Link>
        </p>

        {/* Success Overlay */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0A0F1E]/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-6 -m-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
              >
                <Check className="w-8 h-8 text-emerald-400" />
              </motion.div>
              <h3 className="text-xl font-semibold text-slate-100 mb-2">
                You are in!
              </h3>
              <p className="text-sm text-slate-400">
                Taking you to your dashboard...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterPageSkeleton />}>
      <RegisterPageContent />
    </Suspense>
  );
}
