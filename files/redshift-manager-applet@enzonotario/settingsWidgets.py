#!/usr/bin/env python3

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, Gdk, GObject
import json
import os
from SettingsWidgets import SettingsWidget

class PresetsWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)

        self.key = key
        self.info = info
        self.settings = settings
        self.presets = []

        # Main container
        self.content_widget = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        self.pack_start(self.content_widget, True, True, 0)

        # Load presets from settings
        self._load_presets()

        # Create scrolled window for preset list
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scrolled.set_shadow_type(Gtk.ShadowType.IN)
        scrolled.set_size_request(-1, 300)

        # Create list box for presets
        self.listbox = Gtk.ListBox()
        self.listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        scrolled.add(self.listbox)

        self.content_widget.pack_start(scrolled, True, True, 0)

        # Add preset button
        add_button = Gtk.Button(label="Add New Preset")
        add_button.connect("clicked", self._on_add_preset)
        self.content_widget.pack_start(add_button, False, False, 0)

        # Build the list
        self._rebuild_list()

        self.content_widget.show_all()

    def _load_presets(self):
        """Load presets from settings"""
        try:
            value = self.settings.get_value(self.key)
            if value:
                self.presets = json.loads(value) if isinstance(value, str) else value
            else:
                self.presets = []
        except Exception as e:
            print(f"Error loading presets: {e}")
            self.presets = []

    def _save_presets(self):
        """Save presets to settings"""
        try:
            self.settings.set_value(self.key, json.dumps(self.presets))
            # Also save to config file
            self._save_to_config_file()
        except Exception as e:
            print(f"Error saving presets: {e}")

    def _save_to_config_file(self):
        """Save to persistent config file"""
        try:
            config_dir = os.path.expanduser("~/.config/redshift-manager")
            config_file = os.path.join(config_dir, "config.json")

            os.makedirs(config_dir, exist_ok=True)

            # Load existing config
            config = {}
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    config = json.load(f)

            # Update presets
            config['presets'] = self.presets

            # Save back
            with open(config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error saving to config file: {e}")

    def _rebuild_list(self):
        """Rebuild the preset list"""
        # Clear existing items
        for child in self.listbox.get_children():
            self.listbox.remove(child)

        # Add each preset
        for index, preset in enumerate(self.presets):
            row = self._create_preset_row(preset, index)
            self.listbox.add(row)

        self.listbox.show_all()

    def _create_preset_row(self, preset, index):
        """Create a row widget for a preset"""
        row = Gtk.ListBoxRow()
        row.set_can_focus(False)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
        vbox.set_margin_top(10)
        vbox.set_margin_bottom(10)
        vbox.set_margin_start(10)
        vbox.set_margin_end(10)

        # Header with name and buttons
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        # Preset name (bold)
        name_label = Gtk.Label()
        name_label.set_markup(f"<b>{preset.get('name', 'Unnamed')}</b>")
        name_label.set_halign(Gtk.Align.START)
        hbox.pack_start(name_label, False, False, 0)

        # Spacer
        hbox.pack_start(Gtk.Box(), True, True, 0)

        # Edit button
        edit_button = Gtk.Button(label="Edit")
        edit_button.connect("clicked", self._on_edit_preset, index)
        hbox.pack_start(edit_button, False, False, 0)

        # Delete button
        delete_button = Gtk.Button(label="Delete")
        delete_button.get_style_context().add_class("destructive-action")
        delete_button.connect("clicked", self._on_delete_preset, index)
        hbox.pack_start(delete_button, False, False, 0)

        vbox.pack_start(hbox, False, False, 0)

        # Info box with temperature and brightness
        info_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=20)

        day_info = Gtk.Label()
        day_info.set_markup(f"Day: {preset.get('dayTemp', 6500)}K, {preset.get('dayBrightness', 100)}%")
        day_info.set_halign(Gtk.Align.START)
        info_box.pack_start(day_info, False, False, 0)

        night_info = Gtk.Label()
        night_info.set_markup(f"Night: {preset.get('nightTemp', 3500)}K, {preset.get('nightBrightness', 90)}%")
        night_info.set_halign(Gtk.Align.START)
        info_box.pack_start(night_info, False, False, 0)

        vbox.pack_start(info_box, False, False, 0)

        # Shortcut box
        shortcut_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)

        shortcut_label = Gtk.Label()
        shortcut_text = preset.get('shortcut', '')
        if shortcut_text:
            shortcut_label.set_text(f"Shortcut: {shortcut_text}")
        else:
            shortcut_label.set_text("No shortcut assigned")
        shortcut_label.set_halign(Gtk.Align.START)
        shortcut_box.pack_start(shortcut_label, False, False, 0)

        # Set/Change Shortcut button
        shortcut_button = Gtk.Button(label="Change Shortcut" if shortcut_text else "Set Shortcut")
        shortcut_button.connect("clicked", self._on_set_shortcut, index)
        shortcut_box.pack_start(shortcut_button, False, False, 0)

        vbox.pack_start(shortcut_box, False, False, 0)

        row.add(vbox)
        return row

    def _on_add_preset(self, button):
        """Show dialog to add a new preset"""
        dialog = PresetDialog(self.get_toplevel(), None)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            preset_data = dialog.get_preset_data()
            self.presets.append(preset_data)
            self._save_presets()
            self._rebuild_list()

        dialog.destroy()

    def _on_edit_preset(self, button, index):
        """Show dialog to edit a preset"""
        if index < 0 or index >= len(self.presets):
            return

        preset = self.presets[index]
        dialog = PresetDialog(self.get_toplevel(), preset)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            preset_data = dialog.get_preset_data()
            self.presets[index] = preset_data
            self._save_presets()
            self._rebuild_list()

        dialog.destroy()

    def _on_delete_preset(self, button, index):
        """Delete a preset after confirmation"""
        if index < 0 or index >= len(self.presets):
            return

        preset_name = self.presets[index].get('name', 'this preset')

        dialog = Gtk.MessageDialog(
            transient_for=self.get_toplevel(),
            flags=0,
            message_type=Gtk.MessageType.QUESTION,
            buttons=Gtk.ButtonsType.YES_NO,
            text=f"Delete preset '{preset_name}'?"
        )
        dialog.format_secondary_text("This action cannot be undone.")

        response = dialog.run()
        dialog.destroy()

        if response == Gtk.ResponseType.YES:
            self.presets.pop(index)
            self._save_presets()
            self._rebuild_list()

    def _on_set_shortcut(self, button, index):
        """Show dialog to set/change keyboard shortcut"""
        if index < 0 or index >= len(self.presets):
            return

        preset = self.presets[index]
        current_shortcut = preset.get('shortcut', '')

        dialog = ShortcutDialog(self.get_toplevel(), current_shortcut)
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            new_shortcut = dialog.get_shortcut()
            preset['shortcut'] = new_shortcut
            self._save_presets()
            self._rebuild_list()
        elif response == Gtk.ResponseType.REJECT:  # Remove button
            preset['shortcut'] = ''
            self._save_presets()
            self._rebuild_list()

        dialog.destroy()


