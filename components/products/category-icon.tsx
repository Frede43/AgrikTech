import { Apple, Carrot, Coffee, LeafyGreen, Package, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryIconProps {
  category: string;
  className?: string;
}

export function CategoryIcon({ category, className }: CategoryIconProps) {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const Icon = normalized.includes("cereale") || normalized.includes("grain")
    ? Wheat
    : normalized.includes("tubercule") || normalized.includes("racine")
      ? Carrot
      : normalized.includes("fruit")
        ? Apple
        : normalized.includes("export") || normalized.includes("cafe") || normalized.includes("coffee")
          ? Coffee
          : normalized.includes("legume") || normalized.includes("vegetable")
            ? LeafyGreen
            : Package;

  return <Icon className={cn("shrink-0", className)} aria-hidden="true" />;
}
