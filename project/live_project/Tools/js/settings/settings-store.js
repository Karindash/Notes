(function () {
  const STORAGE_KEY = 'hcct-app-settings';
  const VERSION = 1;
  const DEFAULT_APPEARANCE = {theme: 'dark', textScale: 1, accent: '#8bd3c7'};
  const DEFAULT_TASK_ID = 'nback';
  const DEFAULT_LEVELS = {nback: 1, flanker: 1, switching: 1, series: 1};
  const taskDefinitions = {};
  const warnings = [];

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) {
      return Object.keys(value).reduce((copy, key) => {
        copy[key] = clone(value[key]);
        return copy;
      }, {});
    }
    return value;
  }

  function fail(message) {
    throw new Error(message);
  }

  function readStored() {
    let raw;
    try {
      raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      warnings.push('Saved settings could not be read; defaults are active.');
      return null;
    }
    if (raw == null) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!isObject(parsed) || parsed.version !== VERSION) {
        warnings.push('Saved settings have an unsupported format; defaults are active.');
        return null;
      }
      return parsed;
    } catch (error) {
      warnings.push('Saved settings are invalid JSON; defaults are active.');
      return null;
    }
  }

  function readAppearance(value) {
    if (!isObject(value)) return clone(DEFAULT_APPEARANCE);
    const appearance = {...DEFAULT_APPEARANCE, ...value};
    if (appearance.theme !== 'dark' && appearance.theme !== 'light') {
      appearance.theme = DEFAULT_APPEARANCE.theme;
      warnings.push('Invalid theme setting was reset to dark.');
    }
    if (!Number.isFinite(appearance.textScale) || appearance.textScale < 0.8 || appearance.textScale > 1.4) {
      appearance.textScale = DEFAULT_APPEARANCE.textScale;
      warnings.push('Invalid text scale was reset to 1.');
    }
    if (typeof appearance.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(appearance.accent)) {
      appearance.accent = DEFAULT_APPEARANCE.accent;
      warnings.push('Invalid accent color was reset to the default.');
    }
    return {theme: appearance.theme, textScale: appearance.textScale, accent: appearance.accent};
  }

  const stored = readStored();
  let state = {
    version: VERSION,
    appearance: readAppearance(stored && stored.appearance),
    defaultTaskId: stored && typeof stored.defaultTaskId === 'string'
      ? stored.defaultTaskId : DEFAULT_TASK_ID,
    defaultLevelByTask: stored && isObject(stored.defaultLevelByTask)
      ? {...DEFAULT_LEVELS, ...stored.defaultLevelByTask} : {...DEFAULT_LEVELS},
    tasks: stored && isObject(stored.tasks) ? stored.tasks : {}
  };

  function mergeConfig(defaults, override, path) {
    if (override === undefined) return clone(defaults);
    if (Array.isArray(defaults)) {
      if (!Array.isArray(override) || override.length !== defaults.length) {
        fail(path + ' must keep its configured array length.');
      }
      return defaults.map((value, index) => mergeConfig(value, override[index], path + '[' + index + ']'));
    }
    if (isObject(defaults)) {
      if (!isObject(override)) fail(path + ' must be an object.');
      Object.keys(override).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
          fail(path + ' has an unknown setting: ' + key + '.');
        }
      });
      return Object.keys(defaults).reduce((result, key) => {
        if (key === 'id' && override[key] !== undefined && override[key] !== defaults[key]) {
          fail(path + '.' + key + ' is fixed by the task contract.');
        }
        result[key] = mergeConfig(defaults[key], override[key], path + '.' + key);
        return result;
      }, {});
    }
    if (defaults === null) {
      if (override === null) return null;
      if (typeof override !== 'number' || !Number.isFinite(override) || override < 0) {
        fail(path + ' must be null or a non-negative number.');
      }
      return override;
    }
    if (typeof override !== typeof defaults) fail(path + ' has the wrong value type.');
    if (typeof override === 'number' && (!Number.isFinite(override) || override < 0)) {
      fail(path + ' must be a non-negative finite number.');
    }
    if (typeof override === 'string' && (override.length > 160 || /[<>&"'`\u0000-\u001f]/.test(override))) {
      fail(path + ' contains unsupported text.');
    }
    return override;
  }

  function validateTask(id, value) {
    const definition = taskDefinitions[id];
    if (!definition) fail('Unknown task configuration: ' + id + '.');
    const result = mergeConfig(definition.defaults, value, 'tasks.' + id);
    const validation = definition.validate(result);
    if (validation !== true) fail('Invalid ' + id + ' configuration: ' + validation);
    return result;
  }

  function registerTaskConfig(id, defaults, validate) {
    if (taskDefinitions[id]) fail('Task configuration is already registered: ' + id + '.');
    const definition = {defaults: clone(defaults), validate};
    taskDefinitions[id] = definition;
    try {
      definition.current = validateTask(id, state.tasks[id]);
    } catch (error) {
      definition.current = clone(definition.defaults);
      warnings.push(error.message + ' Defaults are active.');
    }
    return definition.current;
  }

  function makeConfiguration() {
    const levels = {};
    const tasks = {};
    Object.keys(taskDefinitions).forEach(id => {
      const definition = taskDefinitions[id];
      tasks[id] = clone(definition.current);
      const levelIds = definition.current.LEVELS.map(level => level.id);
      levels[id] = levelIds.includes(state.defaultLevelByTask[id])
        ? state.defaultLevelByTask[id] : levelIds[0];
    });
    const taskIds = Object.keys(taskDefinitions);
    return {
      version: VERSION,
      appearance: clone(state.appearance),
      defaultTaskId: taskIds.includes(state.defaultTaskId) ? state.defaultTaskId : taskIds[0],
      defaultLevelByTask: levels,
      tasks
    };
  }

  function validateConfiguration(candidate) {
    if (!isObject(candidate)) fail('Configuration must be a JSON object.');
    const allowedKeys = ['version', 'appearance', 'defaultTaskId', 'defaultLevelByTask', 'tasks'];
    Object.keys(candidate).forEach(key => {
      if (!allowedKeys.includes(key)) fail('Unknown top-level setting: ' + key + '.');
    });
    if (candidate.version !== VERSION) fail('Unsupported settings version.');
    const taskIds = Object.keys(taskDefinitions);
    if (!taskIds.includes(candidate.defaultTaskId)) fail('Choose a registered default task.');
    if (!isObject(candidate.tasks)) fail('Task configurations must be an object.');
    if (!isObject(candidate.defaultLevelByTask)) fail('Default levels must be an object.');
    taskIds.forEach(id => {
      if (!Object.prototype.hasOwnProperty.call(candidate.tasks, id)) {
        fail('Missing configuration for task ' + id + '.');
      }
      if (!Object.prototype.hasOwnProperty.call(candidate.defaultLevelByTask, id)) {
        fail('Missing default level for task ' + id + '.');
      }
    });
    Object.keys(candidate.tasks).forEach(id => {
      if (!taskIds.includes(id)) fail('Unknown task configuration: ' + id + '.');
    });
    Object.keys(candidate.defaultLevelByTask).forEach(id => {
      if (!taskIds.includes(id)) fail('Unknown default-level task: ' + id + '.');
    });

    const tasks = {};
    taskIds.forEach(id => { tasks[id] = validateTask(id, candidate.tasks[id]); });
    const defaultLevelByTask = {};
    taskIds.forEach(id => {
      const levelId = candidate.defaultLevelByTask[id];
      if (!Number.isInteger(levelId) || !tasks[id].LEVELS.some(level => level.id === levelId)) {
        fail('Choose a valid default level for ' + id + '.');
      }
      defaultLevelByTask[id] = levelId;
    });
    const appearance = readAppearanceForImport(candidate.appearance);
    return {
      version: VERSION,
      appearance,
      defaultTaskId: candidate.defaultTaskId,
      defaultLevelByTask,
      tasks
    };
  }

  function readAppearanceForImport(value) {
    if (!isObject(value)) fail('Appearance settings must be an object.');
    const keys = ['theme', 'textScale', 'accent'];
    Object.keys(value).forEach(key => {
      if (!keys.includes(key)) fail('Unknown appearance setting: ' + key + '.');
    });
    if (keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
      fail('Appearance must include theme, textScale, and accent.');
    }
    if (value.theme !== 'dark' && value.theme !== 'light') fail('Theme must be dark or light.');
    if (!Number.isFinite(value.textScale) || value.textScale < 0.8 || value.textScale > 1.4) {
      fail('Text scale must be between 0.8 and 1.4.');
    }
    if (typeof value.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.accent)) {
      fail('Accent must be a six-digit hex color.');
    }
    return {theme: value.theme, textScale: value.textScale, accent: value.accent};
  }

  function saveConfiguration(candidate) {
    let configuration;
    try {
      configuration = validateConfiguration(candidate);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configuration));
    } catch (error) {
      return {ok: false, error: error.message};
    }
    state = {
      ...configuration,
      tasks: configuration.tasks
    };
    Object.keys(taskDefinitions).forEach(id => {
      taskDefinitions[id].current = clone(configuration.tasks[id]);
    });
    return {ok: true, configuration};
  }

  function resetConfiguration() {
    return saveConfiguration(makeConfigurationDefaults());
  }

  function makeConfigurationDefaults() {
    const tasks = {};
    const defaultLevelByTask = {};
    Object.keys(taskDefinitions).forEach(id => {
      const config = taskDefinitions[id].defaults;
      tasks[id] = clone(config);
      defaultLevelByTask[id] = config.LEVELS[0].id;
    });
    return {
      version: VERSION,
      appearance: clone(DEFAULT_APPEARANCE),
      defaultTaskId: Object.prototype.hasOwnProperty.call(taskDefinitions, DEFAULT_TASK_ID)
        ? DEFAULT_TASK_ID : Object.keys(taskDefinitions)[0],
      defaultLevelByTask,
      tasks
    };
  }

  function getDefaultTaskId(registry) {
    const ids = registry.map(task => task.id);
    return ids.includes(state.defaultTaskId) ? state.defaultTaskId : ids[0];
  }

  function getDefaultLevel(taskId, levels) {
    const value = state.defaultLevelByTask[taskId];
    return levels.some(level => level.id === value) ? value : levels[0].id;
  }

  function applyAppearance() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const root = document.documentElement;
    root.dataset.theme = state.appearance.theme;
    root.style.setProperty('--text-scale', state.appearance.textScale);
    if (state.appearance.theme === 'light' && state.appearance.accent === DEFAULT_APPEARANCE.accent) {
      root.style.removeProperty('--accent');
    } else {
      root.style.setProperty('--accent', state.appearance.accent);
    }
  }

  applyAppearance();

  window.HCCTSettings = Object.freeze({
    applyTaskConfig: registerTaskConfig,
    makeConfiguration,
    validateConfiguration,
    saveConfiguration,
    resetConfiguration,
    getDefaultTaskId,
    getDefaultLevel,
    getWarnings: () => warnings.slice(),
    applyAppearance
  });
})();
