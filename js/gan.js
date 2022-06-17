// cobbled from giiker.js and https://github.com/cs0x7f/cstimer/ and https://github.com/AshleyF/briefcubing/

const GAN_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const GAN_CHARACTERISTIC_UUID = "0000fff5-0000-1000-8000-00805f9b34fb";
const GAN_SERVICE_UUID_META = "0000180a-0000-1000-8000-00805f9b34fb";
const GAN_CHARACTERISTIC_VERSION = "00002a28-0000-1000-8000-00805f9b34fb";
const GAN_CHARACTERISTIC_UUID_HARDWARE = "00002a23-0000-1000-8000-00805f9b34fb";
const GAN_ENCRYPTION_KEYS = [
    "NoRgnAHANATADDWJYwMxQOxiiEcfYgSK6Hpr4TYCs0IG1OEAbDszALpA",
    "NoNg7ANATFIQnARmogLBRUCs0oAYN8U5J45EQBmFADg0oJAOSlUQF0g"];

// currently just spits out the outer quarter block turn which is all the trainer is using
// doesn't do anything with battery, cube state, or other bells and whistles
class Gan extends EventEmitter {
  constructor() {
    super();
    this._onDisconnected = this._onDisconnected.bind(this);
    this.ganDecoder = null;
    this.lastCount = -1;
  }

  async connect(device, server) {
    this.ganDecoder = null;
    const meta = await server.getPrimaryService(GAN_SERVICE_UUID_META);//service
    const versionCharacteristic = await meta.getCharacteristic(GAN_CHARACTERISTIC_VERSION);//characteristic
    const versionValue = await versionCharacteristic.readValue(); // value
    const version = versionValue.getUint8(0) << 16 | versionValue.getUint8(1) << 8 | versionValue.getUint8(2);
    if (version > 0x010007 && (version & 0xfffe00) == 0x010000) {
        const hardwareCharacteristic = await meta.getCharacteristic(GAN_CHARACTERISTIC_UUID_HARDWARE);
        const hardwareValue = await hardwareCharacteristic.readValue();
        var key = GAN_ENCRYPTION_KEYS[version >> 8 & 0xff];
        if (!key) {
            alert("Unsupported GAN cube with unknown encryption key.");
            return;
        }
        key = JSON.parse(LZString.decompressFromEncodedURIComponent(key));
        for (var i = 0; i < 6; i++) {
            key[i] = (key[i] + hardwareValue.getUint8(5 - i)) & 0xff;
        }
        this.ganDecoder = new aes128(key);
    }
    var cubeService = await server.getPrimaryService(GAN_SERVICE_UUID); //_systemService
    var cubeCharacteristic = await cubeService.getCharacteristic(GAN_CHARACTERISTIC_UUID);
    await onPollGanCubeCharacteristic(cubeCharacteristic,this);
  
    device.addEventListener('gattserverdisconnected', this._onDisconnected);

    this._device = device;
  }

	/**
	 * Disconnects from the Gan cube. Will fire the `disconnected` event once done.
	 */
  disconnect() {
    if (!this._device) {
      return;
    }
    this._device.gatt.disconnect();
  }

  _onDisconnected() {
    this._device = null;
    this.emit('disconnected');
  }
}

async function onPollGanCubeCharacteristic(cubeCharacteristic, cube) {
  try {
      const twists = ["U", "?", "U'", "R", "?", "R'", "F", "?", "F'", "D", "?", "D'", "L", "?", "L'", "B", "?", "B'"]
      var val;
      try
      {
          val = await cubeCharacteristic.readValue();
          if (cube.ganDecoder != null) {
              var decoded = [];
              for (var i = 0; i < val.byteLength; i++) {
                  decoded[i] = val.getUint8(i);
              }
              if (decoded.length > 16) {
                  decoded = decoded.slice(0, decoded.length - 16).concat(cube.ganDecoder.decrypt(decoded.slice(decoded.length - 16)));
              }
              cube.ganDecoder.decrypt(decoded);
              val = new DataView(new Uint8Array(decoded).buffer);
          }
      } catch {
          return; // disconnected
      }
      var count = val.getUint8(12);
      if (cube.lastCount == -1) cube.lastCount = count;
      if (count != cube.lastCount) {
          var missed = (count - cube.lastCount) & 0xff;
          if (missed < 6) {
              cube.lastCount = count;
              for (var i = 19 - missed; i < 19; i++) {
                  var t = val.getUint8(i);
                  cube.emit('move', {face:'?',amount:-1,notation:twists[t]});
              }
          }
      }
      window.setTimeout(async function(){await onPollGanCubeCharacteristic(cubeCharacteristic, cube);}, 50);
  } catch (ex) {
      alert("ERROR (G): " + ex.message);
  }
}

var aes128 = (function() {
  var sbox = [99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22];
  var sboxI = [];
  var shiftTabI = [0, 13, 10, 7, 4, 1, 14, 11, 8, 5, 2, 15, 12, 9, 6, 3];
  var xtime = [];
  function init() {
      if (xtime.length != 0) return;
      for (var i = 0; i < 256; i++) {
          sboxI[sbox[i]] = i;
      }
      for (var i = 0; i < 128; i++) {
          xtime[i] = i << 1;
          xtime[128 + i] = (i << 1) ^ 0x1b;
      }
  }
  function AES128(key) {
      init();
      var exKey = key.slice();
      var Rcon = 1;
      for (var i = 16; i < 176; i += 4) {
          var tmp = exKey.slice(i - 4, i);
          if (i % 16 == 0) {
              tmp = [sbox[tmp[1]] ^ Rcon, sbox[tmp[2]], sbox[tmp[3]], sbox[tmp[0]]];
              Rcon = xtime[Rcon];
          }
          for (var j = 0; j < 4; j++) {
              exKey[i + j] = exKey[i + j - 16] ^ tmp[j];
          }
      }
      this.key = exKey;
  };
  function shiftSubAdd(state, rkey) {
      var state0 = state.slice();
      for (var i = 0; i < 16; i++) {
          state[i] = sboxI[state0[shiftTabI[i]]] ^ rkey[i];
      }
  }
  AES128.prototype.decrypt = function(block) {
      var rkey = this.key.slice(160, 176);
      for (var i = 0; i < 16; i++) {
          block[i] ^= rkey[i];
      }
      for (var i = 144; i >= 16; i -= 16) {
          shiftSubAdd(block, this.key.slice(i, i + 16));
          for (var j = 0; j < 16; j += 4) {
              var s0 = block[j + 0];
              var s1 = block[j + 1];
              var s2 = block[j + 2];
              var s3 = block[j + 3];
              var h = s0 ^ s1 ^ s2 ^ s3;
              var xh = xtime[h];
              var h1 = xtime[xtime[xh ^ s0 ^ s2]] ^ h;
              var h2 = xtime[xtime[xh ^ s1 ^ s3]] ^ h;
              block[j + 0] ^= h1 ^ xtime[s0 ^ s1];
              block[j + 1] ^= h2 ^ xtime[s1 ^ s2];
              block[j + 2] ^= h1 ^ xtime[s2 ^ s3];
              block[j + 3] ^= h2 ^ xtime[s3 ^ s0];
          }
      }
      shiftSubAdd(block, this.key.slice(0, 16));
      return block;
  };
  return AES128;
})();
