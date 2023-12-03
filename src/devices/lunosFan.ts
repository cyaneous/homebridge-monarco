import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { MonarcoPlatform } from '../platform';

const LUNOS_FAN_V = {
  AUTO: 0.0, // 0.0 - 0.4 (the controller works independently, according to internal sensors)
  STAGE_0: 0.7, // 0.6 - 0.9 (off)
  STAGE_1: 1.2, // 1.1 - 1.4
  STAGE_2: 1.7, // 1.6 - 1.9
  STAGE_3: 2.2, // 2.1 - 2.4
  STAGE_4: 2.7, // 2.6 - 2.9
  STAGE_5: 3.2, // 3.1 - 3.4
  STAGE_6: 3.7, // 3.6 - 3.9
  STAGE_7: 4.2, // 4.1 - 4.4
  STAGE_8: 4.7, // 4.6 - 4.9
  SUMMER_OFFSET: 5.0,
};

export class LunosFanAccessory {
  private service: Service;
  private kind: string;
  private analogOutput: number;
  private model: string;

  private state = {
    Active: false,
    RotationSpeed: 0,
    SwingMode: 0,
    TargetFanState: 1,
  };

  constructor(
    private readonly platform: MonarcoPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly monarco,
  ) {
    this.kind = accessory.context.device.kind;
    this.analogOutput = accessory.context.device.analogOutput;

    switch (this.kind) {
      case 'lunosE2':
        this.model = 'Lunos e2';
        break;
      case 'lunosEgo':
        this.model = 'Lunos ego';
        break;
      default:
        this.model = 'Unknown';
        this.platform.log.error(accessory.context.name, ': unrecognized model in configuration:', this.kind);
    }

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Lunos')
      .setCharacteristic(this.platform.Characteristic.Model, this.model)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Not Available');

    // get the Fanv2 service if it exists, otherwise create a new Fanv2 service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Fanv2) || this.accessory.addService(this.platform.Service.Fanv2);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // register handlers for the Active Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    // register handlers for the RotationSpeed Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({ minStep: 25, minValue: 0, maxValue: 100 })
      .onGet(this.getRotationSpeed.bind(this))
      .onSet(this.setRotationSpeed.bind(this));

    // register handlers for the SwingMode Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.SwingMode)
      .onGet(this.getSwingMode.bind(this))
      .onSet(this.setSwingMode.bind(this));

    // register handlers for the TargetFanState Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.TargetFanState)
      .onGet(this.getTargetFanState.bind(this))
      .onSet(this.setTargetFanState.bind(this));

    if (this.analogOutput < 1 || this.analogOutput > 2) {
      this.platform.log.error(accessory.context.name, ': invalid analog output in configuration:', this.analogOutput);
      return;
    }

    let tick = 0;
    monarco.on('rx', () => {
      tick++;

      if(tick % 64 === 0) {
        this.updateAnalogOutputState();
      }
    });
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.info('Set Characteristic Active ->', value);

    this.state.Active = value as boolean;
  }

  async getActive(): Promise<CharacteristicValue> {
    const active = this.state.Active;

    this.platform.log.info('Get Characteristic Active ->', active);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return active;
  }

  async setRotationSpeed(value: CharacteristicValue) {
    this.platform.log.info('Set Characteristic RotationSpeed -> ', value);
    this.state.RotationSpeed = value as number;
  }

  async getRotationSpeed(): Promise<CharacteristicValue> {
    const rotationSpeed = this.state.RotationSpeed;

    this.platform.log.info('Get Characteristic RotationSpeed ->', rotationSpeed);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return rotationSpeed;
  }

  async setSwingMode(value: CharacteristicValue) {
    this.platform.log.info('Set Characteristic SwingMode ->', value);

    this.state.SwingMode = value as number;
  }

  async getSwingMode(): Promise<CharacteristicValue> {
    const swingMode = this.state.SwingMode;

    this.platform.log.info('Get Characteristic SwingMode ->', swingMode);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return swingMode;
  }

  async setTargetFanState(value: CharacteristicValue) {
    this.platform.log.info('Set Characteristic TargetFanState ->', value);

    this.state.TargetFanState = value as number;
  }

  async getTargetFanState(): Promise<CharacteristicValue> {
    const targetFanState = this.state.TargetFanState;

    this.platform.log.info('Get Characteristic TargetFanState ->', targetFanState);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return targetFanState;
  }

  private updateAnalogOutputState() {
    const active = this.state.Active;
    const rotationSpeed = this.state.RotationSpeed;
    const summer = this.state.SwingMode;
    const auto = (this.state.TargetFanState === this.platform.Characteristic.TargetFanState.AUTO);

    let v = LUNOS_FAN_V.AUTO;
    switch (this.kind) {
      case 'lunosE2': 
        v = this.e2RotationSpeedToVoltage(rotationSpeed, active, auto)
        break;
      case 'lunosEgo':
        v = this.egoRotationSpeedToVoltage(rotationSpeed, active, auto)
        break;
      default:
        this.platform.log.error('Unexpected Lunos fan kind:', this.kind);
    }

    if (active && summer) {
      v += LUNOS_FAN_V.SUMMER_OFFSET;
    }

    this.monarco.analogOutputs[this.analogOutput-1] = v;
  }

  private e2RotationSpeedToVoltage(rotationSpeed, active, auto): number {
    if (rotationSpeed == 0 || !active) {
      return auto ? LUNOS_FAN_V.AUTO : LUNOS_FAN_V.STAGE_0;
    } else if (rotationSpeed <= 25) {
      return LUNOS_FAN_V.STAGE_2;
    } else if (rotationSpeed <= 50) {
     return LUNOS_FAN_V.STAGE_5;
    } else if (rotationSpeed <= 75) {
      return LUNOS_FAN_V.STAGE_7;
    } else {
      return LUNOS_FAN_V.STAGE_8;
    }
  }

  private egoRotationSpeedToVoltage(rotationSpeed, active, auto): number {
    if (rotationSpeed <= 0 || !active) {
      return auto ? LUNOS_FAN_V.AUTO : LUNOS_FAN_V.STAGE_0;
    } else if (rotationSpeed <= 25) {
      return LUNOS_FAN_V.STAGE_2;
    } else if (rotationSpeed <= 50) {
      return LUNOS_FAN_V.STAGE_6;
    } else if (rotationSpeed <= 75) {
      return LUNOS_FAN_V.STAGE_7;
    } else {
      return LUNOS_FAN_V.STAGE_8;
    }
  }

}
