import { render, screen, fireEvent } from "@testing-library/react";
import { CustomDateTimePicker } from "@/components/CustomeDateTimePicker";
import "@testing-library/jest-dom";

// Mocking the Calendar component to simplify interaction in JSDOM
jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <div data-testid="mock-calendar">
      <button onClick={() => onSelect(new Date("2024-05-25T00:00:00"))}>
        Select May 25
      </button>
    </div>
  ),
}));

describe("CustomDateTimePicker Integration Flow", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("updates the time while preserving the currently selected date", () => {
    const initialDate = new Date("2024-05-20T14:00:00");
    render(<CustomDateTimePicker value={initialDate} onChange={mockOnChange} />);

    const timeInput = screen.getByDisplayValue("14:00");
    fireEvent.change(timeInput, { target: { value: "16:45" } });

    expect(mockOnChange).toHaveBeenCalledWith(expect.any(Date));
    const resultDate = mockOnChange.mock.calls[0][0];
    
    expect(resultDate.getFullYear()).toBe(2024);
    expect(resultDate.getDate()).toBe(20);
    expect(resultDate.getHours()).toBe(16);
    expect(resultDate.getMinutes()).toBe(45);
  });

  it("combines a newly selected date with the existing time value", () => {
    // Start with a date and specific time
    const initialDate = new Date("2024-05-20T09:15:00");
    render(<CustomDateTimePicker value={initialDate} onChange={mockOnChange} />);

    // Open Popover
    const trigger = screen.getByRole("button");
    fireEvent.click(trigger);

    // Select May 25 from the mocked calendar
    const dayButton = screen.getByText("Select May 25");
    fireEvent.click(dayButton);

    expect(mockOnChange).toHaveBeenCalledWith(expect.any(Date));
    const resultDate = mockOnChange.mock.calls[0][0];

    // Date should be updated, time should be preserved
    expect(resultDate.getFullYear()).toBe(2024);
    expect(resultDate.getDate()).toBe(25);
    expect(resultDate.getHours()).toBe(9);
    expect(resultDate.getMinutes()).toBe(15);
  });
});