class PresetDialog(Gtk.Dialog):
    """Dialog for creating/editing a preset"""

    def __init__(self, parent, preset=None):
        title = "Edit Preset" if preset else "Create Preset"
        Gtk.Dialog.__init__(self, title=title, transient_for=parent, flags=0)

        self.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            Gtk.STOCK_OK, Gtk.ResponseType.OK
        )

        self.set_default_size(400, 300)

        box = self.get_content_area()
        box.set_spacing(10)
        box.set_margin_start(10)
        box.set_margin_end(10)
        box.set_margin_top(10)
        box.set_margin_bottom(10)

        # Name entry
        name_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        name_box.pack_start(Gtk.Label(label="Name:"), False, False, 0)
        self.name_entry = Gtk.Entry()
        self.name_entry.set_text(preset.get('name', f"Preset {len(self.presets) if hasattr(self, 'presets') else 1}") if preset else "New Preset")
        name_box.pack_start(self.name_entry, True, True, 0)
        box.pack_start(name_box, False, False, 0)

        # Day temperature
        day_temp_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        day_temp_box.pack_start(Gtk.Label(label="Day Temperature (K):"), False, False, 0)
        self.day_temp_spin = Gtk.SpinButton()
        self.day_temp_spin.set_range(1000, 10000)
        self.day_temp_spin.set_increments(100, 500)
        self.day_temp_spin.set_value(preset.get('dayTemp', 6500) if preset else 6500)
        day_temp_box.pack_start(self.day_temp_spin, True, True, 0)
        box.pack_start(day_temp_box, False, False, 0)

        # Day brightness
        day_bright_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        day_bright_box.pack_start(Gtk.Label(label="Day Brightness (%):"), False, False, 0)
        self.day_bright_spin = Gtk.SpinButton()
        self.day_bright_spin.set_range(10, 100)
        self.day_bright_spin.set_increments(5, 10)
        self.day_bright_spin.set_value(preset.get('dayBrightness', 100) if preset else 100)
        day_bright_box.pack_start(self.day_bright_spin, True, True, 0)
        box.pack_start(day_bright_box, False, False, 0)

        # Night temperature
        night_temp_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        night_temp_box.pack_start(Gtk.Label(label="Night Temperature (K):"), False, False, 0)
        self.night_temp_spin = Gtk.SpinButton()
        self.night_temp_spin.set_range(1000, 10000)
        self.night_temp_spin.set_increments(100, 500)
        self.night_temp_spin.set_value(preset.get('nightTemp', 3500) if preset else 3500)
        night_temp_box.pack_start(self.night_temp_spin, True, True, 0)
        box.pack_start(night_temp_box, False, False, 0)

        # Night brightness
        night_bright_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
        night_bright_box.pack_start(Gtk.Label(label="Night Brightness (%):"), False, False, 0)
        self.night_bright_spin = Gtk.SpinButton()
        self.night_bright_spin.set_range(10, 100)
        self.night_bright_spin.set_increments(5, 10)
        self.night_bright_spin.set_value(preset.get('nightBrightness', 90) if preset else 90)
        night_bright_box.pack_start(self.night_bright_spin, True, True, 0)
        box.pack_start(night_bright_box, False, False, 0)

        # Preserve shortcut if editing
        self.shortcut = preset.get('shortcut', '') if preset else ''

        self.show_all()

    def get_preset_data(self):
        """Get the preset data from the dialog"""
        return {
            'name': self.name_entry.get_text(),
            'dayTemp': int(self.day_temp_spin.get_value()),
            'dayBrightness': int(self.day_bright_spin.get_value()),
            'nightTemp': int(self.night_temp_spin.get_value()),
            'nightBrightness': int(self.night_bright_spin.get_value()),
            'shortcut': self.shortcut
        }


