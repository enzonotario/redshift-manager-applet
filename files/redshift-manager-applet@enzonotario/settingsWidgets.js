const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var PresetsWidget = GObject.registerClass({
    GTypeName: 'PresetsWidget',
}, class PresetsWidget extends Gtk.Box {
    _init(settings, key) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            margin: 10,
            margin_start: 20,
            margin_end: 20,
            margin_top: 10,
            margin_bottom: 10
        });

        this.settings = settings;
        this.key = key;
        this.presets = [];

        this.settings.bind(key, key, this._onSettingsChanged.bind(this));
        this._loadPresets();
        this._buildUI();
    }

    _loadPresets() {
        try {
            const value = this.settings.getValue(this.key);
            this.presets = value ? JSON.parse(JSON.stringify(value)) : [];
        } catch (e) {
            global.logError(`Error loading presets: ${e}`);
            this.presets = [];
        }
    }

    _savePresets() {
        try {
            this.settings.setValue(this.key, this.presets);
            this._saveToPersistentConfig();
        } catch (e) {
            global.logError(`Error saving presets: ${e}`);
        }
    }

    _saveToPersistentConfig() {
        try {
            const homeDir = GLib.get_home_dir();
            const configFile = `${homeDir}/.config/redshift-manager/config.json`;
            const file = Gio.File.new_for_path(configFile);

            if (!file.query_exists(null)) {
                return;
            }

            const [success, contents] = file.load_contents(null);
            if (!success) return;

            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(contents);
            const config = JSON.parse(jsonString);

            config.presets = this.presets;

            const newJsonString = JSON.stringify(config, null, 2);
            const fileStream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            const dataStream = new Gio.DataOutputStream({ base_stream: fileStream });
            dataStream.put_string(newJsonString, null);
            dataStream.close(null);
        } catch (e) {}
    }

    _onSettingsChanged() {
        this._loadPresets();
        this._updateUI();
    }

    _buildUI() {
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            shadow_type: Gtk.ShadowType.IN
        });
        scrolled.set_size_request(-1, 300);

        this.listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE
        });
        this.listBox.set_header_func((row, before) => {
            if (before !== null) {
                row.set_header(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
            }
        });

        scrolled.add(this.listBox);
        this.pack_start(scrolled, true, true, 0);

        const addButton = new Gtk.Button({
            label: "Add New Preset",
            halign: Gtk.Align.CENTER,
            margin_top: 10
        });
        addButton.connect('clicked', () => {
            this._showAddPresetDialog();
        });
        this.pack_start(addButton, false, false, 0);

        this._updateUI();
        this.show_all();
    }

    _updateUI() {
        this.listBox.foreach((child) => {
            this.listBox.remove(child);
        });

        if (this.presets.length === 0) {
            const emptyRow = new Gtk.ListBoxRow({
                selectable: false,
                activatable: false
            });
            const label = new Gtk.Label({
                label: "No presets. Click 'Add New Preset' to create one.",
                margin: 20
            });
            emptyRow.add(label);
            this.listBox.add(emptyRow);
            this.listBox.show_all();
            return;
        }

        this.presets.forEach((preset, index) => {
            const row = this._createPresetRow(preset, index);
            this.listBox.add(row);
        });

        this.listBox.show_all();
    }

    _createPresetRow(preset, index) {
        const row = new Gtk.ListBoxRow({
            selectable: false,
            activatable: false
        });

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            margin: 10
        });

        const headerBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10
        });

        const nameLabel = new Gtk.Label({
            label: `<b>${preset.name || `Preset ${index + 1}`}</b>`,
            use_markup: true,
            halign: Gtk.Align.START,
            hexpand: true
        });
        headerBox.pack_start(nameLabel, true, true, 0);

        const editButton = new Gtk.Button({ label: "Edit" });
        editButton.connect('clicked', () => {
            this._editPreset(index);
        });
        headerBox.pack_start(editButton, false, false, 0);

        const deleteButton = new Gtk.Button({ label: "Delete" });
        deleteButton.connect('clicked', () => {
            this._deletePreset(index);
        });
        headerBox.pack_start(deleteButton, false, false, 0);

        mainBox.pack_start(headerBox, false, false, 0);

        const infoLabel = new Gtk.Label({
            label: `Day: ${preset.dayTemp}K, ${preset.dayBrightness}% | Night: ${preset.nightTemp}K, ${preset.nightBrightness}%`,
            halign: Gtk.Align.START,
            margin_start: 20
        });
        mainBox.pack_start(infoLabel, false, false, 0);

        const shortcutBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_start: 20
        });

        const shortcutLabel = new Gtk.Label({
            label: `Shortcut: ${preset.shortcut || 'None'}`,
            halign: Gtk.Align.START,
            hexpand: true
        });
        shortcutBox.pack_start(shortcutLabel, true, true, 0);

        const shortcutButton = new Gtk.Button({
            label: preset.shortcut ? "Change Shortcut" : "Set Shortcut"
        });
        shortcutButton.connect('clicked', () => {
            this._setPresetShortcut(index);
        });
        shortcutBox.pack_start(shortcutButton, false, false, 0);

        mainBox.pack_start(shortcutBox, false, false, 0);

        row.add(mainBox);
        return row;
    }

    _showAddPresetDialog() {
        const dialog = new Gtk.Dialog({
            title: "Add New Preset",
            modal: true,
            transient_for: this.get_toplevel()
        });

        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
        dialog.add_button("Add", Gtk.ResponseType.OK);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(10);
        contentArea.set_margin_start(10);
        contentArea.set_margin_end(10);
        contentArea.set_margin_top(10);
        contentArea.set_margin_bottom(10);

        const nameBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nameBox.pack_start(new Gtk.Label({ label: "Name:" }), false, false, 0);
        const nameEntry = new Gtk.Entry({
            text: `Preset ${this.presets.length + 1}`,
            hexpand: true
        });
        nameBox.pack_start(nameEntry, true, true, 0);
        contentArea.pack_start(nameBox, false, false, 0);

        const dayTempBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        dayTempBox.pack_start(new Gtk.Label({ label: "Day Temp:" }), false, false, 0);
        const dayTempSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1000,
                upper: 10000,
                step_increment: 100,
                value: 6500
            })
        });
        dayTempBox.pack_start(dayTempSpin, true, true, 0);
        contentArea.pack_start(dayTempBox, false, false, 0);

        const dayBrightnessBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        dayBrightnessBox.pack_start(new Gtk.Label({ label: "Day Brightness:" }), false, false, 0);
        const dayBrightnessSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: 100
            })
        });
        dayBrightnessBox.pack_start(dayBrightnessSpin, true, true, 0);
        contentArea.pack_start(dayBrightnessBox, false, false, 0);

        const nightTempBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nightTempBox.pack_start(new Gtk.Label({ label: "Night Temp:" }), false, false, 0);
        const nightTempSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1000,
                upper: 10000,
                step_increment: 100,
                value: 3500
            })
        });
        nightTempBox.pack_start(nightTempSpin, true, true, 0);
        contentArea.pack_start(nightTempBox, false, false, 0);

        const nightBrightnessBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nightBrightnessBox.pack_start(new Gtk.Label({ label: "Night Brightness:" }), false, false, 0);
        const nightBrightnessSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: 90
            })
        });
        nightBrightnessBox.pack_start(nightBrightnessSpin, true, true, 0);
        contentArea.pack_start(nightBrightnessBox, false, false, 0);

        contentArea.show_all();

        const response = dialog.run();
        if (response === Gtk.ResponseType.OK) {
            const preset = {
                name: nameEntry.get_text(),
                shortcut: "",
                dayTemp: dayTempSpin.get_value_as_int(),
                dayBrightness: dayBrightnessSpin.get_value_as_int(),
                nightTemp: nightTempSpin.get_value_as_int(),
                nightBrightness: nightBrightnessSpin.get_value_as_int()
            };

            this.presets.push(preset);
            this._savePresets();
            this._updateUI();
        }

        dialog.destroy();
    }

    _editPreset(index) {
        const preset = this.presets[index];

        const dialog = new Gtk.Dialog({
            title: "Edit Preset",
            modal: true,
            transient_for: this.get_toplevel()
        });

        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
        dialog.add_button("Save", Gtk.ResponseType.OK);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(10);
        contentArea.set_margin_start(10);
        contentArea.set_margin_end(10);
        contentArea.set_margin_top(10);
        contentArea.set_margin_bottom(10);

        const nameBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nameBox.pack_start(new Gtk.Label({ label: "Name:" }), false, false, 0);
        const nameEntry = new Gtk.Entry({
            text: preset.name,
            hexpand: true
        });
        nameBox.pack_start(nameEntry, true, true, 0);
        contentArea.pack_start(nameBox, false, false, 0);

        const dayTempBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        dayTempBox.pack_start(new Gtk.Label({ label: "Day Temp:" }), false, false, 0);
        const dayTempSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1000,
                upper: 10000,
                step_increment: 100,
                value: preset.dayTemp
            })
        });
        dayTempBox.pack_start(dayTempSpin, true, true, 0);
        contentArea.pack_start(dayTempBox, false, false, 0);

        const dayBrightnessBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        dayBrightnessBox.pack_start(new Gtk.Label({ label: "Day Brightness:" }), false, false, 0);
        const dayBrightnessSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: preset.dayBrightness
            })
        });
        dayBrightnessBox.pack_start(dayBrightnessSpin, true, true, 0);
        contentArea.pack_start(dayBrightnessBox, false, false, 0);

        const nightTempBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nightTempBox.pack_start(new Gtk.Label({ label: "Night Temp:" }), false, false, 0);
        const nightTempSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1000,
                upper: 10000,
                step_increment: 100,
                value: preset.nightTemp
            })
        });
        nightTempBox.pack_start(nightTempSpin, true, true, 0);
        contentArea.pack_start(nightTempBox, false, false, 0);

        const nightBrightnessBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
        nightBrightnessBox.pack_start(new Gtk.Label({ label: "Night Brightness:" }), false, false, 0);
        const nightBrightnessSpin = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: preset.nightBrightness
            })
        });
        nightBrightnessBox.pack_start(nightBrightnessSpin, true, true, 0);
        contentArea.pack_start(nightBrightnessBox, false, false, 0);

        contentArea.show_all();

        const response = dialog.run();
        if (response === Gtk.ResponseType.OK) {
            preset.name = nameEntry.get_text();
            preset.dayTemp = dayTempSpin.get_value_as_int();
            preset.dayBrightness = dayBrightnessSpin.get_value_as_int();
            preset.nightTemp = nightTempSpin.get_value_as_int();
            preset.nightBrightness = nightBrightnessSpin.get_value_as_int();

            this._savePresets();
            this._updateUI();
        }

        dialog.destroy();
    }

    _deletePreset(index) {
        const preset = this.presets[index];

        const dialog = new Gtk.MessageDialog({
            message_type: Gtk.MessageType.QUESTION,
            buttons: Gtk.ButtonsType.YES_NO,
            text: "Delete Preset",
            secondary_text: `Are you sure you want to delete preset '${preset.name}'?`,
            modal: true,
            transient_for: this.get_toplevel()
        });

        const response = dialog.run();
        if (response === Gtk.ResponseType.YES) {
            this.presets.splice(index, 1);
            this._savePresets();
            this._updateUI();
        }

        dialog.destroy();
    }

    _setPresetShortcut(index) {
        const preset = this.presets[index];

        const dialog = new Gtk.Dialog({
            title: "Set Shortcut",
            modal: true,
            transient_for: this.get_toplevel()
        });

        dialog.add_button("Cancel", Gtk.ResponseType.CANCEL);
        dialog.add_button("Remove", Gtk.ResponseType.REJECT);
        dialog.add_button("Save", Gtk.ResponseType.OK);

        const contentArea = dialog.get_content_area();
        contentArea.set_spacing(10);
        contentArea.set_margin_start(10);
        contentArea.set_margin_end(10);
        contentArea.set_margin_top(10);
        contentArea.set_margin_bottom(10);

        const label = new Gtk.Label({
            label: `Enter keyboard shortcut for '${preset.name}':\n(e.g., <Super>F1, <Control><Alt>p)\n\nCurrent: ${preset.shortcut || 'None'}`,
            justify: Gtk.Justification.CENTER
        });
        contentArea.pack_start(label, false, false, 0);

        const entry = new Gtk.Entry({
            text: preset.shortcut || "",
            hexpand: true
        });
        contentArea.pack_start(entry, false, false, 0);

        contentArea.show_all();

        const response = dialog.run();
        if (response === Gtk.ResponseType.OK) {
            preset.shortcut = entry.get_text();
            this._savePresets();
            this._updateUI();
        } else if (response === Gtk.ResponseType.REJECT) {
            preset.shortcut = "";
            this._savePresets();
            this._updateUI();
        }

        dialog.destroy();
    }
});

