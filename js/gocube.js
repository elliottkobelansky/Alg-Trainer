// also compatible with Rubik's Connect. Adapted from https://github.com/AshleyF/briefcubing/blob/master/btcube.js

const GOCUBE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const GOCUBE_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

const gocubeTwists = ["B", "B'", "F", "F'", "U", "U'", "D", "D'", "R", "R'", "L", "L'"];

class GoCube extends EventEmitter {
  constructor() {
    super();
    this._onCharacteristicValueChanged = this._onCharacteristicValueChanged.bind(this);
    this._onDisconnected = this._onDisconnected.bind(this);
  }

  async connect(device, server) {
    const service = await server.getPrimaryService(GOCUBE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(GOCUBE_CHARACTERISTIC_UUID);
    characteristic.addEventListener('characteristicvaluechanged', this._onCharacteristicValueChanged);
    await characteristic.startNotifications();

    device.addEventListener('gattserverdisconnected', this._onDisconnected);
  }

  /**
   * Disconnects from the GiiKER cube. Will fire the `disconnected` event once done.
   */
  disconnect() {
    if (!this._device) {
        return;
    }
    this._device.gatt.disconnect();
  }

  _onDisconnected() {
    this.device.removeEventListener('characteristicvaluechanged', this._onCharacteristicValueChanged);
    this.device.removeEventListener('gattserverdisconnected', this._onDisconnected);
    this._device = null;
    this.emit('disconnected');
  }

  _onCharacteristicValueChanged(event) {
    try {
      var val = event.target.value;
      var len = val.byteLength;
      if (len == 8 && val.getUint8(1) /* payload len */ == 6) {
          this.emit('move', {notation:gocubeTwists[val.getUint8(3)]});
      }
    } catch (ex) {
      alert("ERROR (K): " + ex.message);
    }
  }
}