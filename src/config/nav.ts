import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Home, Route, Users2, CalendarDays, Languages, Gauge,
  NotebookPen, Award, Heart, Bell, CreditCard, Settings, Bot,
  CalendarClock, GraduationCap, ClipboardCheck, Wallet, TrendingUp,
  CalendarRange, LibraryBig, ShieldAlert, RefreshCcw, BadgeCheck,
  BarChart3, KeyRound,
} from "lucide-react";

// Icon registry — server layouts pass icon *names* across the RSC boundary;
// client nav components resolve them here (components themselves are not serializable).
export const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home, route: Route, users: Users2, calendarDays: CalendarDays,
  languages: Languages, gauge: Gauge, notebook: NotebookPen, award: Award,
  heart: Heart, bell: Bell, card: CreditCard, settings: Settings, bot: Bot,
  dashboard: LayoutDashboard, calendarClock: CalendarClock, gradCap: GraduationCap,
  clipboardCheck: ClipboardCheck, wallet: Wallet, trendingUp: TrendingUp,
  calendarRange: CalendarRange, library: LibraryBig, shieldAlert: ShieldAlert,
  refresh: RefreshCcw, badgeCheck: BadgeCheck, barChart: BarChart3, keyRound: KeyRound,
};

export interface NavItem {
  href: string;
  labelKey: string;
  icon: keyof typeof NAV_ICONS;
  exact?: boolean;
  badge?: number;
}

export const STUDENT_NAV: NavItem[] = [
  { href: "/student", labelKey: "nav.overview", icon: "home", exact: true },
  { href: "/student/learning-path", labelKey: "nav.learningPath", icon: "route" },
  { href: "/student/teachers", labelKey: "nav.findTeacher", icon: "users" },
  { href: "/student/schedule", labelKey: "nav.scheduledLessons", icon: "calendarDays" },
  { href: "/student/vocabulary", labelKey: "nav.vocabulary", icon: "languages" },
  { href: "/student/skills", labelKey: "nav.skills", icon: "gauge" },
  { href: "/student/homework", labelKey: "nav.homework", icon: "notebook" },
  { href: "/student/exams", labelKey: "nav.exams", icon: "award" },
  { href: "/student/favorites", labelKey: "nav.favorites", icon: "heart" },
  { href: "/student/notifications", labelKey: "nav.notifications", icon: "bell" },
  { href: "/student/assistant", labelKey: "nav.assistant", icon: "bot" },
  { href: "/student/billing", labelKey: "nav.billing", icon: "card" },
  { href: "/student/settings", labelKey: "nav.settings", icon: "settings" },
];

export const TEACHER_NAV: NavItem[] = [
  { href: "/teacher", labelKey: "nav.teacherOverview", icon: "home", exact: true },
  { href: "/teacher/upcoming", labelKey: "nav.upcoming", icon: "calendarClock" },
  { href: "/teacher/students", labelKey: "nav.students", icon: "gradCap" },
  { href: "/teacher/review", labelKey: "nav.homeworkReview", icon: "clipboardCheck" },
  { href: "/teacher/earnings", labelKey: "nav.earnings", icon: "wallet" },
  { href: "/teacher/performance", labelKey: "nav.performance", icon: "trendingUp" },
  { href: "/teacher/availability", labelKey: "nav.availability", icon: "calendarRange" },
  { href: "/teacher/settings", labelKey: "nav.settings", icon: "settings" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", labelKey: "nav.adminOverview", icon: "dashboard", exact: true },
  { href: "/admin/curriculum", labelKey: "nav.curriculum", icon: "library" },
  { href: "/admin/students", labelKey: "nav.studentsAdmin", icon: "gradCap" },
  { href: "/admin/teachers", labelKey: "nav.teachers", icon: "users" },
  { href: "/admin/exams", labelKey: "nav.examsAdmin", icon: "badgeCheck" },
  { href: "/admin/reports", labelKey: "nav.reports", icon: "shieldAlert" },
  { href: "/admin/retakes", labelKey: "nav.retakes", icon: "refresh" },
  { href: "/admin/certificates", labelKey: "nav.certificates", icon: "award" },
  { href: "/admin/payments", labelKey: "nav.payments", icon: "card" },
  { href: "/admin/analytics", labelKey: "nav.analytics", icon: "barChart" },
  { href: "/admin/roles", labelKey: "nav.roles", icon: "keyRound" },
];
