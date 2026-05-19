'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <AuthLayout brandPanel={<AuthBrandPanel />}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100 mb-2">
            Forgot password?
          </h1>
          <p className="text-sm text-slate-400">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Success Message */}
        {success ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-950/50 border border-emerald-800/50 rounded-xl text-emerald-400 text-sm flex items-start gap-3"
          >
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Check your email for a reset link</p>
              <p className="text-emerald-500/80 mt-1">
                If an account exists for {email}, you&apos;ll receive a password reset email shortly.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-3 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-400 text-sm flex items-center gap-2"
              >
                <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xs">!</span>
                </div>
                {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
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
                    disabled={loading}
                    className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-12 pr-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 px-4 bg-[#10B981] hover:bg-[#059669] text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          </>
        )}

        {/* Footer Link */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Remember your password?{' '}
          <Link
            href="/login"
            className="text-teal-400 hover:text-teal-300 transition-colors font-medium"
          >
            Back to sign in →
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  );
}
