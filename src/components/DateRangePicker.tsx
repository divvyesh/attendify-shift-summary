import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAttendanceStore } from "@/store/attendanceStore";

export function DateRangePicker() {
  const { filters, setFilters } = useAttendanceStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleSelect = (range: { from: Date | undefined; to: Date | undefined } | undefined) => {
    setFilters({
      dateRange: {
        from: range?.from || null,
        to: range?.to || null,
      },
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {filters.dateRange.from ? (
            filters.dateRange.to ? (
              <>
                {format(filters.dateRange.from, "MMM dd")} -{" "}
                {format(filters.dateRange.to, "MMM dd, yyyy")}
              </>
            ) : (
              format(filters.dateRange.from, "MMM dd, yyyy")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={filters.dateRange.from || undefined}
          selected={{
            from: filters.dateRange.from || undefined,
            to: filters.dateRange.to || undefined,
          }}
          onSelect={handleSelect}
          numberOfMonths={2}
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}