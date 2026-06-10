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
          classes: "bg-blue-600 text-white border-blue-700 dark:bg-blue-500 dark:border-blue-600",
        };
      case "coordinator":
      case "admin":
        return {
          label: r.toLowerCase() === "admin" ? "Administrátor" : "Koordinátor",
          icon: <ShieldAlert size={14} />,
          classes: "bg-purple-600 text-white border-purple-700 dark:bg-purple-500 dark:border-purple-600",
        };
      case "institution":
        return {
          label: "Instituce",
          icon: <Building size={14} />,
          classes: "bg-teal-600 text-white border-teal-700 dark:bg-teal-500 dark:border-teal-600",
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
