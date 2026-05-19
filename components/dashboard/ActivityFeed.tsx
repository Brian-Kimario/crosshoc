"use client";

import { motion } from "framer-motion";
import { Receipt, CheckCircle, UserPlus, Sparkles, ArrowUpRight } from "lucide-react";

interface Activity {
  id: string;
  type: "expense" | "settlement" | "join" | "create" | "cleared";
  title: string;
  description: string;
  time: string;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const activityConfig = {
  expense: {
    icon: Receipt,
    bgColor: "bg-teal-950",
    iconColor: "text-teal-400",
  },
  settlement: {
    icon: CheckCircle,
    bgColor: "bg-emerald-950",
    iconColor: "text-emerald-400",
  },
  join: {
    icon: UserPlus,
    bgColor: "bg-blue-950",
    iconColor: "text-blue-400",
  },
  create: {
    icon: Sparkles,
    bgColor: "bg-violet-950",
    iconColor: "text-violet-400",
  },
  cleared: {
    icon: CheckCircle,
    bgColor: "bg-amber-950",
    iconColor: "text-amber-400",
  },
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-[#1E293B]">
        <h3 className="font-semibold text-slate-200">Recent Activity</h3>
        <p className="text-xs text-slate-500">Latest updates from your groups</p>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1E293B] flex items-center justify-center mx-auto mb-3">
              <ArrowUpRight className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-500">No recent activity</p>
            <p className="text-xs text-slate-600 mt-1">
              Activity will appear here when you create groups or add expenses
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E293B]">
            {activities.map((activity, index) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="p-4 hover:bg-[#1E293B]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-4 h-4 ${config.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">
                        {activity.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {activity.description}
                      </p>
                      <p className="text-xs text-slate-600 mt-1.5">{activity.time}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
