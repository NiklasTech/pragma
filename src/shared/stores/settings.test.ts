import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useSettingsStore } from "./settings";

describe("settings extensions namespace", () => {
  beforeEach(() => {
    useSettingsStore.setState({ extensions: {} });
  });

  it("defaults to an empty record", () => {
    expect(useSettingsStore.getState().extensions).toEqual({});
  });

  it("toggles enabled without dropping stored settings", () => {
    const store = useSettingsStore.getState();
    store.setExtensionSettings("ext-a", { key: "value" });
    store.setExtensionEnabled("ext-a", false);

    expect(useSettingsStore.getState().extensions["ext-a"]).toEqual({
      enabled: false,
      settings: { key: "value" },
    });
  });

  it("writes settings without dropping the enabled flag", () => {
    const store = useSettingsStore.getState();
    store.setExtensionEnabled("ext-a", false);
    store.setExtensionSettings("ext-a", 42);

    expect(useSettingsStore.getState().extensions["ext-a"]).toEqual({
      enabled: false,
      settings: 42,
    });
  });

  it("merges extensions on importSettings", () => {
    const store = useSettingsStore.getState();
    store.setExtensionEnabled("ext-a", true);
    store.importSettings({
      extensions: { "ext-b": { enabled: false, settings: { imported: true } } },
    });

    const extensions = useSettingsStore.getState().extensions;
    expect(extensions["ext-a"]?.enabled).toBe(true);
    expect(extensions["ext-b"]).toEqual({ enabled: false, settings: { imported: true } });
  });
});
