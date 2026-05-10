import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Beef,
  Candy,
  Carrot,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Grape,
  Leaf,
  Milk,
  Package,
  Pizza,
  Salad,
  Sandwich,
  ShoppingBasket,
  Soup,
  Wheat,
} from "lucide-react";

export const CATEGORY_ICON_OPTIONS = [
  "Carrot",
  "Apple",
  "Milk",
  "Croissant",
  "Package",
  "ShoppingBasket",
  "Leaf",
  "Salad",
  "Grape",
  "Egg",
  "Fish",
  "Drumstick",
  "Beef",
  "Wheat",
  "Sandwich",
  "Pizza",
  "Candy",
  "Soup",
  "CupSoda",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

const iconMap: Record<CategoryIconName, LucideIcon> = {
  Carrot,
  Apple,
  Milk,
  Croissant,
  Package,
  ShoppingBasket,
  Leaf,
  Salad,
  Grape,
  Egg,
  Fish,
  Drumstick,
  Beef,
  Wheat,
  Sandwich,
  Pizza,
  Candy,
  Soup,
  CupSoda,
};

export function isCategoryIconName(value: string | null | undefined): value is CategoryIconName {
  return !!value && (CATEGORY_ICON_OPTIONS as readonly string[]).includes(value);
}

export function CategoryIcon({
  iconName,
  className,
}: {
  iconName: string | null | undefined;
  className?: string;
}) {
  const Icon = isCategoryIconName(iconName) ? iconMap[iconName] : ShoppingBasket;
  return <Icon className={className} aria-hidden="true" />;
}
