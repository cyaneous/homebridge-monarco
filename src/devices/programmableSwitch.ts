import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { MonarcoPlatform } from '../platform';

export class ProgrammableSwitchAccessory {
  private service: Service;
  private digitalInput: number;

  constructor(
    private readonly platform: MonarcoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly monarco,
  ) {
    this.digitalInput = accessory.context.device.digitalInput;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Monarco')
      .setCharacteristic(this.platform.Characteristic.Model, 'Programmable Switch')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Not Available');

    // get the ContactSensor service if it exists, otherwise create a new ContactSensor service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.StatelessProgrammableSwitch) ||
      this.accessory.addService(this.platform.Service.StatelessProgrammableSwitch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // register handlers for the Active Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent)
      .setProps({ minStep: 1, minValue: 0, maxValue: 0 })
      .onGet(this.getProgrammableSwitchEvent.bind(this));

    if (this.digitalInput < 1 || this.digitalInput > 4) {
      this.platform.log.error(accessory.context.name, ': invalid digital input in configuration:', this.digitalInput);
      return;
    }

    let tick = 0;
    let previousInputState = 0;
    monarco.on('rx', (data) => {
      tick++;

      if(tick % 5 === 0) {
        const inputState = data.digitalInputs[this.digitalInput-1];

        if (inputState !== previousInputState) {
          previousInputState = inputState;
          this.service.updateCharacteristic(this.platform.Characteristic.ProgrammableSwitchEvent, 
            this.platform.Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS);
        }
      }
    });
  }

  async getProgrammableSwitchEvent(): Promise<CharacteristicValue> {
    return 0;
  }

}
