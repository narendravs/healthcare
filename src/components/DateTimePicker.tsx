"use client";

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
import { TimePickerInput } from "@/components/TimePickerInput"; // Your custom time input

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  placeholder?: string;
}

export function DateTimePicker({
  date,
  setDate,
  placeholder = "Pick a date and time",
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [time, setTime] = React.useState<string>(
    date ? format(date, "HH:mm") : ""
  );

  React.useEffect(() => {
    if (date) {
      setTime(format(date, "HH:mm"));
    }
  }, [date]);

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const newDate = new Date(date);
      newDate.setHours(hours || 0, minutes || 0, 0, 0); // Set hours and minutes, clear seconds/ms
      setDate(newDate);
    } else if (newTime) {
      // If no date is selected yet, set it to today with the chosen time
      const [hours, minutes] = newTime.split(":").map(Number);
      const today = new Date();
      today.setHours(hours || 0, minutes || 0, 0, 0);
      setDate(today);
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      if (time) {
        const [hours, minutes] = time.split(":").map(Number);
        newDate.setHours(hours || 0, minutes || 0, 0, 0);
      }
      setDate(newDate);
    } else {
      setDate(undefined);
    }
    setOpen(false); // Close popover after date selection
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal flex flex-row items-center gap-4",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-6 w-6 opacity-5" />
          {date ? (
            format(date, "PPP HH:mm")
          ) : (
            <span className="opacity-30">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-5 z-50 bg-dark-100 text-dark-700">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold">Select Date and Time</h3>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateChange}
          initialFocus
        />
        <div className="p-4 border-t border-border flex items-center justify-center gap-2">
          <TimePickerInput value={time} onChange={handleTimeChange} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
export default DateTimePicker;
