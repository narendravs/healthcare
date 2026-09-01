import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { TimePickerInput } from "@/components/TimePickerInput";
import "@testing-library/jest-dom";

// A wrapper component to test the controlled nature of TimePickerInput
const TestWrapper = () => {
  const [time, setTime] = useState("09:00");
  return (
    <div>
      <span data-testid="current-time">{time}</span>
      <TimePickerInput value={time} onChange={setTime} />
    </div>
  );
};

describe("TimePickerInput Integration Flow", () => {
  it("updates the parent state correctly when user interacts with inputs", () => {
    render(<TestWrapper />);

    const hourInput = screen.getByLabelText(/Hours/i);
    const minuteInput = screen.getByLabelText(/Minutes/i);
    const timeDisplay = screen.getByTestId("current-time");

    expect(timeDisplay).toHaveTextContent("09:00");

    // Change Hour
    fireEvent.change(hourInput, { target: { value: "22" } });
    expect(timeDisplay).toHaveTextContent("22:00");

    // Change Minute
    fireEvent.change(minuteInput, { target: { value: "15" } });
    expect(timeDisplay).toHaveTextContent("22:15");
  });

  it("reflects external state changes from the parent", () => {
    const { rerender } = render(<TimePickerInput value="08:00" onChange={jest.fn()} />);
    expect(screen.getByLabelText(/Hours/i)).toHaveValue(8);

    rerender(<TimePickerInput value="12:00" onChange={jest.fn()} />);
    expect(screen.getByLabelText(/Hours/i)).toHaveValue(12);
  });
});