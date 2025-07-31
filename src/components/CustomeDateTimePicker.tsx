"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils"; // Your utility for tailwind-merge
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CustomDateTimePickerProps {
  value?: Date;
  onChange: (date?: Date) => void;
  disabled?: boolean;
}

export function CustomDateTimePicker({
  value,
  onChange,
  disabled,
}: CustomDateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [time, setTime] = React.useState<string>(
    value ? format(value, "HH:mm") : ""
  );

  React.useEffect(() => {
    // Update internal state if external value changes
    setDate(value);
    setTime(value ? format(value, "HH:mm") : "");
  }, [value]);

  const handleDateSelect = (selectedDate?: Date) => {
    setDate(selectedDate);
    // Combine selectedDate with current time
    if (selectedDate) {
      const [hours, minutes] = time.split(":").map(Number);
      selectedDate.setHours(hours || 0, minutes || 0, 0, 0); // Set time
    }
    setOpen(false);
    onChange(selectedDate); // Emit combined date and time
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    // Combine current date with new time
    if (date) {
      const [hours, minutes] = newTime.split(":").map(Number);
      const updatedDate = new Date(date); // Create a copy to avoid direct mutation
      updatedDate.setHours(hours || 0, minutes || 0, 0, 0); // Set time
      onChange(updatedDate); // Emit combined date and time
    } else if (newTime) {
      // If no date is selected but time is entered, create a date with today's date
      const today = new Date();
      const [hours, minutes] = newTime.split(":").map(Number);
      today.setHours(hours || 0, minutes || 0, 0, 0);
      onChange(today);
    } else {
      onChange(undefined); // If time is cleared and no date, clear value
    }
    setOpen(false);
  };

  return (
    <div className="flex flex-row gap-5 items-center justify-items-center  outline-none p-2 date-picker ">
      {/* Date Picker */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            {/* <CalendarIcon className="mr-2 h-4 w-4" /> */}
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 bg-gray-700 text-white custom-date-time-picker-popper">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            initialFocus
            className={cn(
              "w-fit",
              "rdp-spacing" // Custom class for spacing
              // If Shadcn Calendar already provides styling classes, combine them here
            )}
          />
        </PopoverContent>
      </Popover>

      {/* Time Input */}
      <div className="flex gap-1.5 w-[240px] outline-none bg-dark-400 ">
        {/* <Label htmlFor="time">Time</Label> */}
        <Input
          id="time"
          type="time" // HTML5 time input for basic time picking
          value={time}
          onChange={handleTimeChange}
          disabled={disabled}
          className="w-fit outline-0"
        />
      </div>
    </div>
  );
}
