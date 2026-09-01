import { render, screen } from "@testing-library/react";
import Home from "@/app/page";
import "@testing-library/jest-dom";

// Mocking the child component to isolate the Page component's logic
jest.mock("@/components/home/HomeContent", () => ({
  __esModule: true,
  default: () => <div data-testid="home-content">Home Content</div>,
}));

// Mocking the loader used in Suspense
jest.mock("@/components/fallback/FallBackLoade", () => ({
  __esModule: true,
  default: () => <div data-testid="loader">Loading...</div>,
}));

describe("Home Page Unit Test", () => {
  it("renders HomeContent successfully", async () => {
    render(<Home />);
    const content = await screen.findByTestId("home-content");
    expect(content).toBeInTheDocument();
  });
});
