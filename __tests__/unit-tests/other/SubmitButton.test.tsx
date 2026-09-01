import { render, screen } from "@testing-library/react";
import SubmitButton from "@/components/SubmitButton";
import "@testing-library/jest-dom";

// Mock next/image to avoid optimization issues in JSDOM
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("SubmitButton Unit Test", () => {
  it("renders children when isLoading is false", () => {
    render(<SubmitButton isLoading={false}>Get Started</SubmitButton>);
    
    expect(screen.getByText("Get Started")).toBeInTheDocument();
    expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument();
    
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("renders loader and is disabled when isLoading is true", () => {
    render(<SubmitButton isLoading={true}>Get Started</SubmitButton>);
    
    expect(screen.queryByText("Get Started")).not.toBeInTheDocument();
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
    
    const loaderImg = screen.getByAltText("Loading...");
    expect(loaderImg).toBeInTheDocument();
    expect(loaderImg).toHaveAttribute("src", "/assets/icons/loader.svg");
    expect(loaderImg).toHaveClass("animate-spin");
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("applies 'shad-primary-btn' class when className prop is provided", () => {
    const { rerender } = render(<SubmitButton isLoading={false}>Submit</SubmitButton>);
    
    // Initial state: no className provided, should not have the primary class based on component logic
    let button = screen.getByRole("button");
    expect(button).not.toHaveClass("shad-primary-btn");

    // Rerender with className
    rerender(<SubmitButton isLoading={false} className="some-class">Submit</SubmitButton>);
    button = screen.getByRole("button");
    expect(button).toHaveClass("shad-primary-btn");
  });
});