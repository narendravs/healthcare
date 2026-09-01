import { render, screen } from "@testing-library/react";
import SubmitButton from "@/components/SubmitButton";
import StatCard from "@/components/StatCard";
import "@testing-library/jest-dom";

describe("Shared UI Components Unit Tests", () => {
  describe("SubmitButton", () => {
    it("renders loading state correctly", () => {
      render(<SubmitButton isLoading={true}>Submit</SubmitButton>);
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByAltText("Loading...")).toHaveClass("animate-spin");
    });

    it("renders children when not loading", () => {
      render(<SubmitButton isLoading={false}>Submit Now</SubmitButton>);
      expect(screen.getByText("Submit Now")).toBeInTheDocument();
      expect(screen.getByRole("button")).not.toBeDisabled();
    });
  });

  describe("StatCard", () => {
    it("renders count and label with correct icon", () => {
      render(
        <StatCard 
          type="appointments" 
          count={25} 
          label="Total Appointments" 
          icon="/assets/icons/appointments.svg" 
        />
      );
      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("Total Appointments")).toBeInTheDocument();
      expect(screen.getByAltText("Total Appointments")).toHaveAttribute("src", "/assets/icons/appointments.svg");
    });
  });
});
