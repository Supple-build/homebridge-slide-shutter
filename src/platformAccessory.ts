import { Service, PlatformAccessory, Logger } from 'homebridge';

import request from 'request';
import poll from 'poll';

import { SlidePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SlideAccesory {
  private service: Service;
  private readonly characteristic;

  private readonly name: string;
  private readonly ip: string;
  private readonly code: string;
  private isLikelyMoving;
  private calibrationTime;
  private tolerance;
  private pollInterval;

  constructor(
    private readonly platform: SlidePlatform,
    private readonly accessory: PlatformAccessory,
    public readonly log: Logger,
  ) {
    this.characteristic = this.platform.Characteristic;
    // extract name from config
    this.name = accessory.context.device.name;
    this.ip = accessory.context.device.ip;
    this.code = accessory.context.device.code;
    this.tolerance = accessory.context.device.tolerance || 7;
    this.isLikelyMoving = false;
    this.calibrationTime = (accessory.context.device.closingTime || 20) * 1000; // 20 seconds

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Innovation in Motion',
      )
      .setCharacteristic(this.platform.Characteristic.Model, 'Slide');

    // get the WindowCovering service if it exists, otherwise create a new WindowCovering service
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

    //setting initial position
    this.getSlideInfo().then((slideInfo: any) => {
      let position = this.slideAPIPositionToHomekit(slideInfo.pos);

      if (this.calculateDifference(position, 100) <= this.tolerance) {
        position = 100;
      } else if (this.calculateDifference(position, 0) <= this.tolerance) {
        position = 0;
      }
      this.service
        .getCharacteristic(this.characteristic.TargetPosition)
        .updateValue(position);

      this.service
        .getCharacteristic(this.characteristic.CurrentPosition)
        .updateValue(position);
    });

    const pollInterval = this.pollInterval || 10;
    poll(this.updateSlideInfo.bind(this), pollInterval * 1000);

    log.info('Slide Curtain finished initializing!');
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

  getSlideInfo() {
    return this.platform.request(
      this.accessory.context.device,
      'GET',
      'rpc/Slide.GetInfo',
    );
  }

  /**
   * Update the slide information from the poll
   */
  updateSlideInfo() {
    this.log.debug('Triggered update slide info from poll');
    this.getSlideInfo().then((slideInfo: any) => {
      let position = this.slideAPIPositionToHomekit(slideInfo.pos);
      let targetPosition;
      this.log.debug('likelyMoving', this.isLikelyMoving);

      if (!this.isLikelyMoving) {
        targetPosition = position;
        if (this.calculateDifference(position, 100) <= this.tolerance) {
          targetPosition = 100;
        } else if (this.calculateDifference(position, 0) <= this.tolerance) {
          targetPosition = 0;
        }
        this.service
          .getCharacteristic(this.characteristic.TargetPosition)
          .updateValue(targetPosition);
      }

      targetPosition = this.service.getCharacteristic(
        this.characteristic.TargetPosition,
      ).value;

      const difference = this.calculateDifference(targetPosition, position);
      this.log.debug(
        'Difference between position and target position: ' + difference,
      );
      this.log.debug('Current target position: ' + targetPosition);
      this.log.debug('Position from API: ' + position);

      if (difference <= this.tolerance) {
        position = targetPosition;
      }

      this.service
        .getCharacteristic(this.characteristic.CurrentPosition)
        .updateValue(position);

      if (targetPosition === position) {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.STOPPED);
        // We have stopped so set the likely moving to false
        this.isLikelyMoving = false;
      } else if (targetPosition < position) {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.DECREASING);
      } else {
        this.service
          .getCharacteristic(this.characteristic.PositionState)
          .updateValue(this.characteristic.PositionState.INCREASING);
      }
    });
  }

  /**
   * Handle requests to get the current value of the "Current Position" characteristic
   */
  handleCurrentPositionGet(callback) {
    this.log.debug('Triggered GET CurrentPosition');
    this.getSlideInfo()
      .then((slideInfo: any) => {
        let position = this.slideAPIPositionToHomekit(slideInfo.pos);
        let targetPosition;

        if (!this.isLikelyMoving) {
          targetPosition = position;
          if (this.calculateDifference(position, 100) <= this.tolerance) {
            targetPosition = 100;
          } else if (this.calculateDifference(position, 0) <= this.tolerance) {
            targetPosition = 0;
          }
          this.service
            .getCharacteristic(this.characteristic.TargetPosition)
            .updateValue(targetPosition);
        }
        targetPosition = this.service.getCharacteristic(
          this.characteristic.TargetPosition,
        ).value;

        const difference = this.calculateDifference(targetPosition, position);
        if (difference <= this.tolerance) {
          position = targetPosition;
        }
        this.service
          .getCharacteristic(this.characteristic.CurrentPosition)
          .updateValue(position);

        callback(null, position);
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  handleTargetPositionGet(callback) {
    this.log.debug('Triggered GET TargetPosition');
    this.getSlideInfo()
      .then((slideInfo: any) => {
        let position = this.slideAPIPositionToHomekit(slideInfo.pos);

        if (this.calculateDifference(position, 100) <= this.tolerance) {
          position = 100;
        } else if (this.calculateDifference(position, 0) <= this.tolerance) {
          position = 0;
        }
        callback(null, position);
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  handleTargetPositionSet(targetPosition, callback) {
    this.log.debug('Triggered SET TargetPosition:' + targetPosition);

    const setPos = this.homekitPositionToSlideAPI(targetPosition);

    this.platform
      .request(this.accessory.context.device, 'POST', 'rpc/Slide.SetPos', {
        pos: setPos,
      })
      .then((response) => {
        const currentPosition =
          this.service.getCharacteristic(this.characteristic.CurrentPosition)
            .value || targetPosition;
        if (targetPosition === currentPosition) {
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
        this.service
          .getCharacteristic(this.characteristic.TargetPosition)
          .updateValue(targetPosition);
        this.isLikelyMoving = true;
        setTimeout(() => {
          this.log.debug('Stopping the move from time-out');
          this.isLikelyMoving = false;
        }, this.calibrationTime + 1000);
        poll(this.updateSlideInfo.bind(this), 3000, () => {
          if (!this.isLikelyMoving) {
            this.log.debug('Stopping the increased poll rate');
          }
          return !this.isLikelyMoving;
        });
        callback(null, targetPosition);
      });
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  handlePositionStateGet(callback) {
    this.log.debug('Triggered GET PositionState');
    callback(
      null,
      this.service.getCharacteristic(this.characteristic.PositionState).value,
    );
  }
}
