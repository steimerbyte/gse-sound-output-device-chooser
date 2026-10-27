import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {SoundDeviceChooserBase} from './base.js';
import {VolumeMixerPopupMenuInstance} from './volumeMixerPopupMenu.js';

class DeviceChooser extends SoundDeviceChooserBase {
    lookupDeviceById(control, id) {
        return this.deviceType === 'output' ? control.lookup_output_id(id) : control.lookup_input_id(id);
    }
    changeDevice(control, device) {
        if (this.deviceType === 'output') control.change_output(device);
        else control.change_input(device);
    }
    getDefaultStream(control) {
        return this.deviceType === 'output' ? control.get_default_sink() : control.get_default_source();
    }
    getDefaultIcon() {
        return this.deviceType === 'output' ? 'audio-card-symbolic' : 'audio-input-microphone-symbolic';
    }
}

const ChooserToggle = GObject.registerClass(class ChooserToggle extends QuickMenuToggle {
    _init() {
        super._init({title: 'Sound Devices', iconName: 'audio-card-symbolic', toggleMode: false});
        this.connect('clicked', () => this.menu.open());
        this.menu.setHeader('audio-card-symbolic', 'Sound Devices');
    }
});

export default class SoundDeviceChooserExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._bindings = [];
        this._choosers = [];
        this._indicator = new SystemIndicator();
        this._toggle = new ChooserToggle();
        this._indicator.quickSettingsItems.push(this._toggle);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        for (const type of ['output', 'input']) {
            const chooser = new DeviceChooser(type);
            this._choosers.push(chooser);
            this._toggle.menu.addMenuItem(chooser.menuItem);
            for (const [direction, step] of [['forward', 1], ['backward', -1]]) {
                const name = `cycle-${type}-${direction}`;
                Main.wm.addKeybinding(name, this._settings, Meta.KeyBindingFlags.NONE,
                    Shell.ActionMode.NORMAL, () => this._cycle(chooser, step));
                this._bindings.push(name);
            }
        }
        this._mixerChangedId = this._settings.connect('changed::show-volume-mixer', () => this._updateMixer());
        this._updateMixer();
        if (!this._installInputSliderOverride())
            this._startInputSliderPoll();
    }

    /**
     * The panel creates the volume indicators asynchronously
     * (Panel._setupIndicators() is an async function), so at enable() time
     * Main.panel.statusArea.quickSettings._volumeInput may not exist yet.
     * Try once, and if it is not there yet poll for a bounded amount of time.
     */
    _installInputSliderOverride() {
        const input = Main.panel.statusArea.quickSettings?._volumeInput?._input;
        if (!input)
            return false;

        this._input = input;
        this._originalInputVisibility = input._shouldBeVisible;
        const settings = this._settings;
        const original = this._originalInputVisibility;
        input._shouldBeVisible = function () {
            return (settings.get_boolean('show-input-slider') && this._stream != null) || original.call(this);
        };
        this._inputChangedId = this._settings.connect('changed::show-input-slider', () => input._maybeShowInput());
        input._maybeShowInput();
        return true;
    }

    _startInputSliderPoll() {
        if (this._inputPollId)
            return;

        let attempts = 0;
        this._inputPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            if (this._installInputSliderOverride() || ++attempts >= 20) {
                this._inputPollId = 0;
                return GLib.SOURCE_REMOVE;
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _cycle(chooser, step) {
        const devices = chooser._getAvailableDevices();
        const index = devices.findIndex(device => device.activeDevice);
        if (devices.length < 2 || index < 0) return;
        const device = devices[(index + step + devices.length) % devices.length];
        chooser._changeDeviceBase(device.id);
    }

    _updateMixer() {
        this._mixer?.destroy();
        this._mixer = null;
        if (this._settings.get_boolean('show-volume-mixer')) {
            this._mixer = new VolumeMixerPopupMenuInstance();
            this._toggle.menu.addMenuItem(this._mixer);
        }
    }

    disable() {
        for (const name of this._bindings ?? []) Main.wm.removeKeybinding(name);
        if (this._mixerChangedId) this._settings.disconnect(this._mixerChangedId);
        if (this._inputChangedId) this._settings.disconnect(this._inputChangedId);
        if (this._inputPollId) {
            GLib.source_remove(this._inputPollId);
            this._inputPollId = 0;
        }
        if (this._input) {
            this._input._shouldBeVisible = this._originalInputVisibility;
            this._input._maybeShowInput();
        }
        this._mixer?.destroy();
        for (const chooser of this._choosers ?? []) chooser.destroy();
        this._toggle?.destroy();
        this._indicator?.destroy();
        this._bindings = [];
        this._choosers = [];
        this._mixerChangedId = this._inputChangedId = 0;
        this._mixer = this._toggle = this._indicator = this._input = this._settings = null;
        this._originalInputVisibility = null;
    }
}
