import { Service, PlatformAccessory, Logger } from 'homebridge';
import poll from 'poll';

import { SlidePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SlideLocalAccessory {
  private service: Service;
  private readonly characteristic;

  private readonly name: string;
  private readonly ip: string;
  private readonly identifier: string | null;

  private tolerance: number;
  private pollInterval: number;
  private calibrationTime: number;
  private externalMove: boolean;

  constructor(
    private readonly platform: SlidePlatform,
    private readonly accessory: PlatformAccessory,
    public readonly log: Logger,
  ) {
    this.characteristic = this.platform.Characteristic;

    // extract data from config
    this.name = accessory.context.device.name;
    this.ip = accessory.context.device.ip;
    this.identifier = accessory.context.device.id || null;
    this.pollInterval = accessory.context.device.pollInterval || 20;
    this.tolerance = accessory.context.device.tolerance || 5;
    this.calibrationTime = accessory.context.device.calibrationTime || 20000;
    this.externalMove = true;

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Innovation in Motion',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Slide')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        'Default-Serial',
      );

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.name,
    );

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/WindowCovering

    this.service
      .getCharacteristic(this.characteristic.CurrentPosition)
      .onGet(this.handleCurrentPositionGet.bind(this));

    this.service
      .getCharacteristic(this.characteristic.PositionState)
      .onGet(this.handlePositionStateGet.bind(this));

    this.service
      .getCharacteristic(this.characteristic.TargetPosition)
      .onGet(this.handleTargetPositionGet.bind(this))
      .onSet(this.handleTargetPositionSet.bind(this));

    // Set initial state
    this.setInitialState();

    this.log.debug('interval', this.pollInterval * 1000);

    poll(this.updateSlideInfo.bind(this), this.pollInterval * 1000);

    log.info('Slide shutter initialised!');
  }

  /**
   * Calculates difference between two numbers
   * @param first number
   * @param second number
   * @returns number
   */
  calculateDifference(first, second) {
    let difference = first - second;
    if (difference < 0) {
      difference = difference * -1;
    }
    return difference;
  }

  /**
   * Converts HomeKit position to Slide API capable value
   * @param position number
   * @returns number
   */
  homekitPositionToSlideAPI(position) {
    let newPosition = 100 - position;
    newPosition = newPosition / 100;
    return Math.min(Math.max(newPosition, 0), 1);
  }

  /**
   * Converts slide position to HomeKit capable value
   * @param position number
   * @returns number
   */
  slideAPIPositionToHomekit(position) {
    let newPosition = position * 100;
    newPosition = 100 - newPosition;
    return Math.min(Math.max(newPosition, 0), 100);
  }

  async getSlideInfo() {
    const response = await this.platform.asyncRequest(
      this.accessory.context.device,
      'GET',
      this.ip ? 'rpc/Slide.GetInfo' : `slide/${this.identifier}/info`,
      false,
      !this.ip,
    );

    // Remote API returns `data`, local API does not
    const data = response.data || response;

    return {
      calib_time: data['calib_time'],
      pos: data['pos'],
    };
  }

  async setInitialState() {
    const slideInfo = await this.getSlideInfo();
    const position = this.slideAPIPositionToHomekit(slideInfo.pos);

    this.calibrationTime = slideInfo['calib_time'];

    this.service
      .getCharacteristic(this.characteristic.TargetPosition)
      .updateValue(position);

    this.service
      .getCharacteristic(this.characteristic.CurrentPosition)
      .updateValue(position);
  }

  async updateSlideInfo() {
    this.log.debug('Triggered updateSlideInfo');
    const slideInfo = await this.getSlideInfo();

    let currentPosition = this.slideAPIPositionToHomekit(slideInfo.pos);

    this.calibrationTime = slideInfo['calib_time'];

    let targetPosition = this.service.getCharacteristic(
      this.characteristic.TargetPosition,
    ).value as number;

    const difference = this.calculateDifference(
      targetPosition,
      currentPosition,
    );

    this.log.debug(
      'Difference between position and target position: ',
      difference,
    );

    this.log.debug('Targetposition: ' + targetPosition);
    this.log.debug('Current position from API: ' + currentPosition);

    if (difference <= this.tolerance) {
      currentPosition = targetPosition;
    }

    if (this.externalMove) {
      targetPosition = currentPosition;
      this.service
        .getCharacteristic(this.characteristic.TargetPosition)
        .updateValue(targetPosition);
    }

    this.service
      .getCharacteristic(this.characteristic.CurrentPosition)
      .updateValue(currentPosition);

    this.updatePositionState(targetPosition, currentPosition);

    if (!this.externalMove && difference <= this.tolerance) {
      this.log.debug('reset externalMove');
      this.externalMove = true;
    }
  }

  updatePositionState(targetPosition, currentPosition) {
    if (targetPosition === currentPosition || this.externalMove) {
      this.service
        .getCharacteristic(this.characteristic.PositionState)
        .updateValue(this.characteristic.PositionState.STOPPED);
    } else if (targetPosition < currentPosition) {
      this.service
        .getCharacteristic(this.characteristic.PositionState)
        .updateValue(this.characteristic.PositionState.DECREASING);
    } else {
      this.service
        .getCharacteristic(this.characteristic.PositionState)
        .updateValue(this.characteristic.PositionState.INCREASING);
    }
  }

  /**
   * Handle requests to get the current value of the "Current Position" characteristic
   */
  async handleCurrentPositionGet() {
    this.log.debug('Triggered GET CurrentPosition');

    const slideInfo = await this.getSlideInfo();

    let position = this.slideAPIPositionToHomekit(slideInfo.pos);

    if (this.calculateDifference(position, 100) <= this.tolerance) {
      position = 100;
    } else if (this.calculateDifference(position, 0) <= this.tolerance) {
      position = 0;
    }

    this.service
      .getCharacteristic(this.characteristic.CurrentPosition)
      .updateValue(position);

    return position;
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet() {
    this.log.debug('Triggered GET TargetPosition');
    let targetPosition = this.service.getCharacteristic(
      this.characteristic.TargetPosition,
    ).value;

    if (this.calculateDifference(targetPosition, 100) <= this.tolerance) {
      targetPosition = 100;
    } else if (this.calculateDifference(targetPosition, 0) <= this.tolerance) {
      targetPosition = 0;
    }

    return targetPosition;
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  async handleTargetPositionSet(targetPosition) {
    this.log.debug('Triggered SET TargetPosition:', targetPosition);

    const parameters = {
      pos: this.homekitPositionToSlideAPI(targetPosition),
    };

    await this.platform.asyncRequest(
      this.accessory.context.device,
      'POST',
      this.ip ? 'rpc/Slide.SetPos' : `slide/${this.identifier}/position`,
      parameters,
      !this.ip,
    );

    this.service
      .getCharacteristic(this.characteristic.TargetPosition)
      .updateValue(targetPosition);

    const currentPosition = this.service.getCharacteristic(
      this.characteristic.CurrentPosition,
    ).value;

    this.updatePositionState(targetPosition, currentPosition);

    const difference = this.calculateDifference(
      currentPosition,
      targetPosition,
    );

    this.externalMove = false;

    setTimeout(() => {
      this.log.debug('Update slide info once again after transition completed');
      this.updateSlideInfo();
    }, (this.calibrationTime / 100) * difference + 2000);
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet() {
    this.log.debug('Triggered GET PositionState');

    return this.service.getCharacteristic(this.characteristic.PositionState)
      .value;
  }
}
