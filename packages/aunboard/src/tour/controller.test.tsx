import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTour } from "./controller";
import type { Tour } from "./types";

const tour: Tour = {
  id: "onboard",
  name: "Onboarding",
  steps: [
    { locator: { tag: "button", role: { role: "button", name: "Run" } }, label: "Run", description: "Runs it.", route: "/" },
    { locator: { tag: "button", role: { role: "button", name: "Settings" } }, label: "Settings", description: "Open settings.", route: "/settings" },
  ],
};

function mountRun() {
  const b = document.createElement("button");
  b.textContent = "Run";
  document.body.appendChild(b);
  return b;
}

function mountSettings() {
  const b = document.createElement("button");
  b.textContent = "Settings";
  document.body.appendChild(b);
  return b;
}

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  window.history.pushState({}, "", "/"); // pathname persists across tests in a file; reset it
});

describe("useTour", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useTour(tour, { persist: false }));
    expect(result.current.status).toBe("idle");
    expect(result.current.total).toBe(2);
  });

  it("start() resolves the first step to running once its element exists", async () => {
    mountRun();
    const { result } = renderHook(() => useTour(tour, { persist: false }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(result.current.index).toBe(0);
    expect(result.current.element?.tagName).toBe("BUTTON");
    expect(result.current.element?.textContent).toBe("Run");
  });

  it("next() navigates and waits for the next route's element", async () => {
    mountRun();
    const navigate = vi.fn((path: string) => {
      // simulate the new page mounting its element after navigation
      if (path === "/settings") setTimeout(() => mountSettings(), 5);
    });
    const { result } = renderHook(() => useTour(tour, { persist: false, navigate }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(navigate).toHaveBeenCalledWith("/settings");
    expect(result.current.index).toBe(1);
    expect(result.current.element?.textContent).toBe("Settings");
  });

  it("next() past the last step finishes", async () => {
    mountRun();
    mountSettings();
    const navigate = vi.fn();
    const { result } = renderHook(() => useTour(tour, { persist: false, navigate }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.status).toBe("running"));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.status).toBe("done"));
  });

  it("goes to not-found when the element never appears within the timeout", async () => {
    const { result } = renderHook(() => useTour(tour, { persist: false, navigate: vi.fn(), waitTimeout: 20 }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("not-found"));
    expect(result.current.element).toBeNull();
  });

  it("prev() steps back", async () => {
    mountRun();
    mountSettings();
    const { result } = renderHook(() => useTour(tour, { persist: false, navigate: vi.fn() }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.index).toBe(1));
    await waitFor(() => expect(result.current.status).toBe("running"));
    act(() => result.current.prev());
    await waitFor(() => expect(result.current.index).toBe(0));
  });

  it("writes progress as the tour advances when persist is on", async () => {
    mountRun();
    const { result } = renderHook(() => useTour(tour, { persist: true, navigate: vi.fn() }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("label-mode:tour:onboard")!)).toEqual({
        stepIndex: 0,
        completed: false,
      }),
    );
  });

  const revealTour: Tour = {
    id: "reveal", name: "Reveal",
    steps: [{
      reveal: [{ tag: "button", role: { role: "button", name: "Cash Flow" } }],
      locator: { tag: "img", role: { role: "img", name: "Graph" } },
      label: "Graph", description: "", route: "/",
    }],
  };

  it("clicks a reveal to surface an element behind a tab, then resolves it", async () => {
    const tab = document.createElement("button");
    tab.textContent = "Cash Flow";
    tab.addEventListener("click", () => {
      const img = document.createElement("img");
      img.setAttribute("alt", "Graph");
      document.body.appendChild(img); // tab "mounts" the panel content
    });
    document.body.appendChild(tab);

    const { result } = renderHook(() => useTour(revealTour, { persist: false, navigate: vi.fn(), waitTimeout: 500 }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(result.current.element?.tagName).toBe("IMG");
  });

  it("skips the reveal click when the target is already present (idempotent)", async () => {
    let clicks = 0;
    const tab = document.createElement("button");
    tab.textContent = "Cash Flow";
    tab.addEventListener("click", () => { clicks += 1; });
    document.body.appendChild(tab);
    const img = document.createElement("img");
    img.setAttribute("alt", "Graph");
    document.body.appendChild(img); // already visible

    const { result } = renderHook(() => useTour(revealTour, { persist: false, navigate: vi.fn(), waitTimeout: 500 }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(clicks).toBe(0);
  });

  it("falls back to not-found when a reveal can't surface the target", async () => {
    const tab = document.createElement("button");
    tab.textContent = "Cash Flow"; // exists, but clicking it mounts nothing
    document.body.appendChild(tab);
    const { result } = renderHook(() => useTour(revealTour, { persist: false, navigate: vi.fn(), waitTimeout: 30 }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("not-found"));
  });

  it("persists progress and resumes from the saved step", async () => {
    mountRun();
    mountSettings();
    localStorage.setItem(
      "label-mode:tour:onboard",
      JSON.stringify({ stepIndex: 1, completed: false }),
    );
    const { result } = renderHook(() => useTour(tour, { persist: true }));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(result.current.index).toBe(1);
  });
});
