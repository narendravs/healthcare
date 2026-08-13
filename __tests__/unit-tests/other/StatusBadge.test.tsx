import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/StatusBadge";
import "@testing-library/jest-dom";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

// Mock constants/index to provide icons for the badge
jest.mock("@/constants/index", () => ({
  StatusIcon: {
    scheduled: "/assets/icons/check.svg",
    pending: "/assets/icons/pending.svg",
    cancelled: "/assets/icons/cancelled.svg",
  },
}));

describe("StatusBadge Unit Test", () => {
  it("renders the scheduled status with correct styling and icon", () => {
    const { container } = render(<StatusBadge status="scheduled" />);
    const badge = container.firstChild;
    
    expect(badge).toHaveClass("bg-green-600");
    const text = screen.getByText("scheduled");
    expect(text).toHaveClass("text-green-500");
    expect(screen.getByAltText("doctor")).toHaveAttribute("src", "/assets/icons/check.svg");
  });

  it("renders the pending status with correct styling and icon", () => {
    const { container } = render(<StatusBadge status="pending" />);
    const badge = container.firstChild;
    
    expect(badge).toHaveClass("bg-blue-600");
    const text = screen.getByText("pending");
    expect(text).toHaveClass("text-blue-500");
    expect(screen.getByAltText("doctor")).toHaveAttribute("src", "/assets/icons/pending.svg");
  });

  it("renders the cancelled status with correct styling and icon", () => {
    const { container } = render(<StatusBadge status="cancelled" />);
    const badge = container.firstChild;
    
    expect(badge).toHaveClass("bg-red-600");
    const text = screen.getByText("cancelled");
    expect(text).toHaveClass("text-red-500");
    expect(screen.getByAltText("doctor")).toHaveAttribute("src", "/assets/icons/cancelled.svg");
  });
});
