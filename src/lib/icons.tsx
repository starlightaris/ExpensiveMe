import {
  Baby,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Cookie,
  Droplets,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Music,
  Package,
  PawPrint,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Train,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IncomeSource } from '../types';

/** Icons a tag can use. The key is what gets stored, so keys must never be renamed. */
export const TAG_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  pizza: Pizza,
  coffee: Coffee,
  cookie: Cookie,
  beer: Beer,
  cart: ShoppingCart,
  bag: ShoppingBag,
  shirt: Shirt,
  scissors: Scissors,
  bus: Bus,
  train: Train,
  car: Car,
  fuel: Fuel,
  bike: Bike,
  plane: Plane,
  house: House,
  receipt: Receipt,
  wifi: Wifi,
  phone: Smartphone,
  zap: Zap,
  water: Droplets,
  wrench: Wrench,
  pill: Pill,
  health: HeartPulse,
  gym: Dumbbell,
  film: Clapperboard,
  music: Music,
  game: Gamepad2,
  book: BookOpen,
  study: GraduationCap,
  gift: Gift,
  pet: PawPrint,
  baby: Baby,
  sparkles: Sparkles,
  package: Package,
  tag: Tag,
};

export const TAG_ICON_KEYS = Object.keys(TAG_ICONS);
export const DEFAULT_TAG_ICON = 'tag';

export function TagIcon({ name, size = 18, className }: { name?: string; size?: number; className?: string }) {
  const Icon = (name && TAG_ICONS[name]) || Tag;
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden />;
}

const INCOME_ICONS: Record<IncomeSource, LucideIcon> = { salary: Briefcase, home: House, other: Sparkles };

export function IncomeIcon({ source, size = 18 }: { source: IncomeSource; size?: number }) {
  const Icon = INCOME_ICONS[source];
  return <Icon size={size} strokeWidth={1.8} aria-hidden />;
}