var PresetsLabelWidget = GObject.registerClass({
    GTypeName: 'PresetsLabelWidget',
}, class PresetsLabelWidget extends Gtk.Box {
    _init(settings, key) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 0,
            margin: 0,
            margin_start: 20,
            margin_end: 20,
            margin_top: 10,
            margin_bottom: 10
        });

        this.settings = settings;
        this.key = key;

        const presetsWidget = new PresetsWidget(settings, 'presets');
        this.pack_start(presetsWidget, true, true, 0);
        
        this.show_all();
    }
});

function buildPresetsWidget(settings, key) {
    try {
        global.log(`Redshift: buildPresetsWidget called for key: ${key}`);
        const widget = new PresetsLabelWidget(settings, key);
        return widget;
    } catch (e) {
        global.logError(`Redshift: Error in buildPresetsWidget: ${e}`);
        global.logError(`Redshift: Stack trace: ${e.stack}`);
    }
    return null;
}

function buildWidget(settings, key) {
    try {
        if (key === 'presets') {
            global.log(`Redshift: buildWidget called for key: ${key}`);
            return buildPresetsWidget(settings, key);
        }
    } catch (e) {
        global.logError(`Redshift: Error building widget for key ${key}: ${e}`);
        global.logError(`Redshift: Stack trace: ${e.stack}`);
    }
    return null;
}

function getWidgetForValue(settings, key) {
    return buildWidget(settings, key);
}

if (typeof exports !== 'undefined') {
    exports.buildWidget = buildWidget;
    exports.buildPresetsWidget = buildPresetsWidget;
    exports.getWidgetForValue = getWidgetForValue;
}
