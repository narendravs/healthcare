import { render, screen } from "@testing-library/react";
import { CustomDateTimePicker } from "@/components/CustomeDateTimePicker";
import "@testing-library/jest-dom";

describe("CustomDateTimePicker Unit Test", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with placeholder when no value is provided", () => {
    render(<CustomDateTimePicker onChange={mockOnChange} />);
    expect(screen.getByText("Pick a date")).toBeInTheDocument();
  });

  it("displays current date and time values when provided", () => {
    const testDate = new Date("2024-05-20T10:30:00");
    render(<CustomDateTimePicker value={testDate} onChange={mockOnChange} />);
    
    // Check for formatted date (date-fns PPP format)
    expect(screen.getByText(/May 20/i)).toBeInTheDocument();
    
    // Check for time input value
    const timeInput = screen.getByDisplayValue("10:30");
    expect(timeInput).toBeInTheDocument();
    expect(timeInput).toHaveAttribute("type", "time");
  });

  it("disables both date button and time input when disabled prop is true", () => {
    const { container } = render(<CustomDateTimePicker onChange={mockOnChange} disabled={true} />);
    
    const dateButton = screen.getByRole("button", { name: /pick a date/i });
    const timeInput = container.querySelector<HTMLInputElement>('input[type="time"]'); // type='time' can be tricky to find by role
    
    expect(dateButton).toBeDisabled();
    expect(timeInput).toBeDisabled();
    expect(timeInput).toBeInTheDocument();
  });
});
