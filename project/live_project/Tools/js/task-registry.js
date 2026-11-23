(function () {
  const tasks = [
    Object.freeze({
      id: 'nback',
      name: window.HCCTNBackEngine.name,
      module: window.HCCTNBackEngine
    })
  ];

  window.HCCTTaskRegistry = Object.freeze(tasks);
})();
