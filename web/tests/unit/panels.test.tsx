import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveCounter, StatusIsland, md } from "@/components/console/Panels";

describe("answer renderer", () => {
  it("renders bold, bullets and citation chips", () => {
    const blocks = md("**Affected:** CUS-101 [orders.list_shipment_orders]\n- TKT-9001 open");
    expect(blocks[0].html).toContain("<b class='text-text'>Affected:</b>");
    expect(blocks[0].html).toContain("<span class='cite'>orders.list_shipment_orders</span>");
    expect(blocks[1]).toMatchObject({ li: true, html: "TKT-9001 open" });
  });

  it("escapes HTML from the model (no script injection)", () => {
    const [b] = md('<img src=x onerror="alert(1)"><script>alert(1)</script>');
    expect(b.html).not.toContain("<script>");
    expect(b.html).not.toContain("<img");
    expect(b.html).toContain("&lt;script&gt;");
  });

  it("drops markdown table separators", () => {
    expect(md("| a | b |\n|---|---|\n| 1 | 2 |").map((x) => x.html)).toEqual(["a  ·  b", "1  ·  2"]);
  });
});

describe("components", () => {
  it("status island shows the current status", () => {
    render(<StatusIsland phase="building" status="Synapse is growing orders…" />);
    expect(screen.getByText("Synapse is growing orders…")).toBeTruthy();
  });

  it("live counter shows live / total", () => {
    render(<LiveCounter live={0} total={39} />);
    expect(screen.getByText("/ 39")).toBeTruthy();
  });
});
