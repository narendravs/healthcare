import { render, screen, fireEvent } from "@testing-library/react";
import SubmitButton from "@/components/SubmitButton";
import "@testing-library/jest-dom";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("SubmitButton Integration Flow", () => {
  it("allows form submission when not loading", () => {
    const handleSubmit = jest.fn((e) => e.preventDefault());
    
    render(
      <form onSubmit={handleSubmit}>
        <SubmitButton isLoading={false}>Submit Form</SubmitButton>
      </form>
    );

    const button = screen.getByRole("button", { name: /Submit Form/i });
    fireEvent.click(button);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("prevents form submission interaction when loading", () => {
    const handleSubmit = jest.fn((e) => e.preventDefault());
    
    render(
      <form onSubmit={handleSubmit}>
        <SubmitButton isLoading={true}>Submit Form</SubmitButton>
      </form>
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    // Attempting a click on a disabled button shouldn't trigger the form submit
    fireEvent.click(button);
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});