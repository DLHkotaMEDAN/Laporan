import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const PointList = ({ values, fallback }: { values: string[]; fallback: string }) => {
  const displayValues = values.length > 0 ? values : [fallback];

  if (displayValues.length === 1) {
    return <span className="whitespace-normal break-words">{displayValues[0]}</span>;
  }

  return (
    <div className="space-y-2">
      {displayValues.map((value, index) => (
        <div key={index} className={cn("whitespace-normal break-words", index > 0 && "border-t border-slate-200 pt-2")}>
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Titik {index + 1}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
};

export const TabPageHeader = ({
  title,
  description,
  actionLabel,
  onAction,
  showAction = true,
  actionIcon: ActionIcon = Plus,
  actionClassName = "bg-emerald-600 hover:bg-emerald-700",
  iconClassName = "bg-emerald-50 text-emerald-600",
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  showAction?: boolean;
  actionIcon?: ElementType;
  actionClassName?: string;
  iconClassName?: string;
}) => (
  <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex min-w-0 items-start gap-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconClassName)}>
        <ActionIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
    {showAction && (
      <Button onClick={onAction} className={cn("h-10 w-full rounded-xl px-4 font-bold shadow-sm sm:w-auto", actionClassName)}>
        <ActionIcon className="mr-2 h-4 w-4 shrink-0" />
        {actionLabel}
      </Button>
    )}
  </section>
);
