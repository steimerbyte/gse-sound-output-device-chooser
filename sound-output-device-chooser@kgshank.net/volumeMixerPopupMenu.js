/* 
 * Original Author: Brendan Early (https://github.com/mymindstorm/gnome-volume-mixer)
 * Modified by Burak Sener
 */

import GLib from 'gi://GLib';
import Gvc from 'gi://Gvc';
import St from 'gi://St';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import {Slider} from 'resource:///org/gnome/shell/ui/slider.js';
import * as Lib from './convenience.js';
const {MixerSinkInput} = Gvc;
export var VolumeMixerPopupMenuInstance = class VolumeMixerPopupMenuInstance extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        this._applicationStreams = {};
        this._subMenus = {};

        // The PopupSeparatorMenuItem needs something above and below it or it won't display
        this._hiddenItem = new PopupMenu.PopupBaseMenuItem();
        this._hiddenItem.set_height(0);
        this.addMenuItem(this._hiddenItem);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._control = Volume.getMixerControl();
        this._streamAddedEventId = this._control.connect("stream-added", this._streamAdded.bind(this));
        this._streamRemovedEventId = this._control.connect("stream-removed", this._streamRemoved.bind(this));

        this._updateStreams();
    }

    _streamAdded(control, id) {
        if (id in this._applicationStreams) {
            return;
        }
        const stream = control.lookup_stream_id(id);
        if (!stream || stream.is_event_stream || !(stream instanceof MixerSinkInput)) {
            return;
        }

        //pactl list short sink-inputs
        var sinkInputId = stream.get_index();

        this._applicationStreams[id] = new ApplicationStreamSlider(stream);
        this.addMenuItem(this._applicationStreams[id].item);


        let sinks = Lib.getSinks();

        let currentSinkLabel = "Default Output";
        let [, siOut] = GLib.spawn_command_line_sync("pactl list short sink-inputs");
        let siLines = new TextDecoder().decode(siOut).trim().split("\n");
        for (let line of siLines) {
            let parts = line.split("\t");
            if (parts[0] === String(sinkInputId)) {
                let currentSink = sinks.find(s => s.id === parts[1]);
                if (currentSink)
                    currentSinkLabel = currentSink.name;
                break;
            }
        }

        const menuItem = new PopupMenu.PopupSubMenuMenuItem(currentSinkLabel, true, {});
        menuItem.set_style("min-width: 3em;margin-left: 3em;");
        sinks.forEach(sink => {
            if (sink["name"] !== undefined) {
                menuItem.menu.addAction(sink["name"], () => {
                    GLib.spawn_command_line_sync("pactl move-sink-input " + sinkInputId + " " + sink.id);
                    menuItem.label.text = sink["name"];
                });
            }
        });
        this._subMenus[id] = menuItem;
        this.addMenuItem(menuItem);
    }

    _streamRemoved(_control, id) {
        if (id in this._applicationStreams) {
            this._applicationStreams[id].item.destroy();
            delete this._applicationStreams[id];
            this._subMenus[id].destroy();
            delete this._subMenus[id];
        }        
    }

    _updateStreams() {
        for (const id in this._applicationStreams) {
            this._applicationStreams[id].item.destroy();
            delete this._applicationStreams[id];
            this._subMenus[id].destroy();
            delete this._subMenus[id];
        }       
        for (const stream of this._control.get_streams()) {
            this._streamAdded(this._control, stream.get_id());
        }
    }

    destroy() {
        this._control.disconnect(this._streamAddedEventId);
        this._control.disconnect(this._streamRemovedEventId);
        super.destroy();
    }
}

class ApplicationStreamSlider {
    constructor(stream) {
        this.item = new PopupMenu.PopupBaseMenuItem({activate: false});
        this.item.add_child(new St.Icon({icon_name: stream.get_icon_name() || 'audio-x-generic-symbolic', style_class: 'popup-menu-icon'}));
        const name = stream.get_name() || stream.get_description() || 'Audio';
        this.item.add_child(new St.Label({text: name}));
        const max = Volume.getMixerControl().get_vol_max_norm();
        const slider = new Slider(stream.is_muted ? 0 : stream.volume / max);
        slider.x_expand = true;
        this.item.add_child(slider);
        let syncing = false;
        const sync = () => {
            syncing = true;
            slider.value = stream.is_muted ? 0 : stream.volume / max;
            syncing = false;
        };
        const volumeId = stream.connect('notify::volume', sync);
        const muteId = stream.connect('notify::is-muted', sync);
        slider.connect('notify::value', () => {
            if (syncing) return;
            stream.volume = Math.round(slider.value * max);
            stream.push_volume();
            stream.change_is_muted(slider.value === 0);
        });
        this.item.connect('destroy', () => {
            stream.disconnect(volumeId);
            stream.disconnect(muteId);
        });
    }
}
