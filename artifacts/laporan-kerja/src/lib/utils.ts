import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uniqueAutocompleteValues(values: Iterable<string>): string[] {
  const uniqueValues = new Map<string, string>();

  for (const value of values) {
    const displayValue = value.trim().replace(/\s+/g, " ");
    const comparisonValue = displayValue.toLocaleLowerCase("id-ID");

    if (displayValue && !uniqueValues.has(comparisonValue)) {
      uniqueValues.set(comparisonValue, displayValue);
    }
  }

  return [...uniqueValues.values()].sort((first, second) =>
    first.localeCompare(second, "id-ID", { sensitivity: "base" }),
  );
}
