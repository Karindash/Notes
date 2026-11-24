(function () {
  const tasks = [
    Object.freeze({
      id: 'nback',
      name: window.HCCTNBackEngine.name,
      module: window.HCCTNBackEngine
    }),
    Object.freeze({
      id: 'flanker',
      name: window.HCCTFlankerEngine.name,
      module: window.HCCTFlankerEngine
    }),
    Object.freeze({
      id: 'switching',
      name: window.HCCTSwitchingEngine.name,
      module: window.HCCTSwitchingEngine
    }),
    Object.freeze({
      id: 'series',
      name: window.HCCTSeriesEngine.name,
      module: window.HCCTSeriesEngine
    })
  ];

  window.HCCTTaskRegistry = Object.freeze(tasks);
})();
