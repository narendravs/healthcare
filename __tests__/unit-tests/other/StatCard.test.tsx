import { render, screen } from "@testing-library/react";
import StatCard from "@/components/StatCard";
import "@testing-library/jest-dom";

// Mock next/image to avoid optimization issues in JSDOM
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

describe("StatCard Unit Test", () => {
  const defaultProps = {
    count: 10,
    label: "Total Appointments",
    icon: "/assets/icons/appointments.svg",
  };

  it("renders count and label correctly", () => {
    render(<StatCard {...defaultProps} type="appointments" />);
    
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Total Appointments")).toBeInTheDocument();
  });

  it("renders the icon with correct alt text", () => {
    render(<StatCard {...defaultProps} type="appointments" />);
    
    const icon = screen.getByAltText("Total Appointments");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("src", "/assets/icons/appointments.svg");
  });

  it("applies the 'bg-appointments' class for appointments type", () => {
    const { container } = render(<StatCard {...defaultProps} type="appointments" />);
    const card = container.firstChild;
    
    expect(card).toHaveClass("stat-card");
    expect(card).toHaveClass("bg-appointments");
  });

  it("applies the 'bg-pending' class for pending type", () => {
    const { container } = render(<StatCard {...defaultProps} type="pending" />);
    const card = container.firstChild;
    
    expect(card).toHaveClass("bg-pending");
  });

  it("applies the 'bg-cancelled' class for cancelled type", () => {
    const { container } = render(<StatCard {...defaultProps} type="cancelled" />);
    const card = container.firstChild;
    
    expect(card).toHaveClass("bg-cancelled");
  });
});
