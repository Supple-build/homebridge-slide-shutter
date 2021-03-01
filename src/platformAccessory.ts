import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicSetCallback,
  CharacteristicGetCallback,
} from 'homebridge';

import { SlidePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SlideAccesory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
  };

  constructor(
    private readonly platform: SlidePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Innovation in Motion',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Slide');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.exampleDisplayName,
    );

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // create handlers for required characteristics
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on('get', this.handleCurrentPositionGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.PositionState)
      .on('get', this.handlePositionStateGet.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on('get', this.handleTargetPositionGet.bind(this))
      .on('set', this.handleTargetPositionSet.bind(this));
  }

  /**
   * Handle requests to get the current value of the "Current Position" characteristic
   */
  handleCurrentPositionGet(callback) {
    this.platform.log.debug('Triggered GET CurrentPosition');

    // set this to a valid value for CurrentPosition
    const currentValue = 1;

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet(callback) {
    this.platform.log.debug('Triggered GET PositionState');

    // set this to a valid value for PositionState
    const currentValue = 1;

    callback(null, currentValue);
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet(callback) {
    this.platform.log.debug('Triggered GET TargetPosition');

    // set this to a valid value for TargetPosition
    const currentValue = 1;

    callback(null, currentValue);
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  handleTargetPositionSet(value, callback) {
    this.platform.log.debug('Triggered SET TargetPosition:', value);

    callback(null);
  }
}
