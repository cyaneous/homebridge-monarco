import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { LunosFanAccessory, ContactSensorAccessory } from './platformAccessory';

var monarco = require('monarco-hat');

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
          this.configureDevices();
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

  configureDevices() {
    const devices = [
      {
        uniqueId: 'AO1',
        displayName: 'Lunos e2',
        kind: 'lunosFan',
        model: 'e2',
        analogOutput: 1,
      },
      {
        uniqueId: 'AO2',
        displayName: 'Lunos ego',
        kind: 'lunosFan',
        model: 'ego',
        analogOutput: 2,
      },
           {
        uniqueId: 'DI2',
        displayName: 'Bath Fan Button',
        kind: 'contactSensor',
        digitalInput: 2,
      },
    ];

    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.uniqueId);

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
        this.log.info('Adding new accessory:', device.displayName);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.displayName, uuid);

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
      case 'lunosE2', case 'lunosEgo':
        new LunosFanAccessory(this, accessory);
      default:
        this.log.error('Invalid device kind:' + device.kind);
    }
  }
}
