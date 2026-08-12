import { render } from "@testing-library/react";
import ClearAccessKey from "@/components/ClearAccessKey";

describe("ClearAccessKey Unit Test", () => {
  beforeEach(() => {
    // Mocking localStorage.removeItem
    Object.defineProperty(window, 'localStorage', {
      value: { removeItem: jest.fn() },
      writable: true
    });
  });

  it("calls localStorage.removeItem with 'accessKey' on mount", () => {
    render(<ClearAccessKey />);
    expect(localStorage.removeItem).toHaveBeenCalledWith("accessKey");
    expect(localStorage.removeItem).toHaveBeenCalledTimes(1);
  });
});
