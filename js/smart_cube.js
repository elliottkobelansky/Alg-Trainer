class EventEmitter {
    constructor() {
      this.listeners = {};
    }
  
    on(label, callback) {
      if (!this.listeners[label]) {
        this.listeners[label] = [];
      }
      this.listeners[label].push(callback);
    }
  
    off(label, callback) {
      let listeners = this.listeners[label];
  
      if (listeners && listeners.length > 0) {
        let index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
          this.listeners[label] = listeners;
          return true;
        }
      }
      return false;
    }
  
    emit(label, ...args) {
      let listeners = this.listeners[label];
  
      if (listeners && listeners.length > 0) {
        listeners.forEach((listener) => {
          listener(...args);
        });
        return true;
      }
      return false;
    }
}

const connect = async () => {
    if (!window.navigator) {
        throw new Error('window.navigator is not accesible. Maybe you\'re running Node.js?');
      }
  
      if (!window.navigator.bluetooth) {
        throw new Error('Web Bluetooth API is not accesible');
      }
    const device = await window.navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Gi' }, { namePrefix: 'GAN-' }, { namePrefix: 'GoCube_'}, { namePrefix: 'Rubiks_'}],
        optionalServices: [
            SERVICE_UUID, SYSTEM_SERVICE_UUID,
            GAN_SERVICE_UUID, GAN_SERVICE_UUID_META,
            GOCUBE_SERVICE_UUID
        ]
        });

    var smartCube = null;
    const server = await device.gatt.connect();
    if(server.device.name.startsWith('Gi')){
        smartCube = new Giiker();
    }
    if(server.device.name.startsWith('GAN-')){
        smartCube = new Gan();
    }
    if(server.device.name.startsWith('GoCube_') || server.device.name.startsWith('Rubiks_')){
      smartcube = new GoCube();
    }
    
    if(smartCube){
        await smartCube.connect(device, server);
        return smartCube;
    } else{
        throw new Error('Cube not compatible')
    }
};
