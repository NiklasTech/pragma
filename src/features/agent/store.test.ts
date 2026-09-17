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
});
