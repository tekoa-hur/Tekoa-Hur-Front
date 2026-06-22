import { render, screen } from "@testing-library/react";

function Hola() {
  return <h1>Hola Tekoa</h1>;
}

describe("Smoke Test", () => {
  it("renderiza correctamente", () => {
    render(<Hola />);

    expect(
      screen.getByText("Hola Tekoa")
    ).toBeInTheDocument();
  });
});