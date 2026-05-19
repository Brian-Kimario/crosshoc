"use client";

import { motion } from "framer-motion";

const testimonials = [
  { text: '"Best split app I\'ve used"', stars: 5 },
  { text: '"Finally, no more WhatsApp debt reminders"', stars: 0 },
  { text: '"My whole trip group used this"', stars: 5 },
  { text: '"Works for guests? Sold."', stars: 0 },
  { text: '"Cleaner than Splitwise"', stars: 5 },
  { text: '"Settled $4,000 in one weekend trip"', stars: 0 },
];

function StarRating({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-amber-400">
      {"★".repeat(count)}
    </span>
  );
}

function MarqueeItem({ text, stars }: { text: string; stars: number }) {
  return (
    <div className="flex items-center gap-3 px-6 whitespace-nowrap">
      <StarRating count={stars} />
      <span className="text-sm text-slate-500">{text}</span>
      <span className="text-slate-700">·</span>
    </div>
  );
}

export function MarqueeBanner() {
  // Double the items for seamless loop
  const items = [...testimonials, ...testimonials];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="w-full bg-[#0F172A] border-y border-[#1E293B] py-5 overflow-hidden"
    >
      <div className="flex animate-marquee">
        {items.map((item, index) => (
          <MarqueeItem key={index} text={item.text} stars={item.stars} />
        ))}
      </div>
    </motion.div>
  );
}
