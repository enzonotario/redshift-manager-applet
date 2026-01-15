const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Slider = imports.ui.slider;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const ScrollDirection = Clutter.ScrollDirection;
const TEMP_STEP = 50;
const BRIGHTNESS_STEP = 5;

class RedshiftApplet extends Applet.TextIconApplet {
        constructor(metadata, orientation, panel_height, instance_id) {
            super(orientation, panel_height, instance_id);
            this.currentTemp = 6500;
            this.currentBrightness = 100;
            this.isRedshiftActive = false;
            this.presets = [];
            this.panelOrientation = null;
            this._updatingPresets = false;
            this._applyingPreset = false;
            this._lastPresetApplyTime = 0;
            this.metadata = metadata;
            this.panelOrientation = orientation;
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bind("enabled", "enabled", this.onEnabledChanged.bind(this));
            this.settings.bind("auto-update", "autoUpdate");
            this.settings.bind("update-interval", "updateIntervalSeconds", this.onUpdateIntervalChanged.bind(this));
            this.settings.bind("smooth-transition", "smoothTransition");
            this.settings.bind("day-temp", "dayTemp", this.onTemperatureChanged.bind(this));
            this.settings.bind("day-brightness", "dayBrightness");
            this.settings.bind("enable-night", "enableNight");
            this.settings.bind("manual-night-time", "manualNightTime", this.onNightTimeSettingsChanged.bind(this));
            this.settings.bind("night-time-start", "nightTimeStart", this.onNightTimeSettingsChanged.bind(this));
            this.settings.bind("night-time-end", "nightTimeEnd", this.onNightTimeSettingsChanged.bind(this));
            this.settings.bind("location-latitude", "locationLatitude", this.onLocationChanged.bind(this));
            this.settings.bind("location-longitude", "locationLongitude", this.onLocationChanged.bind(this));
            this.settings.bind("night-temp", "nightTemp");
            this.settings.bind("night-brightness", "nightBrightness");
            this.settings.bind("custom-icon-path", "customIconPath", this.onIconSettingsChanged.bind(this));
            this.settings.bind("show-label", "showLabel", this.onLabelSettingsChanged.bind(this));
            this.settings.bind("key-toggle", "keyToggle", this.onShortcutChanged.bind(this));
            this.settings.bind("key-temp-up", "keyTempUp", this.onShortcutChanged.bind(this));
            this.settings.bind("key-temp-down", "keyTempDown", this.onShortcutChanged.bind(this));
            this.settings.bind("key-brightness-up", "keyBrightnessUp", this.onShortcutChanged.bind(this));
            this.settings.bind("key-brightness-down", "keyBrightnessDown", this.onShortcutChanged.bind(this));

            // Monitor presets changes from Settings custom widget
            this.settings.connect("changed::presets", () => {
                this.loadPresetsFromSettings();
            });

            imports.mainloop.timeout_add(2000, () => {
                this.loadConfigurationFromFile();
                // Load presets from settings after config file is loaded
                this.loadPresetsFromSettings();
                return false;
            });
            this.buildMenu(orientation);
            imports.mainloop.timeout_add(100, () => {
                try {
                    this.updateIcon();
                    this.updateLabel();
                }
                catch (e) {
                    global.log(`Error initializing applet: ${e}`);
                }
                return false;
            });
            imports.mainloop.timeout_add(1000, () => {
                this.startUpdateLoop();
                return false;
            });
            imports.mainloop.timeout_add(1500, () => {
                this.setupKeybindings();
                this.setupPresetKeybindings();
                this.autoDetectLocation();
                return false;
            });
            imports.mainloop.timeout_add(2000, () => {
                try {
                    const enabled = this.enabled;
                    global.log(`Redshift auto-restore: enabled=${enabled}`);
                    if (enabled) {
                        if (this.toggleSwitch) {
                            this.toggleSwitch.setToggleState(true);
                        }
                        global.log(`Applying Redshift on startup with temp=${this.dayTemp}`);
                        this.applyRedshift();
                        this.update();
                    }
                }
                catch (e) {
                    global.log(`Error restoring Redshift state: ${e}`);
                }
                return false;
            });
        }
        buildMenu(orientation) {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);
            let headerItem = new PopupMenu.PopupMenuItem("Redshift Manager Applet", { reactive: false });
            this.menu.addMenuItem(headerItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.statusLabel = new PopupMenu.PopupMenuItem("Status: Inactive", { reactive: false });
            this.menu.addMenuItem(this.statusLabel);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let toggleItem = new PopupMenu.PopupSwitchMenuItem("Enable Redshift", false);
            toggleItem.connect('toggled', (item, state) => {
                this.enabled = state;
                this.applyRedshift();
                this.saveConfigurationToFile();
            });
            this.toggleSwitch = toggleItem;
            this.menu.addMenuItem(toggleItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let dayHeaderItem = new PopupMenu.PopupMenuItem("Day Settings", { reactive: false });
            this.menu.addMenuItem(dayHeaderItem);
            this.addSliderItem("Temperature", 1000, 10000, this.dayTemp || 6500, 50, (value) => {
                this.dayTemp = Math.round(value);
                this.currentTemp = Math.round(value);
                this.applyRedshift();
                this.saveConfigurationToFile();
            });
            this.addSliderItem("Brightness", 10, 100, this.dayBrightness || 100, 1, (value) => {
                this.dayBrightness = Math.round(value);
                this.currentBrightness = Math.round(value);
                this.applyRedshift();
                this.saveConfigurationToFile();
            });
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let nightHeaderItem = new PopupMenu.PopupMenuItem("Night Settings", { reactive: false });
            this.menu.addMenuItem(nightHeaderItem);
            this.addSliderItem("Temperature", 1000, 10000, this.nightTemp || 3500, 50, (value) => {
                this.nightTemp = Math.round(value);
                this.applyRedshift();
                this.saveConfigurationToFile();
            });
            this.addSliderItem("Brightness", 10, 100, this.nightBrightness || 90, 1, (value) => {
                this.nightBrightness = Math.round(value);
                this.applyRedshift();
                this.saveConfigurationToFile();
            });

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let presetsHeader = new PopupMenu.PopupMenuItem("Presets", { reactive: false });
            this.menu.addMenuItem(presetsHeader);
            this.buildPresetsMenu();
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let configHeaderItem = new PopupMenu.PopupMenuItem("Configuration", { reactive: false });
            this.menu.addMenuItem(configHeaderItem);
            let exportItem = new PopupMenu.PopupMenuItem("Export Configuration");
            exportItem.connect('activate', () => {
                this.exportConfiguration();
            });
            this.menu.addMenuItem(exportItem);
            let importItem = new PopupMenu.PopupMenuItem("Import Configuration");
            importItem.connect('activate', () => {
                this.importConfiguration();
            });
            this.menu.addMenuItem(importItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let settingsItem = new PopupMenu.PopupMenuItem("Settings");
            settingsItem.connect('activate', () => {
                Util.spawnCommandLine(`cinnamon-settings applets ${this.metadata.uuid}`);
            });
            this.menu.addMenuItem(settingsItem);
            let resetItem = new PopupMenu.PopupMenuItem("Reset");
            resetItem.connect('activate', () => {
                this.resetRedshift();
            });
            this.menu.addMenuItem(resetItem);
        }

        buildPresetsMenu() {
            let createPresetItem = new PopupMenu.PopupMenuItem(`Save Current as Preset...`);
            createPresetItem.connect('activate', () => {
                this.createPreset();
            });
            this.menu.addMenuItem(createPresetItem);

            if (this.presets.length > 0) {
                this.presets.forEach((preset, index) => {
                    const presetLabel = `${preset.name}`;
                    let submenu = new PopupMenu.PopupSubMenuMenuItem(presetLabel);

                    let applyItem = new PopupMenu.PopupMenuItem("Apply");
                    applyItem.connect('activate', () => {
                        this.applyPreset(index);
                    });
                    submenu.menu.addMenuItem(applyItem);

                    let shortcutItem = new PopupMenu.PopupMenuItem(preset.shortcut ? `Change Shortcut (${preset.shortcut})` : "Set Shortcut");
                    shortcutItem.connect('activate', () => {
                        this.setPresetShortcut(index);
                    });
                    submenu.menu.addMenuItem(shortcutItem);
                    submenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                    let deleteItem = new PopupMenu.PopupMenuItem("Delete");
                    deleteItem.connect('activate', () => {
                        this.deletePreset(index);
                    });
                    submenu.menu.addMenuItem(deleteItem);
                    this.menu.addMenuItem(submenu);
                });
            }
            else {
                let noPresetsItem = new PopupMenu.PopupMenuItem("No presets saved", { reactive: false });
                this.menu.addMenuItem(noPresetsItem);
            }
        }

        createPreset() {
            Util.spawnCommandLineAsyncIO(`zenity --entry --title="Create Preset" --text="Enter preset name:" --entry-text="Preset ${this.presets.length + 1}"`, (stdout) => {
                const name = stdout.trim();
                if (!name)
                    return;
                const preset = {
                    name: name,
                    shortcut: "",
                    dayTemp: this.dayTemp || 6500,
                    dayBrightness: this.dayBrightness || 100,
                    nightTemp: this.nightTemp || 3500,
                    nightBrightness: this.nightBrightness || 90
                };
                this.presets.push(preset);
                this.saveConfigurationToFile();
                this.setupPresetKeybindings();

                imports.mainloop.timeout_add(200, () => {
                    this.rebuildMenu();
                    return false;
                });
                global.log(`Redshift: Created preset: ${name}`);
            }, (stderr) => {});
        }

        applyPreset(index) {
            if (index < 0 || index >= this.presets.length)
                return;

            // Debouncing: prevent multiple rapid calls
            const now = Date.now();
            if (this._applyingPreset || (now - this._lastPresetApplyTime) < 300) {
                global.log(`Redshift: Ignoring rapid preset application (debouncing)`);
                return;
            }

            this._applyingPreset = true;
            this._lastPresetApplyTime = now;

            try {
                const preset = this.presets[index];

                this.dayTemp = preset.dayTemp;
                this.dayBrightness = preset.dayBrightness;
                this.nightTemp = preset.nightTemp;
                this.nightBrightness = preset.nightBrightness;

                if (!this.isNightTime()) {
                    this.currentTemp = preset.dayTemp;
                    this.currentBrightness = preset.dayBrightness;
                }
                this.applyRedshift();
                this.saveConfigurationToFile();
                global.log(`Redshift: Applied preset: ${preset.name}`);
            } finally {
                // Reset flag after a short delay
                imports.mainloop.timeout_add(350, () => {
                    this._applyingPreset = false;
                    return false;
                });
            }
        }

        setPresetShortcut(index) {
            if (index < 0 || index >= this.presets.length)
                return;
            const preset = this.presets[index];
            const currentShortcut = preset.shortcut || "";

            Util.spawnCommandLineAsyncIO(`zenity --entry --title="Set Preset Shortcut" --text="Enter keyboard shortcut for '${preset.name}':\n(Leave empty to remove shortcut)\n\nCurrent: ${currentShortcut || 'None'}" --entry-text="${currentShortcut}"`, (stdout) => {
                const shortcut = stdout.trim();

                if (preset.shortcut) {
                    try {
                        Main.keybindingManager.removeHotKey(`preset-${index}`);
                    }
                    catch (e) {}
                }

                preset.shortcut = shortcut;

                if (shortcut) {
                    Main.keybindingManager.addHotKey(`preset-${index}`, shortcut, () => {
                        this.applyPreset(index);
                    });
                }
                this.saveConfigurationToFile();
                this.setupPresetKeybindings();

                imports.mainloop.timeout_add(200, () => {
                    this.rebuildMenu();
                    return false;
                });
                global.log(`Redshift: Set shortcut for preset '${preset.name}': ${shortcut || 'removed'}`);
            }, (stderr) => {});
        }

        deletePreset(index) {
            if (index < 0 || index >= this.presets.length)
                return;
            const presetName = this.presets[index].name;

            try {
                Main.keybindingManager.removeHotKey(`preset-${index}`);
            }
            catch (e) {}

            Util.spawnCommandLineAsyncIO(`zenity --question --title="Delete Preset" --text="Delete preset '${presetName}'?"`, () => {
                this.presets.splice(index, 1);
                this.setupPresetKeybindings();
                this.saveConfigurationToFile();

                imports.mainloop.timeout_add(200, () => {
                    this.rebuildMenu();
                    return false;
                });
                global.log(`Redshift: Deleted preset: ${presetName}`);
            }, () => {});
        }

        setupPresetKeybindings() {
            for (let i = 0; i < 20; i++) {
                try {
                    Main.keybindingManager.removeHotKey(`preset-${i}`);
                }
                catch (e) {}
            }

            this.presets.forEach((preset, index) => {
                if (preset.shortcut && preset.shortcut.trim() !== "") {
                    try {
                        Main.keybindingManager.addHotKey(`preset-${index}`, preset.shortcut, () => {
                            this.applyPreset(index);
                        });
                    }
                    catch (e) {
                        global.logError(`Redshift: Error registering shortcut for preset '${preset.name}': ${e}`);
                    }
                }
            });
        }

        rebuildMenu() {
            try {
                if (this.menu && this.menu.isOpen) {
                    this.menu.close();
                }
            }
            catch (e) {}

            imports.mainloop.timeout_add(100, () => {
                try {
                    this.buildMenu(this.panelOrientation);
                }
                catch (e) {
                    global.logError(`Redshift: Error rebuilding menu: ${e}`);
                }
                return false;
            });
        }

        getConfigFilePath() {
            const homeDir = GLib.get_home_dir();
            const configDir = `${homeDir}/.config/redshift-manager-applet`;
            const configFile = `${configDir}/config.json`;
            return configFile;
        }

        ensureConfigDirectory() {
            const homeDir = GLib.get_home_dir();
            const configDir = `${homeDir}/.config/redshift-manager-applet`;
            const dir = Gio.File.new_for_path(configDir);
            try {
                if (!dir.query_exists(null)) {
                    dir.make_directory_with_parents(null);
                    global.log(`Redshift: Created config directory: ${configDir}`);
                }
            }
            catch (e) {
                global.logError(`Redshift: Error creating config directory: ${e}`);
            }
        }

        exportConfiguration() {
            try {
                const config = {
                    enabled: this.enabled || false,
                    "auto-update": this.autoUpdate !== undefined ? this.autoUpdate : true,
                    "update-interval": this.updateIntervalSeconds || 5,
                    "smooth-transition": this.smoothTransition !== undefined ? this.smoothTransition : true,
                    "day-temp": this.dayTemp || 6500,
                    "day-brightness": this.dayBrightness || 100,
                    "enable-night": this.enableNight !== undefined ? this.enableNight : true,
                    "manual-night-time": this.manualNightTime || false,
                    "night-time-start": this.nightTimeStart || { h: 20, m: 0, s: 0 },
                    "night-time-end": this.nightTimeEnd || { h: 6, m: 0, s: 0 },
                    "location-latitude": this.locationLatitude || "0",
                    "location-longitude": this.locationLongitude || "0",
                    "night-temp": this.nightTemp || 3500,
                    "night-brightness": this.nightBrightness || 90,
                    "key-toggle": this.keyToggle || "",
                    "key-temp-up": this.keyTempUp || "",
                    "key-temp-down": this.keyTempDown || "",
                    "key-brightness-up": this.keyBrightnessUp || "",
                    "key-brightness-down": this.keyBrightnessDown || "",
                    "presets": this.presets || [],
                    exportDate: new Date().toISOString(),
                    version: this.metadata.version || "0.0.1"
                };
                const jsonString = JSON.stringify(config, null, 2);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                const filename = `redshift-manager-applet-config-${timestamp}.json`;
                const downloadsDir = `${GLib.get_home_dir()}/Downloads`;
                const downloadsDirFile = Gio.File.new_for_path(downloadsDir);
                if (!downloadsDirFile.query_exists(null)) {
                    downloadsDirFile.make_directory_with_parents(null);
                }
                const filePath = `${downloadsDir}/${filename}`;
                const file = Gio.File.new_for_path(filePath);
                const fileStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                const dataStream = new Gio.DataOutputStream({ base_stream: fileStream });
                dataStream.put_string(jsonString, null);
                dataStream.close(null);
                global.log(`Redshift: Configuration exported to ${filePath}`);
                Util.spawnCommandLine(`notify-send "Redshift Manager Applet" "Configuration exported to Downloads/${filename}"`);
            }
            catch (e) {
                global.logError(`Redshift: Error exporting configuration: ${e}`);
                Util.spawnCommandLine(`notify-send "Redshift Manager Applet" "Error exporting configuration: ${e}" -u critical`);
            }
        }

        importConfiguration() {
            try {
                Util.spawnCommandLineAsyncIO(`zenity --file-selection --title="Import Redshift Configuration" --file-filter="JSON files (*.json) | *.json"`, (stdout) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
                    const filePath = stdout.trim();
                    if (!filePath)
                        return;
                    try {
                        const file = Gio.File.new_for_path(filePath);
                        const [success, contents] = file.load_contents(null);
                        if (!success) {
                            throw new Error("Failed to read file");
                        }
                        const decoder = new TextDecoder('utf-8');
                        const jsonString = decoder.decode(contents);
                        const config = JSON.parse(jsonString);

                        let configValues = {};
                        if (config["day-temp"] && typeof config["day-temp"] === "object" && config["day-temp"].value !== undefined) {
                            configValues["enabled"] = (_a = config.enabled) === null || _a === void 0 ? void 0 : _a.value;
                            configValues["auto-update"] = (_b = config["auto-update"]) === null || _b === void 0 ? void 0 : _b.value;
                            configValues["update-interval"] = (_c = config["update-interval"]) === null || _c === void 0 ? void 0 : _c.value;
                            configValues["smooth-transition"] = (_d = config["smooth-transition"]) === null || _d === void 0 ? void 0 : _d.value;
                            configValues["day-temp"] = (_e = config["day-temp"]) === null || _e === void 0 ? void 0 : _e.value;
                            configValues["day-brightness"] = (_f = config["day-brightness"]) === null || _f === void 0 ? void 0 : _f.value;
                            configValues["enable-night"] = (_g = config["enable-night"]) === null || _g === void 0 ? void 0 : _g.value;
                            configValues["manual-night-time"] = (_h = config["manual-night-time"]) === null || _h === void 0 ? void 0 : _h.value;
                            configValues["night-time-start"] = (_j = config["night-time-start"]) === null || _j === void 0 ? void 0 : _j.value;
                            configValues["night-time-end"] = (_k = config["night-time-end"]) === null || _k === void 0 ? void 0 : _k.value;
                            configValues["location-latitude"] = (_l = config["location-latitude"]) === null || _l === void 0 ? void 0 : _l.value;
                            configValues["location-longitude"] = (_m = config["location-longitude"]) === null || _m === void 0 ? void 0 : _m.value;
                            configValues["night-temp"] = (_o = config["night-temp"]) === null || _o === void 0 ? void 0 : _o.value;
                            configValues["night-brightness"] = (_p = config["night-brightness"]) === null || _p === void 0 ? void 0 : _p.value;
                            configValues["key-toggle"] = ((_q = config["key-toggle"]) === null || _q === void 0 ? void 0 : _q.value) || "";
                            configValues["key-temp-up"] = ((_r = config["key-temp-up"]) === null || _r === void 0 ? void 0 : _r.value) || "";
                            configValues["key-temp-down"] = ((_s = config["key-temp-down"]) === null || _s === void 0 ? void 0 : _s.value) || "";
                            configValues["key-brightness-up"] = ((_t = config["key-brightness-up"]) === null || _t === void 0 ? void 0 : _t.value) || "";
                            configValues["key-brightness-down"] = ((_u = config["key-brightness-down"]) === null || _u === void 0 ? void 0 : _u.value) || "";
                            configValues["presets"] = config["presets"] || [];

                            if (config["day-presets"] || config["night-presets"]) {
                                configValues["presets"] = [];
                                if ((_v = config["day-presets"]) === null || _v === void 0 ? void 0 : _v.value) {
                                    config["day-presets"].value.forEach((p) => {
                                        configValues["presets"].push({
                                            name: p.name + " (Day)",
                                            shortcut: "",
                                            dayTemp: p.temp,
                                            dayBrightness: p.brightness,
                                            nightTemp: 3500,
                                            nightBrightness: 90
                                        });
                                    });
                                }
                                if ((_w = config["night-presets"]) === null || _w === void 0 ? void 0 : _w.value) {
                                    config["night-presets"].value.forEach((p) => {
                                        configValues["presets"].push({
                                            name: p.name + " (Night)",
                                            shortcut: "",
                                            dayTemp: 6500,
                                            dayBrightness: 100,
                                            nightTemp: p.temp,
                                            nightBrightness: p.brightness
                                        });
                                    });
                                }
                            }
                        }
                        else {
                            configValues = config;

                            if (config["day-presets"] || config["night-presets"]) {
                                configValues["presets"] = [];
                                if (config["day-presets"]) {
                                    config["day-presets"].forEach((p) => {
                                        configValues["presets"].push({
                                            name: p.name + " (Day)",
                                            shortcut: "",
                                            dayTemp: p.temp,
                                            dayBrightness: p.brightness,
                                            nightTemp: 3500,
                                            nightBrightness: 90
                                        });
                                    });
                                }
                                if (config["night-presets"]) {
                                    config["night-presets"].forEach((p) => {
                                        configValues["presets"].push({
                                            name: p.name + " (Night)",
                                            shortcut: "",
                                            dayTemp: 6500,
                                            dayBrightness: 100,
                                            nightTemp: p.temp,
                                            nightBrightness: p.brightness
                                        });
                                    });
                                }
                            }
                        }

                        if (!configValues["day-temp"] && !configValues.dayTemp) {
                            throw new Error("Invalid configuration file format");
                        }

                        this.applyImportedConfiguration(configValues);
                        global.log(`Redshift: Configuration imported from ${filePath}`);
                        Util.spawnCommandLine(`notify-send "Redshift Manager Applet" "Configuration imported successfully"`);
                    }
                    catch (e) {
                        global.logError(`Redshift: Error importing configuration: ${e}`);
                        Util.spawnCommandLine(`notify-send "Redshift Manager Applet" "Error importing configuration: ${e}" -u critical`);
                    }
                }, (stderr) => {
                    if (stderr.includes("canceled") || stderr.includes("No file")) {
                        return;
                    }
                    global.logError(`Redshift: Error opening file dialog: ${stderr}`);
                });
            }
            catch (e) {
                global.logError(`Redshift: Error importing configuration: ${e}`);
                Util.spawnCommandLine(`notify-send "Redshift Manager Applet" "Error importing configuration: ${e}" -u critical`);
            }
        }

        applyImportedConfiguration(config) {
            if (!config["day-temp"] && !config.dayTemp) {
                throw new Error("Invalid configuration file format");
            }

            if (config.enabled !== undefined) this.enabled = config.enabled;
            if (config["auto-update"] !== undefined) this.autoUpdate = config["auto-update"];
            if (config.autoUpdate !== undefined) this.autoUpdate = config.autoUpdate;
            if (config["update-interval"] !== undefined) this.updateIntervalSeconds = config["update-interval"];
            if (config.updateIntervalSeconds !== undefined) this.updateIntervalSeconds = config.updateIntervalSeconds;
            if (config["smooth-transition"] !== undefined) this.smoothTransition = config["smooth-transition"];
            if (config.smoothTransition !== undefined) this.smoothTransition = config.smoothTransition;

            if (config["day-temp"] !== undefined) this.dayTemp = config["day-temp"];
            if (config.dayTemp !== undefined) this.dayTemp = config.dayTemp;
            if (config["day-brightness"] !== undefined) this.dayBrightness = config["day-brightness"];
            if (config.dayBrightness !== undefined) this.dayBrightness = config.dayBrightness;

            if (config["enable-night"] !== undefined) this.enableNight = config["enable-night"];
            if (config.enableNight !== undefined) this.enableNight = config.enableNight;
            if (config["manual-night-time"] !== undefined) this.manualNightTime = config["manual-night-time"];
            if (config.manualNightTime !== undefined) this.manualNightTime = config.manualNightTime;
            if (config["night-time-start"] !== undefined) this.nightTimeStart = config["night-time-start"];
            if (config.nightTimeStart !== undefined) this.nightTimeStart = config.nightTimeStart;
            if (config["night-time-end"] !== undefined) this.nightTimeEnd = config["night-time-end"];
            if (config.nightTimeEnd !== undefined) this.nightTimeEnd = config.nightTimeEnd;
            if (config["location-latitude"] !== undefined) this.locationLatitude = config["location-latitude"];
            if (config.locationLatitude !== undefined) this.locationLatitude = config.locationLatitude;
            if (config["location-longitude"] !== undefined) this.locationLongitude = config["location-longitude"];
            if (config.locationLongitude !== undefined) this.locationLongitude = config.locationLongitude;
            if (config["night-temp"] !== undefined) this.nightTemp = config["night-temp"];
            if (config.nightTemp !== undefined) this.nightTemp = config.nightTemp;
            if (config["night-brightness"] !== undefined) this.nightBrightness = config["night-brightness"];
            if (config.nightBrightness !== undefined) this.nightBrightness = config.nightBrightness;

            if (config["key-toggle"] !== undefined) this.keyToggle = config["key-toggle"];
            if (config.keyToggle !== undefined) this.keyToggle = config.keyToggle;
            if (config["key-temp-up"] !== undefined) this.keyTempUp = config["key-temp-up"];
            if (config.keyTempUp !== undefined) this.keyTempUp = config.keyTempUp;
            if (config["key-temp-down"] !== undefined) this.keyTempDown = config["key-temp-down"];
            if (config.keyTempDown !== undefined) this.keyTempDown = config.keyTempDown;
            if (config["key-brightness-up"] !== undefined) this.keyBrightnessUp = config["key-brightness-up"];
            if (config.keyBrightnessUp !== undefined) this.keyBrightnessUp = config.keyBrightnessUp;
            if (config["key-brightness-down"] !== undefined) this.keyBrightnessDown = config["key-brightness-down"];
            if (config.keyBrightnessDown !== undefined) this.keyBrightnessDown = config.keyBrightnessDown;

            if (config["presets"] !== undefined && Array.isArray(config["presets"])) {
                this.presets = config["presets"];
                this.setupPresetKeybindings();

                if (!this._updatingPresets && JSON.stringify(this.settings.getValue("presets")) !== JSON.stringify(this.presets)) {
                    this._updatingPresets = true;
                    try {
                        this.settings.setValue("presets", this.presets);
                    }
                    finally {
                        this._updatingPresets = false;
                    }
                }
            }
            else if (config["day-presets"] !== undefined || config["night-presets"] !== undefined) {
                this.presets = [];
                if (config["day-presets"] && Array.isArray(config["day-presets"])) {
                    config["day-presets"].forEach((p) => {
                        this.presets.push({
                            name: p.name + " (Day)",
                            shortcut: "",
                            dayTemp: p.temp,
                            dayBrightness: p.brightness,
                            nightTemp: 3500,
                            nightBrightness: 90
                        });
                    });
                }
                if (config["night-presets"] && Array.isArray(config["night-presets"])) {
                    config["night-presets"].forEach((p) => {
                        this.presets.push({
                            name: p.name + " (Night)",
                            shortcut: "",
                            dayTemp: 6500,
                            dayBrightness: 100,
                            nightTemp: p.temp,
                            nightBrightness: p.brightness
                        });
                    });
                }
                this.setupPresetKeybindings();

                if (!this._updatingPresets && JSON.stringify(this.settings.getValue("presets")) !== JSON.stringify(this.presets)) {
                    this._updatingPresets = true;
                    try {
                        this.settings.setValue("presets", this.presets);
                    }
                    finally {
                        this._updatingPresets = false;
                    }
                }
            }

            this.setupKeybindings();
            this.onLocationChanged();
            this.onNightTimeSettingsChanged();
            this.applyRedshift();
        }

        saveConfigurationToFile() {
            try {
                this.ensureConfigDirectory();
                const configFile = this.getConfigFilePath();

                const config = {
                    enabled: this.enabled || false,
                    "auto-update": this.autoUpdate !== undefined ? this.autoUpdate : true,
                    "update-interval": this.updateIntervalSeconds || 5,
                    "smooth-transition": this.smoothTransition !== undefined ? this.smoothTransition : true,
                    "day-temp": this.dayTemp || 6500,
                    "day-brightness": this.dayBrightness || 100,
                    "enable-night": this.enableNight !== undefined ? this.enableNight : true,
                    "manual-night-time": this.manualNightTime || false,
                    "night-time-start": this.nightTimeStart || { h: 20, m: 0, s: 0 },
                    "night-time-end": this.nightTimeEnd || { h: 6, m: 0, s: 0 },
                    "location-latitude": this.locationLatitude || "0",
                    "location-longitude": this.locationLongitude || "0",
                    "night-temp": this.nightTemp || 3500,
                    "night-brightness": this.nightBrightness || 90,
                    "key-toggle": this.keyToggle || "",
                    "key-temp-up": this.keyTempUp || "",
                    "key-temp-down": this.keyTempDown || "",
                    "key-brightness-up": this.keyBrightnessUp || "",
                    "key-brightness-down": this.keyBrightnessDown || "",
                    "presets": this.presets || [],
                    lastSaved: new Date().toISOString(),
                    version: this.metadata.version || "0.0.1"
                };
                const jsonString = JSON.stringify(config, null, 2);
                const file = Gio.File.new_for_path(configFile);
                const fileStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                const dataStream = new Gio.DataOutputStream({ base_stream: fileStream });
                dataStream.put_string(jsonString, null);
                dataStream.close(null);
                // Removed log to reduce noise

                // Only update settings if presets actually changed AND we're not already in an update cycle
                if (!this._updatingPresets && !this._applyingPreset) {
                    const currentSettingsPresets = this.settings.getValue("presets");
                    const currentPresetsString = JSON.stringify(currentSettingsPresets);
                    const newPresetsString = JSON.stringify(this.presets);

                    if (currentPresetsString !== newPresetsString) {
                        this._updatingPresets = true;
                        try {
                            this.settings.setValue("presets", this.presets);
                            global.log(`Redshift: Presets synced to settings`);
                        }
                        finally {
                            this._updatingPresets = false;
                        }
                    }
                }
            }
            catch (e) {
                global.logError(`Redshift: Error saving configuration: ${e}`);
            }
        }

        loadConfigurationFromFile() {
            try {
                const configFile = this.getConfigFilePath();
                const file = Gio.File.new_for_path(configFile);
                if (!file.query_exists(null)) {
                    global.log(`Redshift: No saved configuration found at ${configFile}`);
                    return;
                }
                const [success, contents] = file.load_contents(null);
                if (!success) {
                    throw new Error("Failed to read configuration file");
                }
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(contents);
                const config = JSON.parse(jsonString);
                this.applyImportedConfiguration(config);
                global.log(`Redshift: Configuration loaded from ${configFile}`);
            }
            catch (e) {
                global.logError(`Redshift: Error loading configuration: ${e}`);
            }
        }
        addSliderItem(label, min, max, initialValue, step, callback) {
            let sliderItem = new PopupMenu.PopupBaseMenuItem({ activate: false });
            let box = new St.BoxLayout({ vertical: true, style_class: 'popup-slider-item' });
            let currentValue = initialValue;
            let labelWidget = new St.Label({ text: `${label}: ${Math.round(currentValue)}` });
            box.add(labelWidget);
            let sliderWidget = new Slider.Slider(0);
            sliderWidget._value = (initialValue - min) / (max - min);
            let isScrolling = false;
            let lastUpdateTime = 0;
            sliderItem.actor.connect('scroll-event', (actor, event) => {
                let direction = event.get_scroll_direction();
                if (direction == ScrollDirection.UP) {
                    currentValue = Math.min(max, currentValue + step);
                }
                else if (direction == ScrollDirection.DOWN) {
                    currentValue = Math.max(min, currentValue - step);
                }
                isScrolling = true;
                sliderWidget._value = (currentValue - min) / (max - min);
                labelWidget.text = `${label}: ${Math.round(currentValue)}`;
                callback(currentValue);
                imports.mainloop.timeout_add(50, () => {
                    isScrolling = false;
                    return false;
                });
                return Clutter.EVENT_STOP;
            });
            sliderWidget.connect('value-changed', () => {
                if (isScrolling)
                    return;
                let now = Date.now();
                if (now - lastUpdateTime < 50)
                    return;
                lastUpdateTime = now;
                let rawValue = min + sliderWidget._value * (max - min);
                currentValue = Math.round(rawValue / step) * step;
                currentValue = Math.max(min, Math.min(max, currentValue));
                labelWidget.text = `${label}: ${Math.round(currentValue)}`;
                callback(currentValue);
            });
            box.add(sliderWidget.actor);
            sliderItem.addActor(box, { expand: true });
            this.menu.addMenuItem(sliderItem);
        }
        onEnabledChanged() {
            const enabled = this.enabled;
            if (this.toggleSwitch) {
                this.toggleSwitch.setToggleState(enabled);
            }
            this.applyRedshift();
            this.saveConfigurationToFile();
        }
        onTemperatureChanged() {
            this.applyRedshift();
            this.saveConfigurationToFile();
        }
        onIconSettingsChanged() {
            this.updateIcon();
        }
        onLabelSettingsChanged() {
            this.updateLabel();
        }
        onUpdateIntervalChanged() {
            this.startUpdateLoop();
            this.saveConfigurationToFile();
        }
        setupKeybindings() {
            this.removeKeybindings();
            if (this.keyToggle) {
                Main.keybindingManager.addHotKey("redshift-toggle", this.keyToggle, () => {
                    this.enabled = !this.enabled;
                    if (this.toggleSwitch) {
                        this.toggleSwitch.setToggleState(this.enabled);
                    }
                    this.applyRedshift();
                });
            }
            if (this.keyTempUp) {
                Main.keybindingManager.addHotKey("redshift-temp-up", this.keyTempUp, () => {
                    if (!this.enabled)
                        return;
                    const newTemp = Math.min(10000, this.dayTemp + TEMP_STEP);
                    this.dayTemp = newTemp;
                    this.currentTemp = newTemp;
                    this.applyRedshift();
                });
            }
            if (this.keyTempDown) {
                Main.keybindingManager.addHotKey("redshift-temp-down", this.keyTempDown, () => {
                    if (!this.enabled)
                        return;
                    const newTemp = Math.max(1000, this.dayTemp - TEMP_STEP);
                    this.dayTemp = newTemp;
                    this.currentTemp = newTemp;
                    this.applyRedshift();
                });
            }
            if (this.keyBrightnessUp) {
                Main.keybindingManager.addHotKey("redshift-brightness-up", this.keyBrightnessUp, () => {
                    if (!this.enabled)
                        return;
                    const newBrightness = Math.min(100, this.dayBrightness + BRIGHTNESS_STEP);
                    this.dayBrightness = newBrightness;
                    this.currentBrightness = newBrightness;
                    this.applyRedshift();
                });
            }
            if (this.keyBrightnessDown) {
                Main.keybindingManager.addHotKey("redshift-brightness-down", this.keyBrightnessDown, () => {
                    if (!this.enabled)
                        return;
                    const newBrightness = Math.max(10, this.dayBrightness - BRIGHTNESS_STEP);
                    this.dayBrightness = newBrightness;
                    this.currentBrightness = newBrightness;
                    this.applyRedshift();
                });
            }
        }
        removeKeybindings() {
            try {
                Main.keybindingManager.removeHotKey("redshift-toggle");
                Main.keybindingManager.removeHotKey("redshift-temp-up");
                Main.keybindingManager.removeHotKey("redshift-temp-down");
                Main.keybindingManager.removeHotKey("redshift-brightness-up");
                Main.keybindingManager.removeHotKey("redshift-brightness-down");

                for (let i = 0; i < 20; i++) {
                    try {
                        Main.keybindingManager.removeHotKey(`preset-${i}`);
                    }
                    catch (e) {}
                }
            }
            catch (e) {
            }
        }
        onShortcutChanged() {
            this.setupKeybindings();
            this.saveConfigurationToFile();
        }
        loadPresetsFromSettings() {
            if (this._updatingPresets)
                return;
            this._updatingPresets = true;
            try {
                // Load presets from settings
                const presetsValue = this.settings.getValue("presets");
                if (presetsValue) {
                    // Parse if it's a string, otherwise use as-is
                    this.presets = typeof presetsValue === 'string' ? JSON.parse(presetsValue) : presetsValue;
                } else {
                    this.presets = [];
                }

                global.log(`[LookingGlass/info] Redshift: Loaded ${this.presets.length} presets from settings`);

                // Setup keyboard shortcuts for presets
                this.setupPresetKeybindings();

                // Rebuild menu to show updated presets
                imports.mainloop.timeout_add(200, () => {
                    this.rebuildMenu();
                    return false;
                });

                // Don't call saveConfigurationToFile() here to prevent event loops
                // The file will be saved when presets are actually modified (add/edit/delete)
            }
            catch (e) {
                global.logError(`Error loading presets from settings: ${e}`);
                this.presets = [];
            }
            finally {
                this._updatingPresets = false;
            }
        }
        onPresetsChanged() {
            if (this._updatingPresets)
                return;
            this._updatingPresets = true;
            try {
                this.setupPresetKeybindings();
                const configFile = this.getConfigFilePath();
                const file = Gio.File.new_for_path(configFile);
                if (file.query_exists(null)) {
                    const [success, contents] = file.load_contents(null);
                    if (success) {
                        const decoder = new TextDecoder('utf-8');
                        const jsonString = decoder.decode(contents);
                        const config = JSON.parse(jsonString);
                        config.presets = this.presets;
                        const newJsonString = JSON.stringify(config, null, 2);
                        const fileStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
                        const dataStream = new Gio.DataOutputStream({ base_stream: fileStream });
                        dataStream.put_string(newJsonString, null);
                        dataStream.close(null);
                    }
                }

                imports.mainloop.timeout_add(200, () => {
                    this.rebuildMenu();
                    return false;
                });
            }
            catch (e) {
                global.logError(`Error in onPresetsChanged: ${e}`);
            }
            finally {
                this._updatingPresets = false;
            }
        }
        autoDetectLocation() {
            const lat = this.locationLatitude;
            const lon = this.locationLongitude;

            if (lat !== "0" && lon !== "0") {
                this.calculateSunTimes();
                return;
            }
            try {
                Util.spawnCommandLineAsyncIO("curl -s https://geoip.fedoraproject.org/city", (stdout) => {
                    try {
                        const data = JSON.parse(stdout);
                        if (data.latitude && data.longitude) {
                            this.locationLatitude = data.latitude.toString();
                            this.locationLongitude = data.longitude.toString();
                            global.log(`Redshift: Location detected - Lat: ${data.latitude}, Lon: ${data.longitude}`);
                            this.calculateSunTimes();
                        }
                    }
                    catch (e) {
                        global.log(`Redshift: Failed to parse location data: ${e}`);
                    }
                }, (stderr) => {
                    global.log(`Redshift: Failed to get location: ${stderr}`);
                });
            }
            catch (e) {
                global.log(`Redshift: Error detecting location: ${e}`);
            }
        }
        onLocationChanged() {
            this.calculateSunTimes();
            this.saveConfigurationToFile();
        }
        onNightTimeSettingsChanged() {
            this.calculateSunTimes();
            this.applyRedshift();
            this.saveConfigurationToFile();
        }
        calculateSunTimes() {
            const manual = this.manualNightTime;
            if (manual) {
                return;
            }

            const lat = parseFloat(this.locationLatitude || "0");
            const lon = parseFloat(this.locationLongitude || "0");
            if (lat === 0 && lon === 0) {
                return;
            }

            const sunTimes = this.getSunriseSunset(lat, lon);

            if (this.nightTimeStart) {
                this.nightTimeStart.h = sunTimes.sunset.getHours();
                this.nightTimeStart.m = sunTimes.sunset.getMinutes();
            }
            if (this.nightTimeEnd) {
                this.nightTimeEnd.h = sunTimes.sunrise.getHours();
                this.nightTimeEnd.m = sunTimes.sunrise.getMinutes();
            }
            global.log(`Redshift: Calculated sun times - Sunrise: ${sunTimes.sunrise.toLocaleTimeString()}, Sunset: ${sunTimes.sunset.toLocaleTimeString()}`);
        }
        getSunriseSunset(latitude, longitude) {
            const now = new Date();
            const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
            const solarNoonOffset = -longitude / 15;
            const declination = -23.44 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
            const hourAngle = Math.acos(-Math.tan(latitude * Math.PI / 180) * Math.tan(declination * Math.PI / 180)) * 180 / Math.PI;
            const dayLength = 2 * hourAngle / 15;
            const solarNoon = 12 + solarNoonOffset;
            const sunriseHour = solarNoon - (dayLength / 2);
            const sunsetHour = solarNoon + (dayLength / 2);
            const sunrise = new Date(now);
            sunrise.setHours(Math.floor(sunriseHour));
            sunrise.setMinutes(Math.round((sunriseHour % 1) * 60));
            sunrise.setSeconds(0);
            const sunset = new Date(now);
            sunset.setHours(Math.floor(sunsetHour));
            sunset.setMinutes(Math.round((sunsetHour % 1) * 60));
            sunset.setSeconds(0);
            return { sunrise, sunset };
        }
        isNightTime() {
            const enableNight = this.enableNight;
            if (!enableNight) {
                return false;
            }
            const now = new Date();
            const nightStart = this.nightTimeStart || { h: 20, m: 0 };
            const nightEnd = this.nightTimeEnd || { h: 6, m: 0 };
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const startMinutes = nightStart.h * 60 + nightStart.m;
            const endMinutes = nightEnd.h * 60 + nightEnd.m;

            if (startMinutes > endMinutes) {
                return currentMinutes >= startMinutes || currentMinutes < endMinutes;
            }
            else {
                return currentMinutes >= startMinutes && currentMinutes < endMinutes;
            }
        }
        updateIcon() {
            const customIconPath = this.customIconPath;
            if (customIconPath && customIconPath.length > 0) {
                this.set_applet_icon_path(customIconPath);
            }
            else {
                this.set_applet_icon_path(`${this.metadata.path}/icons/icon.svg`);
            }
        }
        updateLabel() {
            try {
                const showLabel = this.showLabel !== undefined ? this.showLabel : true;
                if (showLabel) {
                    this.set_applet_label("Redshift");
                }
                else {
                    this.set_applet_label("");
                }
            }
            catch (e) {
                this.set_applet_label("Redshift");
            }
        }
        startUpdateLoop() {
            if (this.updateInterval) {
                imports.mainloop.source_remove(this.updateInterval);
            }
            const intervalMs = (this.updateIntervalSeconds || 5) * 1000;
            this.updateInterval = imports.mainloop.timeout_add(intervalMs, () => {
                this.update();
                return true;
            });
        }
        update() {
            const enabled = this.enabled;
            const statusText = enabled ? `Active - ${this.currentTemp}K @ ${this.currentBrightness}%` : "Inactive";
            if (this.statusLabel) {
                this.statusLabel.label.text = `Status: ${statusText}`;
            }
            this.set_applet_tooltip(`Redshift: ${statusText}`);
        }
        applyRedshift() {
            const enabled = this.enabled;
            if (!enabled) {
                this.resetRedshift();
                return;
            }

            const isNight = this.isNightTime();
            let temp;
            let brightness;
            if (isNight) {
                temp = this.nightTemp || 3500;
                brightness = (this.nightBrightness || 90) / 100;
                global.log(`Redshift: Applying night settings - Temp: ${temp}K, Brightness: ${Math.round(brightness * 100)}%`);
            }
            else {
                temp = this.dayTemp || 6500;
                brightness = (this.dayBrightness || 100) / 100;
                global.log(`Redshift: Applying day settings - Temp: ${temp}K, Brightness: ${Math.round(brightness * 100)}%`);
            }
            try {
                Util.spawnCommandLine(`redshift -P -O ${temp} -b ${brightness}`);
                this.isRedshiftActive = true;
                this.currentTemp = temp;
                this.currentBrightness = Math.round(brightness * 100);
            }
            catch (e) {
                global.logError(`Error applying Redshift: ${e}`);
            }
            this.update();
        }
        resetRedshift() {
            try {
                Util.spawnCommandLine("redshift -x");
                this.isRedshiftActive = false;
            }
            catch (e) {
                global.logError(`Error resetting Redshift: ${e}`);
            }
            this.update();
        }
        on_applet_clicked(event) {
            this.menu.toggle();
        }
        on_applet_removed_from_panel() {
            this.removeKeybindings();
            if (this.updateInterval) {
                imports.mainloop.source_remove(this.updateInterval);
            }
            this.resetRedshift();
            this.settings.finalize();
        }
    }
function main(metadata, orientation, panel_height, instance_id) {
    return new RedshiftApplet(metadata, orientation, panel_height, instance_id);
}
