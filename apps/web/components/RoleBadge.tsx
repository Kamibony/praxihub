"use client";

import React from "react";
import { User, ShieldAlert, Building } from "lucide-react";

type RoleType = "student" | "coordinator" | "admin" | "institution";

interface RoleBadgeProps {
  role?: RoleType | string;
  className?: string;
}

export default function RoleBadge({ role, className = "" }: RoleBadgeProps) {
  if (!role) return null;

  const getRoleConfig = (r: string) => {
    switch (r.toLowerCase()) {
      case "student":
        return {
          label: "Student",
          icon: <User size={14} />,
          classes: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
        };
      case "coordinator":
      case "admin":
        return {
          label: r.toLowerCase() === "admin" ? "Administrátor" : "Koordinátor",
          icon: <ShieldAlert size={14} />,
          classes: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800",
        };
      case "institution":
        return {
          label: "Instituce",
          icon: <Building size={14} />,
          classes: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800",
        };
      default:
        return {
          label: r,
          icon: <User size={14} />,
          classes: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        };
    }
  };

  const config = getRoleConfig(role);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-sm ${config.classes} ${className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
