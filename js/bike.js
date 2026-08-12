const FTMS = "00001826-0000-1000-8000-00805f9b34fb";
const BIKE_DATA = "00002ad2-0000-1000-8000-00805f9b34fb";
const STATUS = "00002ada-0000-1000-8000-00805f9b34fb";
const RESISTANCE_RANGE = "00002ad6-0000-1000-8000-00805f9b34fb";

export class BikeEngine {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.dataCharacteristic = null;
    this.statusCharacteristic = null;
    this.wakeLock = null;
    this.state = {
      connected: false,
      name: null,
      rpm: 0,
      power: 0,
      speed: 0,
      distance: 0,
      resistance: null,
      elapsed: 0,
      lastPacketAt: 0
    };
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn({ ...this.state });
    return () => this.listeners.delete(fn);
  }

  emit() {
    const snapshot = { ...this.state };
    this.listeners.forEach(fn => fn(snapshot));
  }

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [FTMS] }]
    });

    this.device.addEventListener("gattserverdisconnected", () => {
      this.state.connected = false;
      this.emit();
    });

    this.server = await this.device.gatt.connect();
    this.service = await this.server.getPrimaryService(FTMS);

    this.state.connected = true;
    this.state.name = this.device.name || "SM-120";

    this.dataCharacteristic = await this.service.getCharacteristic(BIKE_DATA);
    this.dataCharacteristic.addEventListener("characteristicvaluechanged", e => {
      this.parseBikeData(e.target.value);
    });
    await this.dataCharacteristic.startNotifications();

    try {
      this.statusCharacteristic = await this.service.getCharacteristic(STATUS);
      this.statusCharacteristic.addEventListener("characteristicvaluechanged", e => {
        this.parseStatus(e.target.value);
      });
      await this.statusCharacteristic.startNotifications();
    } catch (_) {
      // Status is useful but not required for the game.
    }

    await this.requestWakeLock();
    this.emit();
    return { ...this.state };
  }

  async requestWakeLock() {
    if (!("wakeLock" in navigator)) return false;
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      return true;
    } catch (_) {
      return false;
    }
  }

  parseBikeData(data) {
    if (data.byteLength < 2) return;

    const flags = data.getUint16(0, true);
    let offset = 2;

    // FTMS Indoor Bike Data: More Data=0 means instantaneous speed is present.
    if (!(flags & 0x0001)) {
      if (offset + 2 > data.byteLength) return;
      this.state.speed = data.getUint16(offset, true) / 100;
      offset += 2;
    }

    if (flags & 0x0002) offset += 2; // average speed

    if (flags & 0x0004) {
      if (offset + 2 > data.byteLength) return;
      this.state.rpm = data.getUint16(offset, true) / 2;
      offset += 2;
    }

    if (flags & 0x0008) offset += 2; // average cadence

    if (flags & 0x0010) {
      if (offset + 3 > data.byteLength) return;
      this.state.distance =
        data.getUint8(offset) |
        (data.getUint8(offset + 1) << 8) |
        (data.getUint8(offset + 2) << 16);
      offset += 3;
    }

    // Resistance is not present in the packets we've observed from this bike;
    // it arrives through Fitness Machine Status below.
    if (flags & 0x0020) {
      if (offset + 2 > data.byteLength) return;
      this.state.resistance = data.getInt16(offset, true) / 10;
      offset += 2;
    }

    if (flags & 0x0040) {
      if (offset + 2 > data.byteLength) return;
      this.state.power = data.getInt16(offset, true);
      offset += 2;
    }

    if (flags & 0x0080) offset += 2; // average power
    if (flags & 0x0100) offset += 2; // total energy
    if (flags & 0x0200) offset += 2; // heart rate
    if (flags & 0x0400) offset += 1; // metabolic equivalent

    if (flags & 0x0800) {
      if (offset + 2 <= data.byteLength) {
        this.state.elapsed = data.getUint16(offset, true);
      }
    }

    this.state.lastPacketAt = Date.now();
    this.emit();
  }

  parseStatus(data) {
    if (data.byteLength < 4) return;

    const event = data.getUint8(0);
    const value = data.getInt16(2, true);

    // On the SM-120, the observed 0x21 status packets carry the resistance
    // level in the following 16-bit value: 0x0003 => level 3, etc.
    if (event === 0x21 && value >= 0 && value <= 32) {
      this.state.resistance = value;
      this.emit();
    }
  }
}
