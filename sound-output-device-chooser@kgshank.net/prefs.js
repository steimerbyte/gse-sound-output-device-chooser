import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SoundDeviceChooserPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Sound Devices', icon_name: 'audio-card-symbolic'});
        const group = new Adw.PreferencesGroup({title: 'Devices and volume'});
        page.add(group);
        const schema = settings.settings_schema;
        const switches = ['show-output-devices', 'show-input-devices', 'show-input-slider',
            'hide-on-single-device', 'hide-menu-icons', 'show-profiles', 'omit-device-origins',
            'cannot-activate-hidden-device', 'show-volume-mixer', 'new-profile-identification', 'enable-log'];
        for (const key of switches) {
            const info = schema.get_key(key);
            const row = new Adw.SwitchRow({title: info.get_summary() || key, subtitle: info.get_description() || ''});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }
        const themes = ['colored', 'monochrome', 'none'];
        const icons = new Adw.ComboRow({title: 'Device icons', model: Gtk.StringList.new(themes),
            selected: Math.max(0, themes.indexOf(settings.get_string('icon-theme')))});
        icons.connect('notify::selected', () => settings.set_string('icon-theme', themes[icons.selected]));
        group.add(icons);
        const shortcuts = new Adw.PreferencesGroup({title: 'Keyboard shortcuts', description: 'Use GTK accelerators, for example <Super><Shift>a. Leave empty to disable.'});
        page.add(shortcuts);
        for (const type of ['output', 'input']) {
            for (const direction of ['forward', 'backward']) {
                const key = `cycle-${type}-${direction}`;
                const row = new Adw.EntryRow({title: schema.get_key(key).get_summary() || key,
                    text: settings.get_strv(key).join(', '), show_apply_button: true});
                row.connect('apply', () => {
                    const values = row.text.split(',').map(value => value.trim()).filter(Boolean);
                    if (values.every(value => Gtk.accelerator_parse(value)[0])) {
                        settings.set_strv(key, values);
                        row.remove_css_class('error');
                    } else row.add_css_class('error');
                });
                shortcuts.add(row);
            }
        }
        const portsGroup = new Adw.PreferencesGroup({title: 'Port visibility'});
        page.add(portsGroup);
        try {
            const helper = this.dir.get_child('utils/pa_helper.py').get_path();
            const [, output, , status] = GLib.spawn_sync(null, ['python3', helper], null,
                GLib.SpawnFlags.SEARCH_PATH, null);
            if (status !== 0) throw new Error('Unable to read audio ports');
            const ports = JSON.parse(new TextDecoder().decode(output)).ports;
            const saved = JSON.parse(settings.get_string('ports-settings'));
            const savedPorts = Array.isArray(saved) ? saved : saved.ports ?? [];
            for (const port of ports) {
                const match = savedPorts.find(item => item.name === port.name &&
                    item.human_name === port.human_name &&
                    (!item.card_name || item.card_name === port.card_name));
                port.display_option = match?.display_option ?? 3;
                const row = new Adw.ComboRow({title: port.human_name || port.name,
                    subtitle: port.card_description || port.card_name || '',
                    model: Gtk.StringList.new(['Always show', 'Always hide', 'Automatic']),
                    selected: Math.max(0, Math.min(2, port.display_option - 1))});
                row.connect('notify::selected', () => {
                    port.display_option = row.selected + 1;
                    const current = JSON.parse(settings.get_string('ports-settings'));
                    const previous = Array.isArray(current) ? current : current.ports ?? [];
                    const remaining = previous.filter(item => !(item.name === port.name &&
                        item.human_name === port.human_name && item.card_name === port.card_name));
                    settings.set_string('ports-settings', JSON.stringify({version: 3, ports: [...remaining, port]}));
                });
                portsGroup.add(row);
            }
        } catch (error) {
            portsGroup.add(new Adw.ActionRow({title: 'Port settings unavailable',
                subtitle: 'Install Python 3 and pactl to configure port visibility.'}));
        }
        window.add(page);
    }
}
