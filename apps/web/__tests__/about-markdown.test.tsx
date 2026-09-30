import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import { AboutMarkdown } from "@/components/about/about-markdown";

describe("AboutMarkdown", () => {
  it("autolinks a bare email into a mailto link (GFM)", () => {
    render(<AboutMarkdown>{"Ozvite sa nám na kontakt@nasakuchyna.sk."}</AboutMarkdown>);

    const link = screen.getByRole("link", { name: "kontakt@nasakuchyna.sk" });

    expect(link).toHaveAttribute("href", "mailto:kontakt@nasakuchyna.sk");
    // The trailing sentence period must stay outside the link.
    expect(link.textContent).toBe("kontakt@nasakuchyna.sk");
  });

  it("autolinks a bare URL", () => {
    render(<AboutMarkdown>{"Viac na https://nasakuchyna.sk dnes."}</AboutMarkdown>);

    expect(screen.getByRole("link", { name: "https://nasakuchyna.sk" })).toHaveAttribute(
      "href",
      "https://nasakuchyna.sk"
    );
  });

  it("still renders an explicit Markdown link", () => {
    render(<AboutMarkdown>{"[Napíšte nám](mailto:hi@example.com)"}</AboutMarkdown>);

    expect(screen.getByRole("link", { name: "Napíšte nám" })).toHaveAttribute(
      "href",
      "mailto:hi@example.com"
    );
  });
});
