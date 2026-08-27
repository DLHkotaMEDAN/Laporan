import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props<T extends string> = {
  columns: Record<T, boolean>;
  labels: Record<T, string>;
  onToggle: (column: T) => void;
};

export const WorkPlanColumnPicker = <T extends string>({ columns, labels, onToggle }: Props<T>) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="h-10 border-blue-200 bg-white text-blue-600 hover:bg-blue-50"><Settings2 className="mr-2 h-4 w-4" /> Pilih Kolom</Button>
    </PopoverTrigger>
    <PopoverContent className="w-56 p-3" align="end">
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tampilkan kolom:</p>
        <div className="space-y-2">
          {(Object.keys(labels) as T[]).map((column) => <div key={column} className="flex items-center space-x-2">
            <Checkbox id={`work-plan-col-${column}`} checked={columns[column]} onCheckedChange={() => onToggle(column)} />
            <Label htmlFor={`work-plan-col-${column}`} className="cursor-pointer text-sm">{labels[column]}</Label>
          </div>)}
        </div>
      </div>
    </PopoverContent>
  </Popover>
);
