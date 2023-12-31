// https://github.com/monarco/monarco-hat-driver-nodejs/blob/master/examples/complex-demo.js
// https://www.lunos.de/files/Downloads/Einbauanleitungen/Einbauanleitung_5UNI-FT_E206_ab-SN-200.000.pdf

import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { ContactSensorAccessory } from './devices/contactSensor';
import { LunosFanAccessory } from './devices/lunosFan';
import { ProgrammableSwitchAccessory } from './devices/programmableSwitch';

import monarco = require('monarco-hat');

const SDC_FIXED_FWVERL = 1;
const SDC_FIXED_FWVERH = 2;
const SDC_FIXED_HWVERL = 3;
const SDC_FIXED_HWVERH = 4;
const SDC_FIXED_CPUID1 = 5;
const SDC_FIXED_CPUID2 = 6;
const SDC_FIXED_CPUID3 = 7;
const SDC_FIXED_CPUID4 = 8;
const SDC_FIXED_RS485BAUD = 0x1010;
const SDC_FIXED_RS485MODE = 0X1011;
//const SDC_FIXED_HOSTUARTBAUD = 0x1012;
const SDC_FIXED_WATCHDOG = 0X100F;
const SDC_FIXED_CNT1MODE = 0x1024;
const SDC_FIXED_CNT2MODE = 0x1025;

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class MonarcoPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    this.log.info('Cycle Interval: ' + monarco._period + 'ms');

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      try {
        this.log.debug('Initializing Monarco HAT...');

        const FW = (this.getRegValue(monarco.serviceData, SDC_FIXED_FWVERH) << 16)
          + (this.getRegValue(monarco.serviceData, SDC_FIXED_FWVERL));

        const HW = (this.getRegValue(monarco.serviceData, SDC_FIXED_HWVERH) << 16)
          + (this.getRegValue(monarco.serviceData, SDC_FIXED_HWVERL));

        const CPUID_1 = (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID4) << 16)
          + (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID3));

        const CPUID_2 = (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID2) << 16)
          + (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID1));

        this.log.info('MONARCO FW=' + this.pad(FW.toString(16), 8) + ', HW=' +
          this.pad(HW.toString(16), 8) + ', CPUID=' + this.pad(CPUID_1, 8) + this.pad(CPUID_2, 8));

        this.setRegValue(monarco.serviceData, SDC_FIXED_CNT1MODE, monarco.SDC.MONARCO_SDC_COUNTER_MODE_OFF);
        this.setRegValue(monarco.serviceData, SDC_FIXED_CNT2MODE, monarco.SDC.MONARCO_SDC_COUNTER_MODE_OFF);
        this.setRegValue(monarco.serviceData, SDC_FIXED_RS485BAUD, 384);
        this.setRegValue(monarco.serviceData, SDC_FIXED_RS485MODE, monarco.SDC.MONARCO_SDC_RS485_DEFAULT_MODE);
        //this.setRegValue(monarco.serviceData, SDC_FIXED_HOSTUARTBAUD, 0);
        this.setRegValue(monarco.serviceData, SDC_FIXED_WATCHDOG, config.watchdogTimeout * 1000);

        monarco.on('err', (err, msg) => {
          this.log.error('Error:', err, msg);
        });

        monarco.init().then(() => {
          this.configureDevices(config);
        });
      } catch (error) {
        this.log.error('Init failed:', error);
        return;
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  configureDevices(config) {
    // loop over the discovered devices and register each one if it has not already been registered
    for (let device of config.devices) {
      // input/output defaults
      device = Object.assign({
        digitalInput: 0,
        digitalOutput: 0,
        analogInput: 0,
        analogOutput: 0,
      }, device);

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.id);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context.device = device;
        this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.instantiateAccessory(device, existingAccessory, monarco);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.name, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        this.instantiateAccessory(device, accessory, monarco);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }

    // remove any stale accessories
    for (const accessory of this.accessories) {
      if (!config.devices.some(device => this.api.hap.uuid.generate(device.id) === accessory.UUID)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  instantiateAccessory(device, accessory, monarco) {
    switch (device.kind) {
      case 'contactSensor':
        new ContactSensorAccessory(this, accessory, monarco);
        break;
      case 'programmableSwitch':
        new ProgrammableSwitchAccessory(this, accessory, monarco);
        break;
      case 'lunosE2':
        // falls through
      case 'lunosEgo':
        new LunosFanAccessory(this, accessory, monarco);
        break;
      default:
        this.log.error('Invalid device kind:' + device.kind);
    }
  }

  pad(num, size) {
    const s = '0000000000' + num;
    return s.substr(s.length - size);
  }

  getRegValue(registers, id) {
    for(const itm of registers) {
      if(itm.register === id) {
        return itm.value;
      }
    }
    this.log.error('Register not found: ' + id);
    return 0;
  }

  setRegValue(registers, id, value) {
    for(const itm of registers) {
      if(itm.register === id) {
        return itm.value = value;
      }
    }
    this.log.error('Register not found: ' + id);
  }
}
