(function () {
  const modules = [
    window.HCCTNBackEngine,
    window.HCCTFlankerEngine,
    window.HCCTSwitchingEngine,
    window.HCCTSeriesEngine
  ];
  if (modules.some(module => !module)) {
    throw new Error('All task engines must be loaded before task-registry.');
  }

  const tasks = modules.map(module => Object.freeze({
    id: module.id,
    name: module.name,
    module
  }));

  window.HCCTTaskRegistry = Object.freeze(tasks);
})();
