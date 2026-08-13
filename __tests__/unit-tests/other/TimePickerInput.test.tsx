import { render, screen, fireEvent } from "@testing-library/react";
import { TimePickerInput } from "@/components/TimePickerInput";
import "@testing-library/jest-dom";

describe("TimePickerInput Unit Test", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with initial hour and minute values parsed from the string", () => {
    render(<TimePickerInput value="14:45" onChange={mockOnChange} />);

    const hourInput = screen.getByLabelText(/Hours/i) as HTMLInputElement;
    const minuteInput = screen.getByLabelText(/Minutes/i) as HTMLInputElement;

    expect(hourInput.value).toBe("14");
    expect(minuteInput.value).toBe("45");
  });

  it("calls onChange with updated hour while preserving minutes", () => {
    render(<TimePickerInput value="10:30" onChange={mockOnChange} />);

    const hourInput = screen.getByLabelText(/Hours/i);
    fireEvent.change(hourInput, { target: { value: "11" } });

    expect(mockOnChange).toHaveBeenCalledWith("11:30");
  });

  it("calls onChange with updated minute while preserving hours", () => {
    render(<TimePickerInput value="10:30" onChange={mockOnChange} />);

    const minuteInput = screen.getByLabelText(/Minutes/i);
    fireEvent.change(minuteInput, { target: { value: "45" } });

    expect(mockOnChange).toHaveBeenCalledWith("10:45");
  });

  it("has correct min and max constraints for hours and minutes", () => {
    render(<TimePickerInput value="00:00" onChange={mockOnChange} />);

    const hourInput = screen.getByLabelText(/Hours/i);
    const minuteInput = screen.getByLabelText(/Minutes/i);

    expect(hourInput).toHaveAttribute("min", "0");
    expect(hourInput).toHaveAttribute("max", "23");
    expect(minuteInput).toHaveAttribute("min", "0");
    expect(minuteInput).toHaveAttribute("max", "59");
  });
});