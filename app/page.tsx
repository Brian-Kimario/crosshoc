"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Calculator,
  UserPlus,
  CheckCircle,
  Camera,
  Download,
  Users,
  ArrowRight,
  Play,
  Github,
  Twitter,
  Check,
} from "lucide-react";
import { Navbar } from "@/components/marketing/Navbar";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { GuestPhoneMockup } from "@/components/marketing/GuestPhoneMockup";
import { MarqueeBanner } from "@/components/marketing/MarqueeBanner";

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function FadeInSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={fadeInUp}
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-[#F8FAFC]">
      <Navbar />

      {/* Section 2 - Hero */}
      <section
        className="relative min-h-screen pt-24 pb-20 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #10B98118 0%, transparent 70%), #0A0F1E",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Hero Content */}
            <div className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
              {/* Announcement Pill */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 text-sm font-medium mb-6">
                  <span className="text-xs">✦</span> New
                  <span className="text-emerald-500/70">|</span>
                  Guest access — no account needed
                </span>
              </motion.div>

              {/* Headline */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="space-y-2"
              >
                <motion.h1
                  variants={fadeInUp}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-slate-100"
                >
                  Stop splitting hairs.
                </motion.h1>
                <motion.h1
                  variants={fadeInUp}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight bg-linear-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent"
                >
                  Start splitting bills.
                </motion.h1>
              </motion.div>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-6 text-lg text-slate-400 max-w-md mx-auto lg:mx-0"
              >
                The fairest way to share expenses with anyone — friends,
                roommates, or people who don't even have an account.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link href="/register">
                  <motion.button
                    whileHover={{
                      scale: 1.03,
                      boxShadow: "0 0 24px #10B98155",
                    }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 px-6 py-3 h-12 text-base font-medium rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
                  >
                    Start for free
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ borderColor: "#10B981", color: "#6EE7B7" }}
                  className="inline-flex items-center gap-2 px-6 py-3 h-12 text-base font-medium rounded-full border border-slate-600 text-slate-300 hover:text-emerald-300 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Watch how it works
                </motion.button>
              </motion.div>

              {/* Social Proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-2 text-xs text-slate-500"
              >
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" /> No credit card
                </span>
                <span className="text-slate-700">·</span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" /> Free forever for personal use
                </span>
                <span className="text-slate-700">·</span>
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3" /> Works without an account
                </span>
              </motion.div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 - Social Proof Bar */}
      <MarqueeBanner />

      {/* Section 4 - Features */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <FadeInSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-4">
                Everything you need.
                <br />
                Nothing you don't.
              </h2>
              <p className="text-lg text-slate-400 max-w-xl mx-auto">
                Built for the real world — where not everyone has an app.
              </p>
            </div>
          </FadeInSection>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Calculator}
              title="Split any way you want"
              body="Equal shares, custom percentages, or exact amounts. Add expenses in seconds — the math never lies."
              delay={0}
            />
            <FeatureCard
              icon={UserPlus}
              title="No account? No problem."
              body="Share a link. Your guest sees their balance, settles up, and uploads proof — without ever creating an account."
              badge="New"
              delay={0.1}
            />
            <FeatureCard
              icon={CheckCircle}
              title="Settle in one tap"
              body="See exactly who owes what. Settle up with payment proof attached — no more 'did you get it?' messages."
              delay={0.2}
            />
            <FeatureCard
              icon={Camera}
              title="Snap a receipt. Done."
              body="Point your camera at any receipt. SplitEasy reads it, calculates the split, and notifies everyone instantly."
              wide
              delay={0.3}
            />
            <FeatureCard
              icon={Download}
              title="Full history. Always."
              body="Export any group to CSV. Every expense, every split, every settlement. Your records, your way."
              delay={0.4}
            />
            <FeatureCard
              icon={Users}
              title="One dashboard. All groups."
              body="Roommates, a wedding group, a weekend trip — manage every group from a single clean dashboard."
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Section 5 - How it works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0F172A]">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <FadeInSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-4">
                From dinner to settled.
                <br />
                In under 60 seconds.
              </h2>
            </div>
          </FadeInSection>

          {/* Steps */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {[
              {
                number: "01",
                title: "Create a group",
                body: "Name it, add members — or just yourself first. Guests can join later with a link.",
              },
              {
                number: "02",
                title: "Add expenses as you go",
                body: "Snap a receipt or enter manually. Pick who's included and how to split it.",
              },
              {
                number: "03",
                title: "Everyone settles up",
                body: "Members pay in-app. Guests get a link straight to their balance. Done.",
                highlight: true,
              },
            ].map((step, index) => (
              <FadeInSection key={step.number} delay={index * 0.1}>
                <div className="relative text-center md:text-left">
                  {/* Number */}
                  <span
                    className={`absolute -top-4 left-1/2 md:left-0 -translate-x-1/2 md:translate-x-0 text-6xl lg:text-7xl font-bold ${
                      step.highlight ? "text-emerald-500/20" : "text-slate-700"
                    }`}
                  >
                    {step.number}
                  </span>
                  <div className="relative pt-16">
                    <h3 className="text-xl font-semibold text-slate-100 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-slate-400">{step.body}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 - Guest Access Spotlight */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - Text */}
            <FadeInSection>
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Guest Access
                </span>
                <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-4">
                  Invite anyone.
                  <br />
                  No signup wall.
                </h2>
                <p className="text-lg text-slate-400 mb-8">
                  Send a magic link via WhatsApp, iMessage, or email. Your guest
                  sees exactly what they owe — nothing more. They settle up, upload
                  proof, and you confirm. Clean.
                </p>

                {/* Feature Rows */}
                <div className="space-y-4 mb-8">
                  {[
                    "72-hour secure invite window",
                    "30-day guest session — no expiry mid-trip",
                    "Payment proof upload built in",
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                      <span className="text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Learn how guest access works
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </FadeInSection>

            {/* Right - Phone Mockup */}
            <div className="flex justify-center">
              <GuestPhoneMockup />
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 - Pricing */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0F172A]">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <FadeInSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-4">
                Simple pricing.
              </h2>
              <p className="text-lg text-slate-400">
                Free for everyone. Pro when you're ready.
              </p>
            </div>
          </FadeInSection>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <FadeInSection delay={0}>
              <div className="relative bg-[#0F172A] border border-emerald-500/30 rounded-2xl p-8 shadow-xl shadow-emerald-500/5">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-100">Free</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-100">$0</span>
                    <span className="text-slate-500">/ forever</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    "Unlimited groups",
                    "Unlimited expenses",
                    "Guest access (magic links)",
                    "CSV export",
                    "Payment proof",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-slate-300">
                      <Check className="w-5 h-5 text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href="/register" className="block">
                  <button className="w-full py-3 rounded-full bg-emerald-500 text-white font-medium hover:bg-emerald-400 transition-colors">
                    Get started free
                  </button>
                </Link>
              </div>
            </FadeInSection>

            {/* Pro */}
            <FadeInSection delay={0.1}>
              <div className="relative bg-[#0F172A]/50 border border-[#1E293B] rounded-2xl p-8 opacity-75">
                <div className="absolute -top-3 right-6 px-3 py-1 text-xs font-medium rounded-full bg-slate-700 text-slate-300">
                  Coming soon
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-slate-100">Pro</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-slate-100">$4</span>
                    <span className="text-slate-500">/ month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {[
                    "Everything in Free",
                    "Receipt OCR scanning",
                    "Recurring expenses",
                    "Priority support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-slate-400">
                      <Check className="w-5 h-5 text-slate-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className="w-full py-3 rounded-full border border-slate-600 text-slate-300 font-medium hover:border-emerald-500 hover:text-emerald-400 transition-colors">
                  Notify me
                </button>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Section 8 - Final CTA */}
      <section
        className="py-24 px-4 sm:px-6 lg:px-8"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, #10B98118 0%, transparent 70%), #0A0F1E",
        }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <FadeInSection>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100 mb-4">
              Ready to stop chasing people for money?
            </h2>
            <p className="text-lg text-slate-400 mb-8">
              Free forever. No card. Invite your group in 30 seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: "0 0 24px #10B98155" }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-6 py-3 h-12 text-base font-medium rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition-colors"
                >
                  Create your first group
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
              <motion.button
                whileHover={{ borderColor: "#10B981", color: "#6EE7B7" }}
                className="inline-flex items-center gap-2 px-6 py-3 h-12 text-base font-medium rounded-full border border-slate-600 text-slate-300 hover:text-emerald-300 transition-colors"
              >
                Try the demo
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Section 9 - Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-[#1E293B] bg-[#0A0F1E]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Column 1 - Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="font-semibold text-lg text-slate-100">SplitEasy</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Zero-friction expense splitting.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">
                  <Github className="w-5 h-5" />
                </a>
                <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>

            {/* Column 2 - Product */}
            <div>
              <h4 className="font-medium text-slate-200 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <a href="#features" className="hover:text-slate-300 transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-slate-300 transition-colors">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-slate-300 transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    Demo
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3 - Legal */}
            <div>
              <h4 className="font-medium text-slate-200 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4 - Connect */}
            <div>
              <h4 className="font-medium text-slate-200 mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    Twitter
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-slate-300 transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-[#1E293B] text-center text-sm text-slate-500">
            © 2025 SplitEasy. Built for the real world.
          </div>
        </div>
      </footer>
    </div>
  );
}
