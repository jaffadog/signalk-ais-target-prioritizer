import { describe, it, before } from "node:test";
import assert from "node:assert";
import path from "node:path";

describe("signalk-ais-target-prioritizer", () => {
  let pluginModule;

  before(async () => {
    const pluginPath = path.resolve(process.cwd(), "plugin/index.cjs");
    pluginModule = await import(`file://${pluginPath}`);
  });

  it("loads as a valid SignalK plugin", () => {
    assert.ok(pluginModule, "Module loaded");
    console.log("Exports keys:", Object.keys(pluginModule)); // for debugging
  });

  it("initializes and returns a valid plugin object", () => {
    const mockApp = createMockApp();

    // This matches your build output
    const factory =
      pluginModule.default?.default || pluginModule.default || pluginModule;

    assert.strictEqual(
      typeof factory,
      "function",
      "Found plugin factory function",
    );

    const plugin = factory(mockApp);

    assert.ok(plugin, "Plugin instance created");
    assert.ok(plugin.id, "Has id");
    assert.ok(plugin.name, "Has name");
    assert.ok(plugin.schema, "Has schema");
    assert.strictEqual(typeof plugin.start, "function", "Has start()");
    assert.strictEqual(typeof plugin.stop, "function", "Has stop()");
  });

  it("starts and stops cleanly in registry test environment", () => {
    const mockApp = createMockApp();

    const factory =
      pluginModule.default?.default || pluginModule.default || pluginModule;
    const plugin = factory(mockApp);

    process.env.SIGNALK_REGISTRY_TEST = "1";

    assert.doesNotThrow(() => {
      plugin.start({}, () => {}); // options + restart callback
    }, "start() should not throw");

    assert.doesNotThrow(() => {
      plugin.stop();
    }, "stop() should not throw");
  });

  it("has a valid schema", () => {
    const mockApp = createMockApp();

    const factory =
      pluginModule.default?.default || pluginModule.default || pluginModule;
    const plugin = factory(mockApp);

    assert.ok(plugin.schema, "Schema exists");
    assert.strictEqual(typeof plugin.schema, "object");
  });
});

// Minimal SignalK mock
function createMockApp() {
  return {
    debug: () => {},
    error: () => {},
    selfContext:
      "vessels.urn:mrn:signalk:uuid:12345678-1234-1234-1234-123456789abc",
    getDataDirPath: () => "/tmp/signalk-test-data",
    subscriptionmanager: { subscribe: () => ({}) },
    handleMessage: () => {},
    setPluginStatus: () => {},
    setPluginError: () => {},
    getPath: () => null,
  };
}
