import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { MonarcoPlatform } from '../platform';

export class ContactSensorAccessory {
  private service: Service;
  private digitalInput: number;

  private state = {
    ContactSensorState: 0,
  };

  constructor(
    private readonly platform: MonarcoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly monarco,
  ) {
    this.digitalInput = accessory.context.device.digitalInput;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Monarco')
      .setCharacteristic(this.platform.Characteristic.Model, 'Contact Sensor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Not Available');

    // get the ContactSensor service if it exists, otherwise create a new ContactSensor service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.ContactSensor) ||
      this.accessory.addService(this.platform.Service.ContactSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // register handlers for the Active Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.ContactSensorState)
      .onGet(this.getContactSensorState.bind(this));

    if (this.digitalInput < 1 || this.digitalInput > 4) {
      this.platform.log.error(accessory.context.name, ': invalid digital input in configuration:', this.digitalInput);
      return;
    }

    let tick = 0;
    monarco.on('rx', (data) => {
      tick++;

      if(tick % 5 === 0) {
        const contactSensorState = data.digitalInputs[this.digitalInput-1] ?
          this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
          this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;

        if (this.state.ContactSensorState !== contactSensorState) {
          this.state.ContactSensorState = contactSensorState;
          this.service.updateCharacteristic(this.platform.Characteristic.ContactSensorState, contactSensorState);
        }
      }
    });
  }

  async getContactSensorState(): Promise<CharacteristicValue> {
    const contactSensorState = this.state.ContactSensorState;

    this.platform.log.debug('Get Characteristic ContactSensorState ->', contactSensorState);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return contactSensorState;
  }

}
