import * as Lib from './convenience.js';
export const HIDE_ON_SINGLE_DEVICE = "hide-on-single-device";
export const HIDE_MENU_ICONS = "hide-menu-icons";
export const SHOW_PROFILES = "show-profiles";
export const PORT_SETTINGS = "ports-settings";
export const SHOW_INPUT_SLIDER = "show-input-slider";
export const SHOW_INPUT_DEVICES = "show-input-devices";
export const SHOW_OUTPUT_DEVICES = "show-output-devices";
export const ENABLE_LOG = "enable-log";
export const NEW_PROFILE_ID_DEPRECATED = "new-profile-indentification";
export const NEW_PROFILE_ID = "new-profile-identification";
export const EXPAND_VOL_MENU = "expand-volume-menu";
export const CANNOT_ACTIVATE_HIDDEN_DEVICE = "cannot-activate-hidden-device";
export const OMIT_DEVICE_ORIGIN = "omit-device-origins";
export const INTEGRATE_WITH_SLIDER = "integrate-with-slider";
export const SHOW_VOLUME_MIXER = "show-volume-mixer";

export const ICON_THEME = "icon-theme";
export const ICON_THEME_COLORED = "colored";
export const ICON_THEME_MONOCHROME = "monochrome";
export const ICON_THEME_NONE = "none";

export const DISPLAY_OPTIONS = { SHOW_ALWAYS: 1, HIDE_ALWAYS: 2, DEFAULT: 3, INITIAL: -1 };

const PORT_SETTINGS_VERSION = 3;

export function init() {}

export function getPortsFromSettings(_settings) {
    //_d(_settings.get_string(PORT_SETTINGS));
    let obj = JSON.parse(_settings.get_string(PORT_SETTINGS));
    let currentSettingsVersion = PORT_SETTINGS_VERSION;
    if (Array.isArray(obj)) {
        currentSettingsVersion = 1;
    }
    else {
        currentSettingsVersion = obj.version;
    }

    if (currentSettingsVersion < PORT_SETTINGS_VERSION) {
        obj = migratePortSettings(currentSettingsVersion, obj, _settings);
    }
    return obj.ports;
}

export function setPortsSettings(ports, _settings) {
    let settingsObj = { "version": PORT_SETTINGS_VERSION };
    settingsObj.ports = ports;
    //_d(JSON.stringify(settingsObj));
    _settings.set_string(PORT_SETTINGS, JSON.stringify(settingsObj));
    return settingsObj;
}

export function getPortDisplayName(port) {
    return `${port.human_name} - ${port.card_description}`;
}

export function migratePortSettings(currVersion, currSettings, _settings) {
    let ports = [];
    let _lPorts = Lib.getPorts(true).slice();
    switch (currVersion) {
        case 1:
            for (let port of currSettings) {
                for (var i = 0; i < _lPorts.length; i++) {
                    let _lPort = _lPorts[i];
                    if (port.human_name == _lPort.human_name && port.name == _lPort.name) {
                        port.card_name = _lPort.card_name;
                        port.card_description = _lPort.card_description;
                        port.display_name = getPortDisplayName(_lPort);
                        _lPorts.splice(i, 1);
                        ports.push(port);
                        break;
                    }
                }
            }
            break;

        case 2:
            for (let port of currSettings.ports) {
                for (var i = 0; i < _lPorts.length; i++) {
                    let _lPort = _lPorts[i];
                    if (port.human_name == _lPort.human_name && port.name == _lPort.name && port.card_name == _lPort.card_name) {
                        port.card_description = _lPort.card_description;
                        _lPorts.splice(i, 1);
                        ports.push(port);
                        break;
                    }
                }
            }
            break;
    }
    return setPortsSettings(ports, _settings);
}