class ShortcutDialog(Gtk.Dialog):
    """Dialog for setting keyboard shortcuts"""

    def __init__(self, parent, current_shortcut=''):
        Gtk.Dialog.__init__(self, title="Set Keyboard Shortcut", transient_for=parent, flags=0)

        self.add_buttons(
            Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
            "Remove", Gtk.ResponseType.REJECT,
            Gtk.STOCK_OK, Gtk.ResponseType.OK
        )

        self.set_default_size(400, 150)

        self.shortcut = current_shortcut

        box = self.get_content_area()
        box.set_spacing(10)
        box.set_margin_start(10)
        box.set_margin_end(10)
        box.set_margin_top(10)
        box.set_margin_bottom(10)

        # Instructions
        label = Gtk.Label()
        label.set_markup("<b>Press a key combination for the shortcut</b>\n\nExamples: <Super>F1, <Control><Alt>p")
        label.set_line_wrap(True)
        box.pack_start(label, False, False, 0)

        # Current shortcut display
        self.shortcut_label = Gtk.Label()
        self._update_shortcut_label()
        box.pack_start(self.shortcut_label, False, False, 0)

        # Entry to capture keypress
        self.entry = Gtk.Entry()
        self.entry.set_text(current_shortcut)
        self.entry.connect("key-press-event", self._on_key_press)
        box.pack_start(self.entry, False, False, 0)

        self.show_all()
        self.entry.grab_focus()

    def _on_key_press(self, widget, event):
        """Capture key press and convert to shortcut string"""
        keyval = event.keyval
        state = event.state

        # Get modifiers
        modifiers = []
        if state & Gdk.ModifierType.CONTROL_MASK:
            modifiers.append("<Control>")
        if state & Gdk.ModifierType.MOD1_MASK:  # Alt
            modifiers.append("<Alt>")
        if state & Gdk.ModifierType.SHIFT_MASK:
            modifiers.append("<Shift>")
        if state & Gdk.ModifierType.SUPER_MASK:
            modifiers.append("<Super>")

        # Get key name
        key_name = Gdk.keyval_name(keyval)

        # Build shortcut string
        if key_name and key_name not in ['Control_L', 'Control_R', 'Alt_L', 'Alt_R', 'Shift_L', 'Shift_R', 'Super_L', 'Super_R']:
            self.shortcut = ''.join(modifiers) + key_name
            self.entry.set_text(self.shortcut)
            self._update_shortcut_label()

        return True

    def _update_shortcut_label(self):
        """Update the shortcut display label"""
        if self.shortcut:
            self.shortcut_label.set_text(f"Current: {self.shortcut}")
        else:
            self.shortcut_label.set_text("No shortcut set")

    def get_shortcut(self):
        """Get the shortcut string"""
        return self.shortcut
