import { render, screen } from "@testing-library/react";
import DateTimePicker from "@/components/DateTimePicker";
import "@testing-library/jest-dom";

describe("DateTimePicker Unit Test", () => {
  const mockSetDate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with the default placeholder when no date is provided", () => {
    render(<DateTimePicker date={undefined} setDate={mockSetDate} />);
    expect(screen.getByText("Pick a date and time")).toBeInTheDocument();
  });

  it("renders with a custom placeholder when provided", () => {
    render(
      <DateTimePicker 
        date={undefined} 
        setDate={mockSetDate} 
        placeholder="Select Appointment Time" 
      />
    );
    expect(screen.getByText("Select Appointment Time")).toBeInTheDocument();
  });

  it("displays the formatted date and time when a value is provided", () => {
    // May 20, 2024, 10:30 AM
    const testDate = new Date(2024, 4, 20, 10, 30);
    render(<DateTimePicker date={testDate} setDate={mockSetDate} />);
    
    // The component uses format(date, "PPP HH:mm")
    // We check for key parts of the date and the specific time
    const button = screen.getByRole("button");
    expect(button).toHaveTextContent(/May 20/i);
    expect(button).toHaveTextContent("2024");
    expect(button).toHaveTextContent("10:30");
  });
});
