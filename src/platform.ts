import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LunosFanAccessory, ContactSensorAccessory } from './platformAccessory';

var monarco = require('monarco-hat');

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
      log.debug('Executed didFinishLaunching callback');
      try {
        this.log.debug('Initializing Monarco HAT...');

        monarco.on('err', (err, msg) => {
          this.log.error('Error:' + err);
        });

        monarco.init().then(() => {
          var FW = (this.getRegValue(monarco.serviceData, SDC_FIXED_FWVERH) << 16)
            + (this.getRegValue(monarco.serviceData, SDC_FIXED_FWVERL));

          var HW = (this.getRegValue(monarco.serviceData, SDC_FIXED_HWVERH) << 16)
            + (this.getRegValue(monarco.serviceData, SDC_FIXED_HWVERL));

          var CPUID_1 = (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID4) << 16)
            + (this.getRegValue(monarco.serviceData, SDC_FIXED_CPUID3));

          var CPUID_2 = (getRegValue(monarco.serviceData, SDC_FIXED_CPUID2) << 16)
            + (getRegValue(monarco.serviceData, SDC_FIXED_CPUID1));

          this.log.debug('MONARCO SDC INIT DONE, FW=' + pad(FW.toString(16), 8) + ', HW=' + pad(HW.toString(16), 8) + ', CPUID=' + pad(CPUID_1, 8) + pad(CPUID_2, 8));

          //this.setRegValue(monarco.serviceData, SDC_FIXED_CNT1MODE, monarco.SDC.MONARCO_SDC_COUNTER_MODE_OFF);
          //this.setRegValue(monarco.serviceData, SDC_FIXED_CNT2MODE, monarco.SDC.MONARCO_SDC_COUNTER_MODE_QUAD);
          //this.setRegValue(monarco.serviceData, SDC_FIXED_RS485BAUD, 384);
          //this.setRegValue(monarco.serviceData, SDC_FIXED_RS485MODE, monarco.SDC.MONARCO_SDC_RS485_DEFAULT_MODE);
          this.setRegValue(monarco.serviceData, SDC_FIXED_WATCHDOG, config.watchdogTimeout);
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
    for (const device of config.devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate('DI'+device.digitalInput+'DO'+device.digitalOutput+'AI'+device.analogInput+'AO'+device.analogOutput);

      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        // existingAccessory.context.device = device;
        // this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        this.instantiateAccessory(device, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
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
        this.instantiateAccessory(device, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  instantiateAccessory(device, accessory) {
    switch (device.kind) {
      case 'contactSensor':
        new ContactSensorAccessory(this, accessory);
        break;
      case 'lunosE2':
      case 'lunosEgo':
        new LunosFanAccessory(this, accessory);
        break;
      default:
        this.log.error('Invalid device kind:' + device.kind);
    }
  }

  getRegValue(registers, id) {
    for(var itm of registers) {
      if(itm.register === id) {
          return itm.value;
      }    
    }
    this.log.error('Register not found: ' + id);
    return 0;
  }

  setRegValue(registers, id, value) {
    for(var itm of registers){
      if(itm.register === id){
        return itm.value = value;
      }
    }
    this.log.error('Register not found: ' + id);
  }
}
