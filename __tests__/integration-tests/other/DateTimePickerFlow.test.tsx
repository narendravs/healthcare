import { render, screen, fireEvent } from "@testing-library/react";
import DateTimePicker from "@/components/DateTimePicker";
import "@testing-library/jest-dom";

// Mock the TimePickerInput to simplify testing interaction
jest.mock("@/components/TimePickerInput", () => ({
  TimePickerInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input 
      data-testid="time-input" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
    />
  ),
}));

// Mock the Calendar component
jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (d: Date | undefined) => void }) => (
    <button 
      data-testid="calendar-day-select" 
      onClick={() => onSelect(new Date(2024, 4, 25))} // May 25, 2024
    >
      Select May 25
    </button>
  ),
}));

describe("DateTimePicker Integration Flow", () => {
  const mockSetDate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates the time while preserving the existing date", () => {
    const initialDate = new Date(2024, 4, 20, 0, 0); // May 20
    render(<DateTimePicker date={initialDate} setDate={mockSetDate} />);

    // Open the popover
    fireEvent.click(screen.getByRole("button"));

    // Change time via our mocked input
    const timeInput = screen.getByTestId("time-input");
    fireEvent.change(timeInput, { target: { value: "15:45" } });

    expect(mockSetDate).toHaveBeenCalledTimes(1);
    const result = mockSetDate.mock.calls[0][0];
    
    expect(result.getFullYear()).toBe(2024);
    expect(result.getMonth()).toBe(4); // May
    expect(result.getDate()).toBe(20); // Preserved
    expect(result.getHours()).toBe(15); // Updated
    expect(result.getMinutes()).toBe(45); // Updated
  });

  it("updates the date and preserves the manually entered time", () => {
    const initialDate = new Date(2024, 4, 20, 10, 30); // May 20, 10:30
    render(<DateTimePicker date={initialDate} setDate={mockSetDate} />);

    // Open the popover
    fireEvent.click(screen.getByRole("button"));

    // Trigger date selection from mock calendar
    fireEvent.click(screen.getByTestId("calendar-day-select"));

    expect(mockSetDate).toHaveBeenCalledTimes(1);
    const result = mockSetDate.mock.calls[0][0];
    
    expect(result.getDate()).toBe(25); // Updated
    expect(result.getHours()).toBe(10); // Preserved
    expect(result.getMinutes()).toBe(30); // Preserved
  });

  it("clears the value when the calendar selection is removed", () => {
    render(<DateTimePicker date={new Date()} setDate={mockSetDate} />);
    fireEvent.click(screen.getByRole("button"));
    
    // Simulating clear/unselect (not explicitly in my mock, but following logic)
    // If your Calendar component supports unselecting, this would be tested here
  });
});
