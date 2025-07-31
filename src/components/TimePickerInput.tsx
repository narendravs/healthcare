"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimePickerInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimePickerInput({ value, onChange }: TimePickerInputProps) {
  const [hour, minute] = value.split(":");

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHour = e.target.value;
    onChange(`${newHour}:${minute}`);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMinute = e.target.value;
    onChange(`${hour}:${newMinute}`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="grid gap-1 text-center">
        <Label htmlFor="hours" className="text-xs">
          Hours
        </Label>
        <Input
          id="hours"
          type="number"
          min="0"
          max="23"
          value={hour}
          onChange={handleHourChange}
          className="w-12 text-center"
        />
      </div>
      <span>:</span>
      <div className="grid gap-1 text-center">
        <Label htmlFor="minutes" className="text-xs">
          Minutes
        </Label>
        <Input
          id="minutes"
          type="number"
          min="0"
          max="59"
          value={minute}
          onChange={handleMinuteChange}
          className="w-12 text-center"
        />
      </div>
    </div>
  );
}
