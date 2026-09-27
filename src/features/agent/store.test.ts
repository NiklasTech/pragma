import { afterEach, describe, expect, it } from "vite-plus/test";
import { useAgentStore } from "./store";

describe("agent requestStop", () => {
  afterEach(() => {
    useAgentStore.setState({
      status: "idle",
      stopCallback: null,
      pendingApprovals: [],
      editReviews: [],
    });
  });

  it("invokes the registered stop callback", () => {
    let stopped = false;
    useAgentStore.getState().setStopCallback(() => {
      stopped = true;
    });

    useAgentStore.getState().requestStop();

    expect(stopped).toBe(true);
  });

  it("cancels the run even without a registered callback", () => {
    useAgentStore.setState({ status: "running", stopCallback: null });

    useAgentStore.getState().requestStop();

    expect(useAgentStore.getState().status).toBe("cancelled");
  });

  it("marks a steered run idle and still runs the callback", () => {
    let stopped = false;
    useAgentStore.getState().setStopCallback(() => {
      stopped = true;
    });
    useAgentStore.setState({ status: "running" });

    useAgentStore.getState().requestStop("steer");

    expect(useAgentStore.getState().status).toBe("idle");
    expect(stopped).toBe(true);
  });
});
